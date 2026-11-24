import Link from "next/link";
import type { FullPcBoardRow } from "../lib/marketFullPc";
import { fmtWon, formatPriceTime } from "./PriceOffer";

export default function FullPcPriceAssessment({ row, peers }: { row: FullPcBoardRow; peers: readonly FullPcBoardRow[] }) {
  const { priceComparison, priceHold, quality, total, offer } = row;
  const price = total === null ? "확인 필요" : fmtWon(total);
  const previous = !row.checkedToday || row.unavailable;

  return <section id="fullpc-price-assessment" aria-labelledby="fullpc-price-title" className="space-y-3 rounded-xl border border-cyan-200/20 bg-slate-950/30 p-4">
    <h3 id="fullpc-price-title" className="font-semibold text-white">완본체 점수와 비교 근거</h3>
    <dl className="grid gap-2 text-sm sm:grid-cols-3">
      <div className="rounded-lg bg-white/5 p-3">
        <dt className="text-xs text-white/75">부품 확인 점수</dt>
        <dd className="mt-1 font-semibold tabular-nums text-cyan-100">{quality ? `${quality.confirmed}/40점` : "확인 중"}</dd>
        {quality && quality.score === null ? <dd className="mt-1 text-xs text-white/70">{quality.checked}/40개 기준 확인 · 종합 순위 대기</dd> : null}
      </div>
      <div className="rounded-lg bg-white/5 p-3">
        <dt className="text-xs text-white/75">가격 점수</dt>
        <dd className="mt-1 font-semibold tabular-nums text-cyan-100">{priceComparison ? `${priceComparison.points.toFixed(1)}/40점` : "비교 대기"}</dd>
        {priceComparison ? <dd className="mt-1 text-xs text-white/70">동일 비교군 {priceComparison.count}대</dd> : null}
      </div>
      <div className="rounded-lg bg-white/5 p-3">
        <dt className="text-xs text-white/75">{previous ? "이전 배송 포함 가격" : "배송 포함 기본가"}</dt>
        <dd className="mt-1 font-semibold tabular-nums text-white">{price}</dd>
        {offer?.checkedAt ? <dd className="mt-1 text-xs text-white/70">{formatPriceTime(offer.checkedAt)}</dd> : null}
      </div>
    </dl>
    {priceComparison && total !== null ? <div className="space-y-2 text-sm leading-6 text-white/80">
      <p>{row.comparison}</p>
      <p className="text-xs text-white/70">같은 CPU·GPU·운영체제라도 SSD 용량, 메인보드, 파워, 보증 조건이 다를 수 있습니다. 각 상품의 부품 평가와 함께 비교하세요.</p>
      <p>비교군의 최저 배송 포함 가격은 <strong className="text-cyan-100">{fmtWon(priceComparison.lowest)}</strong>입니다. {total > priceComparison.lowest ? `이 상품은 ${fmtWon(total - priceComparison.lowest)} 더 비쌉니다.` : "이 상품이 비교군 최저가입니다."}</p>
      <p className="text-xs text-white/70">가격 점수는 당일 비교군 최저가 ÷ 이 상품의 배송 포함 기본가 × 40입니다. 쿠폰·카드 할인과 적립은 점수 계산에서 제외합니다.</p>
      <ul className="divide-y divide-white/10 rounded-lg border border-white/10 px-3">
        {peers.map(peer => <li key={peer.product.id} className="grid min-w-0 gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
          <Link prefetch={false} href={`/products/${peer.product.id}#fullpc-configuration`} className="break-words text-cyan-200 underline underline-offset-4">
            {peer.product.name}
          </Link>
          <span className="text-sm tabular-nums text-white">{peer.total === null ? "확인 필요" : fmtWon(peer.total)}</span>
        </li>)}
      </ul>
    </div> : <p className="text-sm leading-6 text-amber-100">{priceHold ?? "같은 CPU·GPU·VRAM·운영체제로 당일 가격과 재고를 확인한 상품이 2대 이상이면 가격 점수를 계산합니다."}</p>}
    <div className="flex flex-wrap gap-x-5 text-sm text-cyan-200 underline underline-offset-4">
      <a href="#product-prices" className="inline-flex min-h-11 items-center">판매처 가격·할인 조건 보기</a>
      <Link prefetch={false} href={`/prices/fullpc?pcTier=${row.tier}#fullpc-picks`} className="inline-flex min-h-11 items-center">같은 급수 전체 보기</Link>
    </div>
  </section>;
}
