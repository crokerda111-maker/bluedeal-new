import "server-only";

import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bd_admin";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function isAdminPasswordConfigured(): boolean {
  return getAdminPassword().length > 0;
}

export function matchesAdminPassword(candidate: string): boolean {
  const password = getAdminPassword();
  if (!password) return false;
  const expected = crypto.createHash("sha256").update(password).digest();
  const supplied = crypto.createHash("sha256").update(candidate).digest();
  return crypto.timingSafeEqual(expected, supplied);
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}

function sessionSignature(payload: string, password: string): Buffer {
  return crypto.createHmac("sha256", password).update(`bluedeal-admin-session:${payload}`).digest();
}

export function createAdminCookieValue(password = getAdminPassword()): string {
  if (!password) return "";
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `v1.${issuedAt}.${issuedAt + SESSION_SECONDS}.${crypto.randomBytes(16).toString("hex")}`;
  return `${payload}.${sessionSignature(payload, password).toString("hex")}`;
}

export function isAdminRequest(req: NextRequest): boolean {
  const v = req.cookies.get(COOKIE_NAME)?.value;
  const password = getAdminPassword();
  if (!v || !password) return false;
  const parts = /^v1\.([0-9]{1,12})\.([0-9]{1,12})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(v);
  if (!parts) return false;
  const issuedAt = Number(parts[1]);
  const expiresAt = Number(parts[2]);
  const now = Math.floor(Date.now() / 1000);
  // A retained or replayed browser cookie must not bypass server-side expiry.
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt)
    || issuedAt > now + 60 || expiresAt <= now || expiresAt <= issuedAt
    || expiresAt - issuedAt > SESSION_SECONDS) return false;
  const payload = v.slice(0, v.lastIndexOf("."));
  return crypto.timingSafeEqual(Buffer.from(parts[4], "hex"), sessionSignature(payload, password));
}

export function setAdminCookie(res: NextResponse): void {
  const value = createAdminCookieValue();
  if (!value) throw new Error("ADMIN_PASSWORD is not configured");
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearAdminCookie(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
