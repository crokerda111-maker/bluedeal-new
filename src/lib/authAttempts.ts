import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { kvMultiExec } from "./kvRest";

type Scope = "admin-login" | "private-unlock";
type Failure = { status: 429 | 503; errorCode: string; error: string; retryAfter?: number };
const WINDOW_SECONDS = 300;
const LIMITS: Record<Scope, number> = { "admin-login": 10, "private-unlock": 20 };

/** Counters are shared across deployments; no password or original IP is stored. */
export async function limitAuthenticationAttempt(req: Pick<NextRequest, "headers">, scope: Scope): Promise<Failure | null> {
  try {
    const secret = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!secret) throw new Error("Authentication counter storage is not configured.");
    // Vercel overwrites these headers. Untrusted forwarding headers on a local
    // or separately hosted server must not let a caller select fresh counters.
    const platform = process.env.VERCEL === "1";
    const raw = platform ? req.headers.get("x-vercel-forwarded-for") || req.headers.get("x-forwarded-for") : null;
    const first = raw?.split(",")[0].trim();
    const client = first && isIP(first) ? first.toLowerCase() : platform ? "unknown" : "local";
    const digest = createHmac("sha256", secret).update(`bluedeal-auth-attempt-v1:${client}`).digest("hex");
    const key = `bd:auth-attempt:v1:${scope}:${digest}`;
    const [count, expirationSet, ttl] = await kvMultiExec([
      ["INCR", key], ["EXPIRE", key, WINDOW_SECONDS, "NX"], ["TTL", key],
    ]);
    if (!Number.isSafeInteger(count) || count < 1 || ![0, 1].includes(expirationSet)
      || !Number.isInteger(ttl) || ttl < 0 || ttl > WINDOW_SECONDS) throw new Error("Invalid authentication counter response.");
    if (count <= LIMITS[scope]) return null;
    const retryAfter = Math.max(1, ttl);
    return { status: 429, errorCode: "AUTH_RATE_LIMIT", error: `시도가 많습니다. ${retryAfter}초 후 다시 시도해 주세요.`, retryAfter };
  } catch {
    // A failed shared counter must not silently turn password checks unlimited.
    return { status: 503, errorCode: "AUTH_PROTECTION_UNAVAILABLE", error: "인증 요청을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
