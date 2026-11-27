import Link from "next/link";
import { connection } from "next/server";
import { getOfferAffiliateCodes } from "../lib/affiliateStore";
import { previousFullPcRanks } from "../lib/fullPcRankStore";
import { buildFullPcBoard, buildHalfPcBoard, getFullPcPhoto, groupComparableFullPcs, orderFullPcBoard, type FullPcBoardRow } from "../lib/marketFullPc";
import { desktopGpuBenchmarks, groupMarketPcs, hasCurrentMarketPrice, homeMarketPcs, marketPcsUnderBudget, parsePcBudget, pcMarketGroup } from "../lib/pcMarketGroups";
import type { PcKind } from "../lib/dailyPc";
import type { PriceItem } from "../lib/mockPrices";
import { priceBenefits } from "../lib/priceBenefits";
import FullPcSpotlights from "./FullPcSpotlights";
import { fmtWon, formatPriceTime } from "./PriceOffer";
import ProductPhoto from "./ProductPhoto";

const fullBoard = "/prices/fullpc";

function PcCard({ row, now, affiliate, home, movement }: { row: FullPcBoardRow; now: number; affiliate: boolean; home: boolean; movement?: number }) {
  const { product, review, offer, total, checkedToday, quality, priceComparison, priceHold, placement, recommendation } = row;
  const Heading = home ? "h3" : "h4";
  const photo = home ? getFullPcPhoto(product.id) : undefined;
  const half = product.category === "halfpc";
  const combo = pcMarketGroup(row);
  const pending = priceHold ?? (priceComparison ? null : "같은 CPU·GPU·운영체제의 당일 비교 상품 확인 중");
  const priceLabel = total !== null ? fmtWon(total) : offer ? fmtWon(offer.price) : null;

  return <li data-fullpc-product={product.id} data-pc-combination={combo.key} className={home
    ? "min-w-0 rounded-xl border border-white/15 bg-slate-950/35 p-4"
    : "grid min-w-0 gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.42fr)] sm:px-4"}>
    <div className="min-w-0">
      {home ? <p className="mb-2 text-sm font-semibold text-cyan-200">{combo.label}</p> : null}
      {photo ? <div className="mb-3"><ProductPhoto photo={photo} detailHref={`/products/${product.id}`} /></div> : null}
      <p className="break-words text-xs leading-5 text-white/70">{[offer?.source, offer?.seller].filter(Boolean).join(" · ") || product.brand}</p>
      <Heading className="mt-1 break-words font-semibold leading-6 text-white">
        <Link prefetch={false} href={`/products/${product.id}#fullpc-configuration`} className="hover:underline focus-visible:underline">{product.name}</Link>
      </Heading>
      {row.cpu || row.gpu ? <p className="mt-1 break-words text-sm leading-6 text-white/80">{[row.cpu, row.gpu].filter(Boolean).join(" · ")}</p> : null}
      {row.boardPurchaseHold ? <p className="mt-2 text-xs leading-5 text-amber-100">ASRock AM5 + 라이젠 9000 · CPU 손상 사례 근거로 구매 비추천</p> : null}
      {!half ? <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:px-3">
          <dt className="text-xs text-white/75">부품 확인 점수</dt>
          <dd data-fullpc-parts-score className="mt-1 font-semibold tabular-nums text-cyan-100">
            {quality?.score != null ? `${quality.score}/40점` : quality ? `충족 ${quality.confirmed}개` : "확인 중"}
          </dd>
          {quality && quality.score === null ? <dd className="mt-1 text-xs text-white/70">{quality.checked}/40개 기준 확인</dd> : null}
        </div>
        <div className="min-w-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:px-3">
          <dt className="text-xs text-white/75">가격 점수</dt>
          <dd data-fullpc-price-score className="mt-1 font-semibold tabular-nums text-cyan-100">
            {priceComparison ? `${priceComparison.points.toFixed(1)}/40점` : "비교 대기"}
          </dd>
        </div>
      </dl> : null}
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
        <Link prefetch={false} href={`/products/${product.id}#fullpc-configuration`} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4">{half ? "부품 구성·구매 조건" : "구성·점수 근거"}</Link>
        {recommendation && offer?.goCode ? <a href={`/go/${offer.goCode}`} target="_blank" rel={affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-100 underline underline-offset-4">
          판매처 보기 ↗<span className="sr-only"> (새 창)</span>
        </a> : null}
      </div>
    </div>
  </li>;
}

export default async function MarketplaceFullPcPicks({
  items, now, home = false, kind = "fullpc", selectedGroup, selectedTier, budgetInput = "",
}: {
  items: readonly PriceItem[];
  now: number;
  home?: boolean;
  kind?: PcKind;
  selectedGroup?: string;
  selectedTier?: string;
  budgetInput?: string;
}) {
  const half = kind === "halfpc";
  const category = half ? "반본체" : "완본체";
  const route = half ? "/prices/halfpc" : fullBoard;
  const section = half ? "today-pc" : "fullpc-picks";
  const rows = (half ? buildHalfPcBoard(items, now) : buildFullPcBoard(items, now)).sort(orderFullPcBoard);
  const groups = groupMarketPcs(rows);
  const active = groups.find(group => group.key === selectedGroup);
  const selection = active?.rows ?? (rows.some(row => row.tier === selectedTier) ? rows.filter(row => row.tier === selectedTier) : rows);
  const budget = parsePcBudget(budgetInput);
  const results = budget ? marketPcsUnderBudget(selection, budget, now) : null;
  const visibleGroups = results ? groupMarketPcs(results.priced) : groupMarketPcs(selection);
  const spotlights = home ? homeMarketPcs(rows.filter(row => getFullPcPhoto(row.product.id)), now) : [];
  const displayedRows = home ? spotlights : visibleGroups.flatMap(group => group.rows);
  const recommendable = displayedRows.flatMap(row => row.recommendation && row.offer ? [row.offer] : []);
  const hasRanks = !home && displayedRows.some(row => row.placement);
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
  const leader = results?.gaming[0];
  const groupsToShow = leader ? visibleGroups.sort((a, b) => Number(b.rows.includes(leader)) - Number(a.rows.includes(leader))) : visibleGroups;

  return (
    <section id={section} aria-labelledby={section + "-title"} className="bd-surface scroll-mt-24 space-y-5 p-5 sm:p-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading id={section + "-title"} className="text-3xl font-semibold tracking-tight sm:text-4xl">{home ? "오늘의 완본체 베스트" : category + " 조합·예산 비교"}</Heading>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">
            {home ? "서로 다른 CPU·그래픽카드 조합을 한눈에 비교하세요." : half
              ? "CPU 조합과 가격을 보고, 장착할 그래픽카드에 맞는 파워와 케이스를 확인하세요."
              : "CPU와 그래픽카드 조합을 선택하거나 예산으로 검색하세요. 배송비를 포함하고 쿠폰·카드 할인은 별도로 표시합니다."}
          </p>
        </div>
        {home ? <div className="flex flex-wrap items-center gap-x-3">
          <Link prefetch={false} href={fullBoard + "#fullpc-picks"} className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100">
            완본체 조합·예산 비교 →
          </Link>
          <Link prefetch={false} href="/prices/halfpc#today-pc" className="inline-flex min-h-11 items-center text-sm text-cyan-100 underline underline-offset-4">반본체 비교</Link>
        </div> : null}
      </header>

      {affiliateCodes.size ? <p role="note" className="border-l-2 border-cyan-300 pl-3 text-sm leading-6 text-white/85">
        이 섹션의 일부 구매 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다.
      </p> : null}

      {home ? <>
        {spotlights.some(row => !row.recommendation) ? <p className="text-sm leading-6 text-white/75">구매 전 확인이 필요한 후보는 카드에 이유와 가격 확인일을 표시합니다.</p> : null}
        {spotlights.length ? <FullPcSpotlights cards={spotlights.map(row => ({ key: pcMarketGroup(row).key, card: card(row) }))} /> :
          <p className="text-sm text-amber-100">판매가와 CPU·GPU 조합을 확인한 후보가 없습니다.</p>}
      </> : <>
        <form action={route + "#" + section} method="get" className="grid gap-3 rounded-xl border border-white/15 bg-slate-950/30 p-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1.4fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor={section + "-budget"} className="block text-sm font-medium text-white">최대 예산 (원)</label>
            <input id={section + "-budget"} name="pcBudget" key={budgetInput} defaultValue={budgetInput} placeholder="200만원 또는 2,000,000" maxLength={24}
              className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
              aria-invalid={budgetInput.trim() && budget === null ? true : undefined} />
          </div>
          <div className="min-w-0">
            <label htmlFor={section + "-group"} className="block text-sm font-medium text-white">{half ? "CPU 조합" : "CPU·GPU 조합"}</label>
            <select id={section + "-group"} name="pc" key={active?.key ?? ""} defaultValue={active?.key ?? ""}
              className="mt-1 min-h-11 w-full rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
              <option value="">전체 조합</option>
              {groups.map(group => <option value={group.key} key={group.key}>{group.label} ({group.rows.length})</option>)}
            </select>
          </div>
          <button type="submit" className="min-h-11 rounded-lg bg-cyan-200 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-100">비교하기</button>
        </form>
        {budgetInput.trim() && budget === null ? <p role="alert" className="text-sm text-amber-100">예산을 원 단위 숫자나 200만원 형식으로 입력해 주세요.</p> : null}
        {results && budget ? <div className="space-y-2 rounded-xl border border-cyan-200/25 bg-cyan-200/5 p-4" data-pc-budget={budget}>
          <h3 className="font-semibold text-cyan-100">{fmtWon(budget)} 이하 · 오늘 재고·가격 확인 {results.current.length}대</h3>
          <p className="text-sm leading-6 text-white/75">배송 포함 일반가 기준입니다. 이전에 확인한 가격은 아래 카드에서 확인일과 함께 볼 수 있습니다.</p>
          {leader ? <>
            <p className="text-sm font-semibold text-white" data-budget-leader>{leader.recommendation ? "예산 내 구성 추천" : "QHD 게이밍 성능 우선 후보"} · {pcMarketGroup(leader).label} · {fmtWon(leader.total!)}</p>
            <Link prefetch={false} href={"/products/" + leader.product.id + "#fullpc-configuration"} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4">{leader.product.name}</Link>
            {leader.priceHold ? <p className="text-sm text-amber-100">{leader.priceHold}</p> : null}
            <details className="text-xs leading-6 text-white/75">
              <summary className="cursor-pointer text-cyan-200">게이밍 후보 선정 기준</summary>
              <p>QHD 기본 렌더링 실측에서 비슷한 GPU를 같은 성능 범위로 묶었습니다. 같은 범위에서는 부품 근거와 같은 조건의 확인 여부, 가격을 함께 봅니다. 게임별 결과, 레이 트레이싱, CPU에 민감한 게임과 작업 성능은 달라질 수 있습니다.</p>
              <a className="underline underline-offset-4" target="_blank" rel="noopener noreferrer" href={desktopGpuBenchmarks}>GamersNexus GPU 실측 자료 (새 창)</a>
            </details>
          </> : <p className="text-sm text-amber-100">{half ? "그래픽카드와 합산한 전체 예산을 장착 조건과 함께 확인하세요." :
            "이 예산에서 당일 판매가와 재고를 확인한 게이밍 성능 후보가 없습니다."}</p>}
          <Link prefetch={false} href={route + "#" + section} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4">예산·선택 초기화</Link>
        </div> : null}
        {!groupsToShow.length ? <p className="text-sm text-white/75">이 조건에 맞는 배송 포함 가격 기록이 없습니다.</p> : null}
        {groupsToShow.map(group => {
          const comparable = [...groupComparableFullPcs(group.rows.filter(row => row.placement))];
          const rest = group.rows.filter(row => !row.placement).sort((a, b) =>
            Number(hasCurrentMarketPrice(b, now)) - Number(hasCurrentMarketPrice(a, now)) ||
            (results ? (a.total ?? Infinity) - (b.total ?? Infinity) : 0) || orderFullPcBoard(a, b),
          );
          return <details key={group.key} open={Boolean(active) || Boolean(results) || group.rows.some(row => row.placement)}
            className="space-y-3 rounded-xl border border-white/15 bg-slate-950/25 p-3 sm:p-4" data-pc-combination-group={group.key}>
            <summary className="min-h-11 cursor-pointer py-2 text-base font-semibold text-white">
              {group.label} <span className="text-sm font-normal text-white/65">· {group.rows.length}대</span>
            </summary>
            {comparable.map(([comparison, ranked]) => <div key={comparison} className="space-y-2">
              <p className="px-3 text-sm font-semibold text-cyan-100">{comparison} · {ranked[0].placement?.mode === "price" ? "배송 포함 가격순" : "종합 순위"}</p>
              <ol className="divide-y divide-white/10">{ranked.sort((a, b) => a.placement!.rank - b.placement!.rank).map(card)}</ol>
            </div>)}
            {rest.length ? <ul className="divide-y divide-white/10">{rest.map(card)}</ul> : null}
          </details>;
        })}
        {!half ? <p className="text-xs leading-5 text-white/70">가격 점수는 같은 CPU·GPU·VRAM·운영체제의 당일 배송 포함 가격을 상품 2대 이상에서 확인하면 계산합니다.</p> : null}
      </>}
    </section>
  );
}
