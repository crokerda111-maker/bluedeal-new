import { NextRequest, NextResponse } from "next/server";
import { authorizationCodeGrant, googleWriter } from "../../../../../lib/googleWriter";
import { createWriterSession, endWriterSession, memberLoginEnabled, takeWriterLogin, WRITER_LOGIN, writerCookie, writerReturnPath } from "../../../../../lib/memberWrite";
import { SITE_URL } from "../../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!memberLoginEnabled() || req.headers.get("host") !== new URL(SITE_URL).host) return new NextResponse(null, { status: 404 });
  let nextPath = "/login";

  function redirect(error = false) {
    const url = new URL(error ? "/login" : nextPath, SITE_URL);
    if (error) {
      url.searchParams.set("google", "error");
      url.searchParams.set("next", nextPath);
    }
    const res = NextResponse.redirect(url, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    writerCookie(res, WRITER_LOGIN, "", 0);
    return res;
  }

  try {
    const login = await takeWriterLogin(req);
    if (!login) return redirect(true);
    nextPath = writerReturnPath(login.nextPath);
    if (req.nextUrl.searchParams.get("state") !== login.state || !req.nextUrl.searchParams.has("code")) return redirect(true);

    const callback = new URL("/api/member/google/callback", SITE_URL);
    callback.search = req.nextUrl.search;
    const tokens = await authorizationCodeGrant(await googleWriter(), callback, {
      expectedState: login.state,
      expectedNonce: login.nonce,
      pkceCodeVerifier: login.verifier,
    });
    const subject = tokens.claims()?.sub;
    if (!subject) return redirect(true);
    const res = redirect();
    await endWriterSession(req, res);
    await createWriterSession(res, subject);
    return res;
  } catch {
    return redirect(true);
  }
}
