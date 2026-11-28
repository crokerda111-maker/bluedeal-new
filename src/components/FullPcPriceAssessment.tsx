import Link from "next/link";
import type { FullPcBoardRow } from "../lib/marketFullPc";
import { PC_PARTS } from "../lib/dailyPc";
import { pcMarketGroup } from "../lib/pcMarketGroups";
import { fmtWon, formatPriceTime } from "./PriceOffer";

export default function FullPcPriceAssessment({ row }: { row: FullPcBoardRow }) {
  const { priceComparison, priceHold, quality, total, offer } = row;
  const price = total === null ? "확인 필요" : fmtWon(total);
  const previous = !row.checkedToday || row.unavailable;

  return <section id="fullpc-price-assessment" aria-labelledby="fullpc-price-title" className="space-y-3 rounded-xl border border-cyan-200/20 bg-slate-950/30 p-4">
    <h3 id="fullpc-price-title" className="font-semibold text-white">완본체 점수와 비교 근거</h3>
    <dl className="grid gap-2 text-sm sm:grid-cols-3">
      <div className="rounded-lg bg-white/5 p-3">
        <dt className="text-xs text-white/75">부품 점수</dt>
        <dd className="mt-1 font-semibold tabular-nums text-cyan-100">{quality?.displayScore != null ? `${quality.displayScore}/40점` : "—"}</dd>
      </div>
      <div className="rounded-lg bg-white/5 p-3">
        <dt className="text-xs text-white/75">가격 점수</dt>
        <dd className="mt-1 font-semibold tabular-nums text-cyan-100">{priceComparison ? `${priceComparison.points.toFixed(1)}/40점` : "—"}</dd>
      </div>
      <div className="rounded-lg bg-white/5 p-3">
        <dt className="text-xs text-white/75">{previous ? "이전 배송 포함 가격" : "배송 포함 기본가"}</dt>
        <dd className="mt-1 font-semibold tabular-nums text-white">{price}</dd>
        {offer?.checkedAt ? <dd className="mt-1 text-xs text-white/70">{formatPriceTime(offer.checkedAt)}</dd> : null}
      </div>
    </dl>
    {priceComparison && total !== null ? <div className="space-y-2 text-sm leading-6 text-white/80">
      <p>당일 동일 부품 8종의 배송 포함 개별 구매 합계는 <strong className="text-cyan-100">{fmtWon(priceComparison.basket.total)}</strong>입니다.</p>
      <p className="text-xs text-white/70">가격 점수는 확인한 개별 부품 합계 ÷ 이 상품의 배송 포함 기본가 × 40이며, 최대 40점입니다. 개별가 기준에는 조립비, 운영체제, 본체 보증, 조건부 할인과 적립을 포함하지 않습니다.</p>
      <details className="rounded-lg border border-white/10 px-3 py-2">
        <summary className="cursor-pointer">부품별 가격·판매처</summary>
        <ul className="divide-y divide-white/10">
          {priceComparison.basket.parts.map(part => <li key={part.slot} className="break-words py-2">
            <a href={part.source} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline">{PC_PARTS[part.slot]} · {part.model}</a>
            <span className="block text-xs text-white/75">{fmtWon(part.price)} × {part.quantity} · 배송 {fmtWon(part.shipping)} · {formatPriceTime(part.checkedAt)}</span>
          </li>)}
        </ul>
      </details>
    </div> : <p className="text-sm leading-6 text-amber-100">{priceHold ?? "같은 부품 8종의 오늘 판매가와 배송비가 모두 확인되면 가격 점수를 표시합니다."}</p>}
    <div className="flex flex-wrap gap-x-5 text-sm text-cyan-200 underline underline-offset-4">
      <a href="#product-prices" className="inline-flex min-h-11 items-center">판매처 가격·할인 조건 보기</a>
      <Link prefetch={false} href={`/prices/fullpc?pc=${pcMarketGroup(row).key}#fullpc-picks`} className="inline-flex min-h-11 items-center">같은 CPU·GPU 조합 보기</Link>
    </div>
  </section>;
}
