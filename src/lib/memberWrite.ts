import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCommunityBoard } from "./boardConfig";
import { kvCommand, kvPipeline } from "./kvRest";
import { POST_LIMITS } from "./postInput";

export const WRITER_SESSION = "__Host-bd-writer";
export const WRITER_LOGIN = "__Host-bd-google";
export const LOGIN_SECONDS = 600;
const SESSION_SECONDS = 7 * 24 * 3600;
const TOKEN = /^[a-f0-9]{64}$/;

export type WriterStatus =
  | { state: "disabled" | "login" | "nickname" | "unavailable" }
  | { state: "ready"; nickname: string }
  | { state: "suspended"; until: string; registered: boolean; nickname: string | null };

type WriterSession = { id: string; issuedAt: number };
type WriterProfile = { alias: string; nickname: string };
type WriterIdentity = WriterSession & { sessionKey: string; profile: WriterProfile | null };

export function memberWritingEnabled() {
  return process.env.BLUEDEAL_GOOGLE_WRITE_LOGIN === "1";
}

export function memberLoginEnabled() {
  return memberWritingEnabled() || process.env.BLUEDEAL_GOOGLE_MEMBER_LOGIN === "1";
}

export function memberConfig() {
  const { BLUEDEAL_GOOGLE_CLIENT_ID: clientId, BLUEDEAL_GOOGLE_CLIENT_SECRET: secret, BLUEDEAL_MEMBER_KEY: key } = process.env;
  if (!clientId || !secret || !key || !TOKEN.test(key)) throw new Error("Writer login configuration is incomplete.");
  return { clientId, secret, key };
}

export function writerReturnPath(value: string | null) {
  if (value === "/login" || value === "/signup" || value === "/account" || value === "/it/write" ||
      value === "/community/issue" || value === "/contact/write") return value;
  const match = value?.match(/^\/community\/([a-z-]+)\/write$/);
  return value && match && getCommunityBoard(match[1]) ? value : "/login";
}

export function writerToken() {
  return randomBytes(32).toString("hex");
}

function tokenKey(kind: "login" | "session", token: string) {
  return "bd:member:" + kind + ":" + createHash("sha256").update(token).digest("hex");
}

export function writerCookie(res: NextResponse, name: string, value: string, maxAge: number) {
  res.cookies.set({ name, value, httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });
}

type WriterLogin = { state: string; nonce: string; verifier: string; nextPath: string };

export async function storeWriterLogin(token: string, login: WriterLogin) {
  await kvCommand("SET", tokenKey("login", token), JSON.stringify(login), "EX", LOGIN_SECONDS);
}

export async function takeWriterLogin(req: NextRequest): Promise<WriterLogin | null> {
  const token = req.cookies.get(WRITER_LOGIN)?.value;
  if (!token || !TOKEN.test(token)) return null;
  const raw = await kvCommand<string | null>("GETDEL", tokenKey("login", token));
  return raw ? JSON.parse(raw) as WriterLogin : null;
}

export async function endWriterSession(req: NextRequest, res: NextResponse) {
  const token = req.cookies.get(WRITER_SESSION)?.value;
  if (token && TOKEN.test(token)) await kvCommand("DEL", tokenKey("session", token));
  writerCookie(res, WRITER_SESSION, "", 0);
}

export async function createWriterSession(res: NextResponse, subject: string) {
  const id = createHmac("sha256", Buffer.from(memberConfig().key, "hex")).update("google:" + subject).digest("hex");
  const token = writerToken();
  const session: WriterSession = { id, issuedAt: Date.now() };
  await kvCommand("SET", tokenKey("session", token), JSON.stringify(session), "EX", SESSION_SECONDS);
  writerCookie(res, WRITER_SESSION, token, SESSION_SECONDS);
}

export const writerPostKey = (id: string) => "bd:member:post:" + id;
export const writerSuspensionKey = (id: string) => "bd:member:suspension:" + id;
export const writerAuthorKey = (alias: string) => "bd:member:author:" + alias;
const profileKey = (id: string) => "bd:member:profile:" + id;
const revocationKey = (id: string) => "bd:member:revoked:" + id;

export async function readWriter(req: NextRequest): Promise<{ identity: WriterIdentity | null; status: WriterStatus }> {
  if (!memberLoginEnabled()) return { identity: null, status: { state: "disabled" } };
  memberConfig();
  const guest = { identity: null, status: { state: "login" } } as const;

  const token = req.cookies.get(WRITER_SESSION)?.value;
  if (!token || !TOKEN.test(token)) return guest;

  const sessionKey = tokenKey("session", token);
  const raw = await kvCommand<string | null>("GET", sessionKey);
  if (!raw) return guest;
  const session = JSON.parse(raw) as WriterSession;
  if (!TOKEN.test(session.id) || !Number.isSafeInteger(session.issuedAt)) return guest;

  const { id, issuedAt } = session;
  const [until, profileRaw, revokedAt] = await kvPipeline([
    ["GET", writerSuspensionKey(id)], ["GET", profileKey(id)], ["GET", revocationKey(id)],
  ]) as [string | null, string | null, string | null];
  if (revokedAt !== null && issuedAt <= Number(revokedAt)) return guest;

  const profile = profileRaw ? JSON.parse(profileRaw) as WriterProfile : null;
  const identity: WriterIdentity = { id, issuedAt, sessionKey, profile };
  if (until) return { identity, status: { state: "suspended", until, registered: Boolean(profile), nickname: profile?.nickname ?? null } };
  return { identity, status: profile ? { state: "ready", nickname: profile.nickname } : { state: "nickname" } };
}

export function validWriterNickname(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const name = value.trim();
  return name.length <= POST_LIMITS.authorName && /^[\p{L}\p{N} _.-]+$/u.test(name) && /[\p{L}\p{N}]/u.test(name) &&
    !/^(?:블루딜(?:ai|운영자)?|bluedeal(?:ai|admin)?|관리자|운영자|곰선생)$/i.test(name.normalize("NFKC").replace(/[\s_.-]/g, ""));
}

const CHECK_SESSION = `
local revoked = redis.call('GET', KEYS[2])
if not redis.call('GET', KEYS[1]) or (revoked and tonumber(revoked) >= tonumber(ARGV[1])) then
  return false
end
`;

export async function chooseWriterNickname(identity: WriterIdentity, nickname: string): Promise<string | null> {
  const alias = writerToken();
  const result = await kvCommand<string | null>("EVAL", CHECK_SESSION + `
if redis.call('GET', KEYS[5]) then return false end
local profile = redis.call('GET', KEYS[3])
if profile then return profile end
redis.call('SET', KEYS[4], ARGV[3])
redis.call('SET', KEYS[3], ARGV[2])
return ARGV[2]
`, 5, identity.sessionKey, revocationKey(identity.id), profileKey(identity.id), writerAuthorKey(alias),
    writerSuspensionKey(identity.id), identity.issuedAt, JSON.stringify({ alias, nickname }), identity.id);
  return result ? (JSON.parse(result) as WriterProfile).nickname : null;
}

export async function withdrawWriter(identity: WriterIdentity): Promise<boolean> {
  if (!identity.profile) return false;
  const removed = await kvCommand<number | null>("EVAL", CHECK_SESSION + `
local profile = redis.call('GET', KEYS[3])
if not profile or cjson.decode(profile).alias ~= ARGV[4] then return false end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('DEL', KEYS[1], KEYS[3], KEYS[4])
return 1
`, 4, identity.sessionKey, revocationKey(identity.id), profileKey(identity.id), writerAuthorKey(identity.profile.alias),
    identity.issuedAt, Date.now(), SESSION_SECONDS, identity.profile.alias);
  return removed === 1;
}
