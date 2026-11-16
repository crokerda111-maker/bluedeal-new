import { NextResponse } from "next/server";
import contract from "../../../../content/priceSnapshot.schema.json";
import type { PriceCategoryKey } from "../../../../lib/priceCategories";
import { getLocalMeta, getLocalPrices } from "../../../../lib/localPrices";
import { OUTBOUND_LINKS } from "../../../../lib/outbound";
import { getPublicPriceSnapshot } from "../../../../lib/priceSnapshot";
import { version } from "../../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const categories = contract.categories.map(category => getLocalPrices(category as PriceCategoryKey));
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return NextResponse.json({ ...getPublicPriceSnapshot(getLocalMeta(), categories, OUTBOUND_LINKS, contract), version, commit: /^[a-f0-9]{40}$/i.test(commit) ? commit : null }, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
