import { after, NextResponse } from "next/server";
import { getRegisteredOutboundLink, normalizeOutboundUrl, resolveAffiliateUrl } from "../../../lib/affiliate";
import { getStoredAffiliateCodes, getStoredAffiliateMappings } from "../../../lib/affiliateStore";
import { getOutboundRow, incrementOutboundClick } from "../../../lib/onlineOutbound";
import { KvNotConfiguredError } from "../../../lib/kvRest";
import { OUTBOUND_LINKS } from "../../../lib/outbound";
import type { OutboundLink } from "../../../lib/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(code)) {
    return NextResponse.json({ error: "Invalid outbound code" }, { status: 400 });
  }

  // 배포에 포함된 검증 주소는 온라인 저장소 장애와 무관하게 제공합니다.
  let row: OutboundLink | null = Object.hasOwn(OUTBOUND_LINKS, code) ? OUTBOUND_LINKS[code] : getRegisteredOutboundLink(code);
  const alias = !row ? (await getStoredAffiliateCodes([code])).get(code) : undefined;
  if (alias) row = alias;
  if (!row) {
    try {
      row = await getOutboundRow(code);
    } catch (error: unknown) {
      if (error instanceof KvNotConfiguredError) {
        return NextResponse.json({ errorCode: error.code, error: "온라인 저장소(KV) 설정이 필요합니다." }, { status: 503 });
      }
      return NextResponse.json({ error: "Failed to resolve outbound link" }, { status: 503 });
    }
  }

  if (!row) {
    // 없는 코드면 홈으로 리다이렉트
    return NextResponse.redirect(new URL("/community/hotdeal", req.url), 302);
  }

  const original = normalizeOutboundUrl(row.originalUrl);
  const stored = alias ?? (original ? (await getStoredAffiliateMappings([original])).get(original) : undefined);
  const target = resolveAffiliateUrl({ ...row, code }, stored)?.url;

  if (!target) {
    // whitelist 밖이면 차단
    return NextResponse.json({ error: "Blocked outbound host" }, { status: 400 });
  }

  // 통계 저장은 응답 후 실행하여 판매처 이동을 지연시키지 않습니다.
  after(async () => {
    try { await incrementOutboundClick(code); } catch { /* best effort */ }
  });
  const response = NextResponse.redirect(target, 302);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
