import "server-only";

import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bd_admin";

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

export function computeAdminCookieValue(password = getAdminPassword()): string {
  if (!password) return "";
  // Keep this deterministic but not equal to the raw password.
  // If a cookie leaks, it still grants admin access, so keep it httpOnly.
  return crypto.createHash("sha256").update(`bluedeal_admin::${password}`).digest("hex");
}

export function isAdminRequest(req: NextRequest): boolean {
  const v = req.cookies.get(COOKIE_NAME)?.value;
  if (!v) return false;
  const expected = computeAdminCookieValue();
  return Boolean(expected && /^[a-f0-9]{64}$/.test(v)
    && crypto.timingSafeEqual(Buffer.from(v, "hex"), Buffer.from(expected, "hex")));
}

export function setAdminCookie(res: NextResponse): void {
  const value = computeAdminCookieValue();
  if (!value) throw new Error("ADMIN_PASSWORD is not configured");
  res.cookies.set({
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
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
