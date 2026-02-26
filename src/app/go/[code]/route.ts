import { NextResponse } from "next/server";
import { convertToAffiliateUrl } from "../../../lib/affiliate";
import { getOutboundRow, incrementOutboundClick } from "../../../lib/onlineOutbound";
import { KvNotConfiguredError } from "../../../lib/kvRest";
import { OUTBOUND_LINKS } from "../../../lib/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: { code: string } }) {
  const code = ctx.params.code;

  let row: any = null;
  try {
    row = await getOutboundRow(code);
  } catch (e: any) {
    if (e instanceof KvNotConfiguredError) {
      // local fallback (dev/demo)
      const local = OUTBOUND_LINKS[code];
      if (local) {
        row = local;
      } else {
        return NextResponse.json(
          {
            errorCode: e.code,
            error: "온라인 저장소(KV) 설정이 필요합니다.",
          },
          { status: 503 },
        );
      }
    } else {
      return NextResponse.json({ error: "Failed to resolve outbound link" }, { status: 500 });
    }
  }

  if (!row) {
    // local fallback (dev/demo)
    row = OUTBOUND_LINKS[code] ?? null;
  }

  if (!row) {
    // 없는 코드면 홈으로 리다이렉트
    return NextResponse.redirect(new URL("/community/hotdeal", req.url), 302);
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

  // best-effort click count (ignore failures)
  try {
    await incrementOutboundClick(code);
  } catch {
    // ignore
  }

  return NextResponse.redirect(target, 302);
}
