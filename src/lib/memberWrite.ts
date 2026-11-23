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
  | { state: "disabled" | "login" | "unavailable" }
  | { state: "nickname"; conflict?: boolean }
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
const PROFILE_PREFIX = "bd:member:profile:";
const profileKey = (id: string) => PROFILE_PREFIX + id;
const revocationKey = (id: string) => "bd:member:revoked:" + id;
const NICKNAME_INDEX = "bd:member:nickname:v1";
const NICKNAME_READY = NICKNAME_INDEX + ":ready";
const NICKNAME_BATCH = 50;

function nicknameKey(nickname: string) {
  return nickname.normalize("NFKC").toLowerCase().replace(/[\s_.-]/gu, "");
}

const INDEX_LEGACY_NICKNAMES = `
if redis.call('GET', KEYS[1]) then return 0 end
for index = 3, #KEYS do
  local pos = (index - 3) * 3
  if redis.call('GET', KEYS[index]) == ARGV[pos + 3] then
    redis.call('HSETNX', KEYS[2], ARGV[pos + 1], ARGV[pos + 2])
  end
end
return 1
`;

let indexingNicknames: Promise<void> | undefined;

async function indexLegacyNicknames() {
  // Registration waits for all preexisting profiles to be considered before claiming any name.
  const keys = new Set<string>();
  let cursor = "0";
  do {
    const result = await kvCommand<[string | number, string[]]>("SCAN", cursor, "MATCH", PROFILE_PREFIX + "*", "COUNT", 200);
    if (!Array.isArray(result) || !Array.isArray(result[1]) || !/^\d+$/.test(String(result[0]))) {
      throw new Error("Invalid nickname index scan.");
    }
    cursor = String(result[0]);
    for (const key of result[1]) {
      if (typeof key === "string" && key.startsWith(PROFILE_PREFIX) && TOKEN.test(key.slice(PROFILE_PREFIX.length))) keys.add(key);
    }
  } while (cursor !== "0");

  const ordered = [...keys].sort();
  for (let offset = 0; offset < ordered.length; offset += NICKNAME_BATCH) {
    const batch = ordered.slice(offset, offset + NICKNAME_BATCH);
    const values = await kvCommand<(string | null)[]>("MGET", ...batch);
    if (!Array.isArray(values) || values.length !== batch.length) throw new Error("Invalid nickname index batch.");
    const profiles = batch.flatMap((key, index) => {
      const raw = values[index];
      if (!raw) return [];
      const profile = JSON.parse(raw) as WriterProfile;
      const normalized = nicknameKey(profile.nickname);
      return normalized ? [{ key, args: [normalized, key.slice(PROFILE_PREFIX.length), raw] }] : [];
    });
    if (profiles.length) await kvCommand("EVAL", INDEX_LEGACY_NICKNAMES, profiles.length + 2,
      NICKNAME_READY, NICKNAME_INDEX, ...profiles.map(profile => profile.key), ...profiles.flatMap(profile => profile.args));
  }
  await kvCommand("SET", NICKNAME_READY, "1");
}

async function ensureNicknameIndex() {
  if (await kvCommand("GET", NICKNAME_READY) === "1") return;
  indexingNicknames ??= indexLegacyNicknames().finally(() => { indexingNicknames = undefined; });
  await indexingNicknames;
}

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
  if (!profile) return { identity, status: { state: "nickname" } };
  await ensureNicknameIndex();
  const owner = await kvCommand<string | null>("HGET", NICKNAME_INDEX, nicknameKey(profile.nickname));
  return { identity, status: owner === id ? { state: "ready", nickname: profile.nickname } : { state: "nickname", conflict: true } };
}

export function validWriterNickname(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const name = value.trim();
  return name.length <= POST_LIMITS.authorName && /^[\p{L}\p{N} _.-]+$/u.test(name) && /[\p{L}\p{N}]/u.test(name) &&
    !/^(?:블루딜(?:ai|운영자)?|bluedeal(?:ai|admin)?|관리자|운영자|곰선생|비회원|익명)$/u.test(nicknameKey(name));
}

const CHECK_SESSION = `
local revoked = redis.call('GET', KEYS[2])
if not redis.call('GET', KEYS[1]) or (revoked and tonumber(revoked) >= tonumber(ARGV[1])) then
  return false
end
`;

export async function chooseWriterNickname(identity: WriterIdentity, nickname: string) {
  await ensureNicknameIndex();
  const alias = identity.profile?.alias ?? writerToken();
  const previous = identity.profile?.nickname;
  const result = await kvCommand<string[] | null>("EVAL", CHECK_SESSION + `
if redis.call('GET', KEYS[5]) then return false end
local profile = redis.call('GET', KEYS[3])
if profile then
  local saved = cjson.decode(profile)
  if saved.nickname ~= ARGV[5] or saved.alias ~= ARGV[7] then return false end
  if redis.call('HGET', KEYS[6], ARGV[6]) == ARGV[3] then return {'saved', saved.nickname} end
elseif ARGV[5] ~= '' then return false end
local owner = redis.call('HGET', KEYS[6], ARGV[4])
if owner and owner ~= ARGV[3] then return {'taken'} end
redis.call('HSET', KEYS[6], ARGV[4], ARGV[3])
redis.call('SET', KEYS[4], ARGV[3])
redis.call('SET', KEYS[3], ARGV[2])
return {'saved', ARGV[8]}
`, 6, identity.sessionKey, revocationKey(identity.id), profileKey(identity.id), writerAuthorKey(alias),
    writerSuspensionKey(identity.id), NICKNAME_INDEX, identity.issuedAt, JSON.stringify({ alias, nickname }), identity.id,
    nicknameKey(nickname), previous ?? "", previous ? nicknameKey(previous) : "", alias, nickname);
  return result?.[0] === "taken" ? { state: "taken" } as const
    : result?.[0] === "saved" && result[1] ? { state: "saved", nickname: result[1] } as const : null;
}

export async function withdrawWriter(identity: WriterIdentity): Promise<boolean> {
  if (!identity.profile) return false;
  const removed = await kvCommand<number | null>("EVAL", CHECK_SESSION + `
local profile = redis.call('GET', KEYS[3])
if not profile then return false end
local saved = cjson.decode(profile)
if saved.alias ~= ARGV[4] or saved.nickname ~= ARGV[5] then return false end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('DEL', KEYS[1], KEYS[3], KEYS[4])
if redis.call('HGET', KEYS[5], ARGV[6]) == ARGV[7] then redis.call('HDEL', KEYS[5], ARGV[6]) end
return 1
`, 5, identity.sessionKey, revocationKey(identity.id), profileKey(identity.id), writerAuthorKey(identity.profile.alias), NICKNAME_INDEX,
    identity.issuedAt, Date.now(), SESSION_SECONDS, identity.profile.alias, identity.profile.nickname, nicknameKey(identity.profile.nickname), identity.id);
  return removed === 1;
}
