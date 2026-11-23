import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizationUrl, calculatePKCECodeChallenge, googleWriter, randomNonce, randomPKCECodeVerifier, randomState } from "../../../../lib/googleWriter";
import { LOGIN_SECONDS, memberLoginEnabled, storeWriterLogin, WRITER_LOGIN, writerCookie, writerReturnPath, writerToken } from "../../../../lib/memberWrite";
import { SITE_URL } from "../../../../lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!memberLoginEnabled() || req.headers.get("host") !== new URL(SITE_URL).host) return new NextResponse(null, { status: 404 });
  const nextPath = writerReturnPath(req.nextUrl.searchParams.get("next"));
  try {
    const token = writerToken();
    const state = randomState();
    const nonce = randomNonce();
    const verifier = randomPKCECodeVerifier();
    const url = buildAuthorizationUrl(await googleWriter(), {
      redirect_uri: new URL("/api/member/google/callback", SITE_URL).href,
      scope: "openid",
      state,
      nonce,
      code_challenge: await calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    });

    await storeWriterLogin(token, { state, nonce, verifier, nextPath });
    const res = NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
    writerCookie(res, WRITER_LOGIN, token, LOGIN_SECONDS);
    return res;
  } catch {
    const failure = new URL("/login", SITE_URL);
    failure.searchParams.set("google", "error");
    failure.searchParams.set("next", nextPath);
    return NextResponse.redirect(failure, { headers: { "Cache-Control": "no-store" } });
  }
}
