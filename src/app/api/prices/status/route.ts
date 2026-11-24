import { NextResponse } from "next/server";
import priceOutboundLinks from "../../../../content/outbound.generated.json";
import contract from "../../../../content/priceSnapshot.schema.json";
import type { PriceCategoryKey } from "../../../../lib/priceCategories";
import { getLocalMeta, getLocalPrices } from "../../../../lib/localPrices";
import type { OutboundLink } from "../../../../lib/outbound";
import { getPublicPriceSnapshot } from "../../../../lib/priceSnapshot";
import packageInfo from "../../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const categories = contract.categories.map(category => getLocalPrices(category as PriceCategoryKey));
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  // The collector verifies this snapshot against the prices and links it publishes together.
  const snapshot = getPublicPriceSnapshot(getLocalMeta(), categories, priceOutboundLinks as Record<string, OutboundLink>, contract);
  return NextResponse.json({ ...snapshot, version: packageInfo.version, commit: /^[a-f0-9]{40}$/i.test(commit) ? commit : null }, {
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
