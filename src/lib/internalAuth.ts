import "server-only";

import crypto from "crypto";

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyInternalBearer(authorization: string | null): "ok" | "not-configured" | "unauthorized" {
  const expected = process.env.OUTBOUND_INGEST_SECRET?.trim();
  if (!expected || expected.length < 24) return "not-configured";

  const prefix = "Bearer ";
  if (!authorization?.startsWith(prefix)) return "unauthorized";

  const supplied = authorization.slice(prefix.length).trim();
  if (!supplied || !safeEqual(supplied, expected)) return "unauthorized";
  return "ok";
}
