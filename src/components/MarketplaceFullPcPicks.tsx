import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import fullPcPhotos from "../content/products/fullPcPhotos.json";
import { getOfferAffiliateCodes } from "../lib/affiliateStore";
import { FULL_PC_TIERS, GAMING_TIERS, type FullPcTier } from "../lib/fullPcTiers";
import { previousFullPcRanks } from "../lib/fullPcRankStore";
import { buildFullPcBoard, groupComparableFullPcs, homeFullPcCandidates, orderFullPcBoard, type FullPcBoardRow } from "../lib/marketFullPc";
import type { PriceItem } from "../lib/mockPrices";
import { priceBenefits } from "../lib/priceBenefits";
import FullPcSpotlights from "./FullPcSpotlights";
import { fmtWon, formatPriceTime } from "./PriceOffer";

const allTiers = Object.keys(FULL_PC_TIERS) as FullPcTier[];
const fullBoard = "/prices/fullpc";
const tierHref = (tier?: FullPcTier) => `${fullBoard}${tier ? `?pcTier=${tier}` : ""}#fullpc-picks`;

function PcCard({ row, now, affiliate, home, movement }: { row: FullPcBoardRow; now: number; affiliate: boolean; home: boolean; movement?: number }) {
  const { product, review, offer, total, checkedToday, score, range, priceScore, comparison, placement, recommendation } = row;
  const Heading = home ? "h3" : "h4";
  const photo = home ? fullPcPhotos[product.id as keyof typeof fullPcPhotos] : undefined;
  const pending = row.unavailable ? "현재 판매 중 아님" : review?.configurationConflict ?? (
    comparison ? (placement ? undefined : "같은 CPU·GPU·운영체제의 비교 상대 확인 중")
      : !review ? "정확한 부품 모델·보증 검토 대기"
      : !checkedToday ? "당일 가격·재고 재확인 필요"
      : !review.purchaseTerms ? "보증·Windows 구매 조건 확인 필요"
      : score === null ? "일부 부품 점수 확인 필요"
      : "구성·재고를 다시 대조한 뒤 순위에 반영합니다."
  );
  const priceLabel = total !== null ? fmtWon(total) : offer ? fmtWon(offer.price) : null;

  return <li data-fullpc-product={product.id} data-pc-tier={row.tier} className={home
    ? "min-w-0 rounded-xl border border-white/15 bg-slate-950/35 p-4"
    : "grid min-w-0 gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.42fr)] sm:px-4"}>
    <div className="min-w-0">
      {home ? <p className="mb-2 text-sm font-semibold text-cyan-200">{FULL_PC_TIERS[row.tier].label}</p> : null}
      {photo ? <figure className="mb-3">
        <div className="h-40 overflow-hidden rounded-lg bg-slate-100 sm:h-44">
          <Image data-fullpc-photo src={photo.src} alt={photo.alt} width={480} height={480} unoptimized className="h-full w-full object-contain" />
        </div>
        <figcaption className="mt-1 text-xs leading-5 text-white/70">
          <a href={photo.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">사진 출처 · {photo.sourceLabel}<span className="sr-only"> (새 창)</span></a>
          {" · 실제 출고 구성은 옵션 확인"}
        </figcaption>
      </figure> : null}
      <p className="break-words text-xs leading-5 text-white/70">{[offer?.source, offer?.seller].filter(Boolean).join(" · ") || product.brand}</p>
      <Heading className="mt-1 break-words font-semibold leading-6 text-white">
        <Link prefetch={false} href={`/products/${product.id}#fullpc-configuration`} className="hover:underline focus-visible:underline">{product.name}</Link>
      </Heading>
      {row.cpu || row.gpu ? <p className="mt-1 break-words text-sm leading-6 text-white/80">{[row.cpu, row.gpu].filter(Boolean).join(" · ")}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:px-3">
          <dt className="text-xs text-white/75">부품 점수</dt>
          <dd data-fullpc-parts-score className="mt-1 font-semibold tabular-nums text-cyan-100">
            {score !== null ? `${score}/100점` : range ? `${range.join("–")}/100점` : "확인 중"}
          </dd>
        </div>
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:px-3">
          <dt className="text-xs text-white/75">가격 점수</dt>
          <dd data-fullpc-price-score className="mt-1 font-semibold tabular-nums text-cyan-100">
            {priceScore !== undefined ? `${priceScore.toFixed(1)}/40점` : "비교 대기"}
          </dd>
        </div>
      </dl>
      {placement ? <p className="mt-2 text-sm text-white/85">{placement.mode === "score"
        ? `종합 ${placement.rank}위 (${placement.points.toFixed(1)}/100점)`
        : `배송 포함 가격순 ${placement.rank}위`}</p> : null}
      {movement ? <p className="mt-1 text-xs text-white/75">전날 기준 {Math.abs(movement)}단계 {movement > 0 ? "상승 ↑" : "하락 ↓"}</p> : null}
      {recommendation ? <p className="mt-1 text-sm text-cyan-100">동일 부품 개별 구매 대비 {fmtWon(recommendation.amount)} ({recommendation.percent.toFixed(1)}%) 절약</p> : null}
      {pending ? <p className="mt-1 text-xs leading-5 text-amber-100">{pending}</p> : null}
      {home && review?.comparisonStatus ? <p className="mt-1 text-xs leading-5 text-white/75">{review.comparisonStatus}</p> : null}
    </div>
    <div className="min-w-0">
      {priceLabel ? <p className="text-lg font-semibold leading-6 text-white">
        {priceLabel} <span className="text-xs font-normal text-white/75">{checkedToday && !row.unavailable ? "할인 전" : "이전 관측가"} · {total === null ? "배송 확인 필요" : "기본 배송 포함"}</span>
      </p> : <p className="text-sm text-white/65">확인된 판매가 없음</p>}
      {checkedToday && offer && !row.unavailable && priceBenefits(offer, now).filter(benefit => benefit.kind !== "card" &&
        benefit.state !== "expired" && benefit.state !== "upcoming").map(benefit => (
        <p key={benefit.kind} className="mt-1 text-xs leading-5 text-white/80">
          {benefit.kind === "instant" ? "추가할인" : "쿠폰"} 표시가 {fmtWon(benefit.amount)} · 조건 확인
        </p>
      ))}
      {offer ? <p className="mt-1 text-xs leading-5 text-white/65">가격 확인 {formatPriceTime(offer.checkedAt)}</p> : null}
      {review?.purchaseTerms && home ? <p className="mt-1 text-xs leading-5 text-white/75">{review.purchaseTerms.os} · {review.purchaseTerms.warranty}</p> : null}
      {recommendation && row.merchant === "coupang" && affiliate ? <p role="note" className="mt-2 text-xs leading-5 text-white/85">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <Link prefetch={false} href={`/products/${product.id}#fullpc-configuration`} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4">구성·점수 근거</Link>
        {recommendation && offer?.goCode ? <a href={`/go/${offer.goCode}`} target="_blank" rel={affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-100 underline underline-offset-4">
          판매처 보기 ↗<span className="sr-only"> (새 창)</span>
        </a> : null}
      </div>
    </div>
  </li>;
}

export default async function MarketplaceFullPcPicks({
  items, now, home = false, selectedTier,
}: { items: readonly PriceItem[]; now: number; home?: boolean; selectedTier?: string }) {
  const rows = buildFullPcBoard(items, now);
  const activeTier = allTiers.find(tier => tier === selectedTier);
  const visibleTiers = activeTier ? [activeTier] : allTiers;
  const recommendable = rows.flatMap(row => row.recommendation && row.offer ? [row.offer] : []);
  const hasRanks = !home && rows.some(row => row.placement && visibleTiers.includes(row.tier));
  if (recommendable.length || hasRanks) await connection();
  const [affiliateCodes, previousRanks] = await Promise.all([
    recommendable.length ? getOfferAffiliateCodes(recommendable) : new Set<string>(),
    hasRanks ? previousFullPcRanks(now) : new Map(),
  ]);
  const Heading = home ? "h1" : "h2";
  const card = (row: FullPcBoardRow) => {
    const old = previousRanks.get(row.product.id);
    const movement = old && row.placement && old.comparison === row.comparison && old.mode === row.placement.mode
      ? old.rank - row.placement.rank : undefined;
    return <PcCard key={row.product.id} row={row} now={now} affiliate={affiliateCodes.has(row.offer?.goCode ?? "")} home={home} movement={movement} />;
  };

  return (
    <section id="fullpc-picks" aria-labelledby="fullpc-picks-title" className="bd-surface scroll-mt-24 space-y-5 p-5 sm:p-7">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading id="fullpc-picks-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">{home ? "오늘의 완본체 베스트" : "급수별 완본체 비교"}</Heading>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
            {home ? "실속형·균형형·상급형에서 한 대씩 확인하세요." : "급수는 그래픽카드 모델로 나눕니다. 같은 CPU·그래픽카드·VRAM·운영체제의 당일 확인 상품끼리 부품 60점, 배송 포함 가격 40점으로 비교합니다."}
          </p>
        </div>
        {home ? <Link prefetch={false} href={tierHref()} className="inline-flex min-h-11 shrink-0 items-center self-start rounded-xl bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">
          급수별 전체 비교 <span className="ml-2" aria-hidden="true">→</span>
        </Link> : null}
      </header>

      {affiliateCodes.size ? <p role="note" className="border-l-2 border-cyan-300 pl-3 text-sm leading-6 text-white/85">
        이 섹션의 일부 구매 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다.
      </p> : null}
      {!recommendable.length && home ? <p className="text-sm leading-6 text-white/75">
        오늘은 동일 부품 개별 구매 총액까지 검증한 추천 상품이 없어 확인 중인 후보를 표시합니다.
      </p> : null}

      {home ? <FullPcSpotlights groups={GAMING_TIERS.map((tier, index) => {
        const candidates = homeFullPcCandidates(rows, tier);
        const seed = Math.imul(Math.floor(now / 300_000) + index, 2654435761) >>> 0;
        const start = candidates.length ? seed % candidates.length : 0;
        return { tier, cards: candidates.length ? [...candidates.slice(start), ...candidates.slice(0, start)].map(card) : [
          <li key={tier} data-pc-tier={tier} className="rounded-xl border border-white/15 bg-slate-950/35 p-4">
            <h3 className="font-semibold text-cyan-100">{FULL_PC_TIERS[tier].label}</h3>
            <p className="mt-2 text-sm text-white/75">구매 가능 후보 확인 중</p>
            <Link prefetch={false} href={tierHref(tier)} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline">이 급수 상품 보기</Link>
          </li>,
        ] };
      })} /> : <>
        <nav aria-label="완본체 급수 선택" className="flex flex-wrap gap-2">
          {([undefined, ...allTiers] as const).map(tier => (
            <Link key={tier ?? "all"} prefetch={false} href={tierHref(tier)} aria-current={activeTier === tier ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200 ${activeTier === tier ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/20 text-white/85 hover:bg-white/10"}`}>
              {tier ? FULL_PC_TIERS[tier].label : "전체"} ({tier ? rows.filter(row => row.tier === tier).length : rows.length})
            </Link>
          ))}
        </nav>
        {visibleTiers.map(tier => {
          const tierRows = rows.filter(row => row.tier === tier);
          const groups = groupComparableFullPcs(tierRows.filter(row => row.placement));
          const pending = tierRows.filter(row => !row.placement).sort(orderFullPcBoard);
          return <section key={tier} aria-labelledby={`fullpc-${tier}-title`} className="space-y-3 rounded-xl border border-white/15 p-3 sm:p-4">
            <h3 id={`fullpc-${tier}-title`} className="text-lg font-semibold text-white">{FULL_PC_TIERS[tier].label} <span className="text-sm text-white/65">· {tierRows.length}대</span></h3>
            <p className="text-sm text-white/75">{FULL_PC_TIERS[tier].description}</p>
            {[...groups].map(([comparison, group]) => <div key={comparison} className="space-y-2">
              <p className="text-sm font-semibold text-cyan-100">{comparison} · {group[0].placement?.mode === "price" ? "배송 포함 가격순 · 종합점수 확인 중" : "종합 순위"}</p>
              <ol className="divide-y divide-white/10">{group.sort((a, b) => (a.placement?.rank ?? 0) - (b.placement?.rank ?? 0)).map(card)}</ol>
            </div>)}
            {pending.length ? <details open={Boolean(activeTier) || pending.length < 7} className="rounded-lg bg-slate-950/30">
              <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm text-cyan-100">비교 대기·판매 기록 {pending.length}대</summary>
              <ul className="divide-y divide-white/10">{pending.map(card)}</ul>
            </details> : !tierRows.length ? <p className="text-sm text-white/65">등록된 구성 없음</p> : null}
          </section>;
        })}
        <p className="text-xs leading-5 text-white/70">가격 점수는 같은 사양군의 당일 최저 배송 포함 가격 ÷ 해당 배송 포함 가격 × 40입니다. 비교할 상품이 2대 이상일 때 계산합니다. 조건부 할인과 적립은 순위 계산에서 제외합니다.</p>
      </>}
    </section>
  );
}
