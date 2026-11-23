import Link from "next/link";
import { connection } from "next/server";
import { getOfferAffiliateCodes } from "../lib/affiliateStore";
import { selectMarketplaceFullPcs } from "../lib/marketFullPc";
import type { PriceItem } from "../lib/mockPrices";
import { fmtWon, formatPriceTime } from "./PriceOffer";

export default async function MarketplaceFullPcPicks({
  items, now, home = false,
}: { items: readonly PriceItem[]; now: number; home?: boolean }) {
  const candidates = selectMarketplaceFullPcs(items, now);
  const eligible = candidates.filter(candidate => candidate.current && candidate.savings && candidate.savings.amount > 0);
  if (eligible.length) await connection();
  const affiliateCodes = eligible.length ? await getOfferAffiliateCodes(eligible.map(candidate => candidate.offer)) : new Set<string>();
  const today = eligible.filter(candidate => affiliateCodes.has(candidate.offer.goCode ?? ""))
    .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);
  const picks = today.length ? today : candidates.sort((a, b) => Number(b.checkedToday) - Number(a.checkedToday)).slice(0, 3);
  const Heading = home ? "h1" : "h2";
  const productHref = (id: string) => `/products/${id}#fullpc-configuration`;

  return (
    <section id="fullpc-picks" aria-labelledby="fullpc-picks-title" className="bd-surface scroll-mt-24 space-y-5 p-5 sm:p-7">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading id="fullpc-picks-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">오늘의 완본체 베스트</Heading>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
            CPU·그래픽카드부터 메인보드·파워까지 살펴보고, 배송비 포함 가격으로 비교하세요.
          </p>
        </div>
        {home ? <Link prefetch={false} href="/prices/fullpc" className="inline-flex min-h-11 shrink-0 items-center self-start rounded-xl bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
          완본체 전체 비교 <span className="ml-2" aria-hidden="true">→</span>
        </Link> : null}
      </header>

      {today.length ? (
        <p role="note" className="border-l-2 border-cyan-300 pl-3 text-sm leading-6 text-white/85">
          이 섹션의 구매 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다.
        </p>
      ) : (
        <p className="rounded-xl border border-white/10 bg-slate-950/35 px-4 py-3 text-sm leading-6 text-white/80">
          오늘 가격·재고·구성·보증과 개별 구매 대비 절약을 모두 확인한 제휴 추천 상품이 없습니다.
          {picks.length ? " 아래 후보에서 확인한 구성·가격과 남은 확인 사항을 볼 수 있습니다." : ""}
        </p>
      )}

      {picks.length ? <ul className="grid gap-3 md:grid-cols-2">
        {picks.map(({ product, review, offer, total, score, range, merchant, checkedToday, savings }) => (
          <li key={product.id} className="min-w-0 rounded-xl border border-white/15 bg-slate-950/35 p-4">
            <p className="break-words text-xs leading-5 text-white/75">{[offer.source, offer.seller].filter(Boolean).join(" · ")}</p>
            <h3 className="mt-1 break-words font-semibold leading-6 text-white">
              <Link prefetch={false} href={productHref(product.id)} className="hover:underline focus-visible:underline">{product.name}</Link>
            </h3>
            <p className="mt-2 break-words text-sm leading-6 text-white/80">{review.parts.cpu} · {review.parts.gpu}</p>
            <p className="mt-2 text-sm font-medium text-cyan-100">
              {score === null ? `부품 구성 ${range.join("–")}/100점 · 일부 항목 확인 필요` : `부품 구성 ${score}/100점`}
            </p>
            {total !== null ? <p className="mt-3 text-lg font-semibold leading-6 text-white">
              {fmtWon(total)} <span className="text-xs font-normal text-white/75">{checkedToday ? "기본 배송 포함 · 할인 전" : "이전 관측가 · 기본 배송 포함"}</span>
            </p> : null}
            {checkedToday && offer.instantPrice && typeof offer.shippingFee === "number" ? <p className="mt-1 text-xs leading-5 text-white/80">추가할인 표시가 {fmtWon(offer.instantPrice + offer.shippingFee)} · 적용 조건 판매처 확인</p> : null}
            {checkedToday && !review.purchaseTerms ? <p className="mt-1 text-xs leading-5 text-amber-100">이 판매번호의 보증 조건 확인 필요</p> : null}
            {today.length && review.purchaseTerms ? <p className="mt-1 text-xs leading-5 text-white/80">{review.purchaseTerms.os} · {review.purchaseTerms.warranty}</p> : null}
            {today.length && savings ? <p className="mt-1 text-xs leading-5 text-white/80">같은 조건 개별 구매 대비 {fmtWon(Math.abs(savings.amount))} ({Math.abs(savings.percent).toFixed(1)}%) {savings.amount >= 0 ? "절약" : "추가 비용"}</p> : null}
            <p className="mt-1 text-xs leading-5 text-white/65">가격 {formatPriceTime(offer.checkedAt)} 확인 · 구성 {review.checkedOn} 확인</p>
            {review.notes[0] ? <p className="mt-2 text-xs leading-5 text-white/80">{review.notes[0]}</p> : null}
            {today.length && merchant === "coupang" ? <p role="note" className="mt-2 text-xs leading-5 text-white/85">
              이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
            </p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-4">
              <Link prefetch={false} href={productHref(product.id)} className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-200 underline underline-offset-4">부품 구성·점수 근거</Link>
              {today.length && offer.goCode ? <a href={`/go/${offer.goCode}`} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-100 underline underline-offset-4">
                판매처 보기 ↗<span className="sr-only"> (새 창)</span>
              </a> : null}
            </div>
          </li>
        ))}
      </ul> : null}
      <p className="text-xs leading-5 text-white/70">쿠폰·카드·적립은 기본 가격과 별도입니다. 보증, Windows 포함 여부와 최종 결제액은 상세에서 확인하세요.</p>
    </section>
  );
}
