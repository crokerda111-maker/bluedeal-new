import { MARKETPLACE_NAMES, type MarketPriceLink } from "../lib/productMarketplace";
import { catalogDate } from "../lib/productCatalog";
import SmartLink from "./SmartLink";

export default function MarketplacePriceLinks({ links, compact = false }: { links: readonly MarketPriceLink[]; compact?: boolean }) {
  const byMarket = new Map<string, MarketPriceLink>();
  for (const link of links) {
    const key = `${link.merchant}:${link.option ?? ""}`;
    if (!byMarket.has(key)) byMarket.set(key, link);
  }
  if (!byMarket.size) return null;

  return <ul className="flex flex-wrap gap-2" aria-label="판매처별 제휴 가격 링크">
    {[...byMarket.values()].map(link => <li key={link.goCode} className="min-w-0">
      <SmartLink
        href={`/go/${link.goCode}`}
        rel="sponsored noopener noreferrer"
        title={`${MARKETPLACE_NAMES[link.merchant]} ${link.option ? link.option + " " : ""}가격 확인 (새 창)`}
        className="inline-flex min-h-11 flex-wrap items-center gap-x-1.5 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        <span>{MARKETPLACE_NAMES[link.merchant]} 가격 확인</span>
        {link.option ? <span className="text-xs text-white/75">· {link.option}</span> : null}
        <span aria-hidden="true">↗</span>
      </SmartLink>
      {!compact && (link.seller || link.checkedOn) ? <span className="mt-1 block text-xs text-white/65">
        {[link.seller, link.checkedOn ? `판매주소 확인 ${catalogDate(link.checkedOn)}` : undefined].filter(Boolean).join(" · ")}
      </span> : null}
    </li>)}
  </ul>;
}
