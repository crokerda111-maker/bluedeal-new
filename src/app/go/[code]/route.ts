import { NextResponse } from "next/server";
import { OUTBOUND_LINKS } from "../../../lib/outbound";
import { convertToAffiliateUrl } from "../../../lib/affiliate";

export async function GET(req: Request, ctx: { params: { code: string } }) {
  const code = ctx.params.code;

  const row = OUTBOUND_LINKS[code];
  if (!row) {
    // 없는 코드면 홈으로 리다이렉트
    return NextResponse.redirect(new URL("/hot", req.url), 302);
  }

  const target = convertToAffiliateUrl({
    merchant: row.merchant,
    originalUrl: row.originalUrl,
    code,
  });

  if (!target) {
    // whitelist 밖이면 차단
    return NextResponse.json({ error: "Blocked outbound host" }, { status: 400 });
  }

  // TODO (다음 단계): outbound_clicks 저장
  return NextResponse.redirect(target, 302);
}
