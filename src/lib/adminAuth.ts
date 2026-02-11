import "server-only";

import crypto from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "bd_admin";

export function getAdminPassword(): string {
  // Default password (can be overridden by Vercel env: ADMIN_PASSWORD)
  return process.env.ADMIN_PASSWORD || "dkrdjek2";
}

export function getAdminCookieName(): string {
  return COOKIE_NAME;
}

export function computeAdminCookieValue(password = getAdminPassword()): string {
  // Keep this deterministic but not equal to the raw password.
  // If a cookie leaks, it still grants admin access, so keep it httpOnly.
  return crypto.createHash("sha256").update(`bluedeal_admin::${password}`).digest("hex");
}

export function isAdminRequest(req: NextRequest): boolean {
  const v = req.cookies.get(COOKIE_NAME)?.value;
  if (!v) return false;
  return v === computeAdminCookieValue();
}

export function setAdminCookie(res: NextResponse): void {
  res.cookies.set({
    name: COOKIE_NAME,
    value: computeAdminCookieValue(),
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
