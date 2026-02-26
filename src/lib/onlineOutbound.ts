import "server-only";

import crypto from "crypto";
import type { Merchant } from "./outbound";
import { isAllowedHost } from "./affiliate";
import { kvCommand } from "./kvRest";

/**
 * Online outbound link storage (Upstash Redis REST / Vercel KV REST)
 *
 * - 목적: 게시글/핫딜/가격현황 등 내부의 외부 URL을 `/go/{code}`로 바꿔서,
 *   클릭 시 제휴 변환 로직을 거친 뒤 외부로 리다이렉트.
 * - 주의: /go는 오픈리다이렉트 악용 위험이 있으므로
 *   whitelist(host 허용) 기반만 저장/리다이렉트.
 */

const OUT_CODE_PREFIX = "bd:out:code:";
const OUT_URL_PREFIX = "bd:out:url:";
const OUT_CLICK_PREFIX = "bd:out:click:";

export type OutboundRow = {
  code: string;
  merchant: Merchant;
  originalUrl: string;
  createdAt: string;
};

function nowIso(): string {
  // KST 고정(+09:00)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().replace("Z", "+09:00");
}

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function sha256B64Url(text: string): string {
  return crypto.createHash("sha256").update(text).digest("base64url");
}

function merchantFromHost(host: string): Merchant | null {
  const h = host.toLowerCase();

  if (/(^|\.)coupang\.com$/.test(h) || /(^|\.)link\.coupang\.com$/.test(h)) return "coupang";
  if (
    /(^|\.)aliexpress\.com$/.test(h) ||
    /(^|\.)a\.aliexpress\.com$/.test(h) ||
    /(^|\.)s\.click\.aliexpress\.com$/.test(h) ||
    /(^|\.)aliexpress\.us$/.test(h)
  )
    return "aliexpress";
  if (/(^|\.)11st\.co\.kr$/.test(h)) return "11st";
  if (/(^|\.)gmarket\.co\.kr$/.test(h)) return "gmarket";
  if (/(^|\.)naver\.com$/.test(h) || /(^|\.)smartstore\.naver\.com$/.test(h)) return "naver";

  return null;
}

export function isHttpUrlString(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(raw: string): string {
  const t = String(raw).trim();
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return t;
  }
  u.hash = "";
  return u.toString();
}

function codeKey(code: string): string {
  return `${OUT_CODE_PREFIX}${code}`;
}

function urlKey(urlHashHex: string): string {
  return `${OUT_URL_PREFIX}${urlHashHex}`;
}

function clickKey(code: string): string {
  return `${OUT_CLICK_PREFIX}${code}`;
}

/**
 * Create or reuse an outbound code for a URL.
 * - Returns null when URL is invalid or not allowed (whitelist 밖)
 */
export async function createOrReuseOutboundCode(originalUrl: string): Promise<string | null> {
  if (!isHttpUrlString(originalUrl)) return null;

  const normalized = normalizeUrl(originalUrl);

  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    return null;
  }

  if (!isAllowedHost(u.hostname)) return null;

  const merchant = merchantFromHost(u.hostname);
  if (!merchant) return null;

  const hHex = sha256Hex(normalized);
  const existing = (await kvCommand<string | null>("GET", urlKey(hHex))) ?? null;
  if (typeof existing === "string" && existing.length) return existing;

  // 16 chars of base64url ~= 96-bit space => collision effectively negligible
  const base = sha256B64Url(normalized).replace(/[^a-zA-Z0-9_-]/g, "");
  const code = base.slice(0, 16);

  // 1) Reserve url->code (avoid duplicates)
  const ok = await kvCommand<number>("SETNX", urlKey(hHex), code);
  if (ok === 0) {
    const again = (await kvCommand<string | null>("GET", urlKey(hHex))) ?? null;
    if (again) return again;
  }

  // 2) Store code row (best-effort)
  const row: OutboundRow = {
    code,
    merchant,
    originalUrl: normalized,
    createdAt: nowIso(),
  };

  const rowKey = codeKey(code);
  const setRow = await kvCommand<number>("SETNX", rowKey, JSON.stringify(row));
  if (setRow === 1) return code;

  // If already exists, validate it's the same URL.
  try {
    const oldRaw = (await kvCommand<string | null>("GET", rowKey)) ?? null;
    if (oldRaw) {
      const old = JSON.parse(oldRaw) as Partial<OutboundRow>;
      if (old?.originalUrl === normalized) return code;
    }
  } catch {
    // ignore
  }

  // Extremely unlikely collision: use a longer code slice.
  const alt = base.slice(0, 20);
  if (alt && alt !== code) {
    await kvCommand("SET", urlKey(hHex), alt);
    await kvCommand("SET", codeKey(alt), JSON.stringify({ ...row, code: alt }));
    return alt;
  }

  return code;
}

export async function getOutboundRow(code: string): Promise<OutboundRow | null> {
  const raw = (await kvCommand<string | null>("GET", codeKey(code))) ?? null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OutboundRow;
  } catch {
    return null;
  }
}

/**
 * Best-effort click increment.
 * - Stored separately to avoid JSON race conditions.
 */
export async function incrementOutboundClick(code: string): Promise<number> {
  const n = await kvCommand<number>("INCR", clickKey(code));
  return typeof n === "number" ? n : Number(n);
}
