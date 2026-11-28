import { PC_PARTS, type PcSlot } from "../lib/dailyPc";
import { separatePcTotal, type FullPcReview } from "../lib/fullPcReview";
import type { assessMarketplaceFullPc } from "../lib/marketplacePcQuality";
import { getPartEditorial } from "../lib/productEditorial";
import { asrockRyzen9000Advisory, getBoardPartExpansion, hasAsrockRyzen9000Advisory } from "../lib/motherboardExpansion";
import { fmtWon, formatPriceTime } from "./PriceOffer";
import MotherboardExpansion from "./MotherboardExpansion";
import PcPartDetailsDrawer from "./PcPartDetailsDrawer";

const sourceStyle = "text-cyan-200 underline underline-offset-4";

const purchaseChecks: Record<PcSlot, string> = {
  cpu: "CPU를 교체할 계획이면 보드의 지원 목록과 필요한 BIOS 버전을 확인하세요.",
  gpu: "그래픽카드를 교체할 계획이면 장착 길이, 두께, 파워의 보조전원 커넥터를 확인하세요.",
  board: "SSD나 메모리를 더 꽂을 계획이면 기본 부품이 사용하고 남은 슬롯과 슬롯 간 대역폭 공유 조건을 확인하세요.",
  ram: "증설할 때는 빈 슬롯과 메모리의 용량·속도·프로필 호환을 확인하세요.",
  storage: "설치할 게임·작업 파일 용량을 합산하고, SSD를 추가할 수 있는 슬롯이 남는지 확인하세요.",
  psu: "그래픽카드를 바꿀 때는 카드 제조사의 권장 출력과 실제 보조전원 커넥터를 함께 확인하세요.",
  cooler: "쿨러·RAM을 교체할 때는 케이스 높이 한도와 RAM 방열판 간섭을 확인하세요.",
  case: "그래픽카드 길이와 쿨러 높이, 수랭 라디에이터 장착 위치를 주문 전 확인하세요.",
};

export default function FullPcConfiguration({ review, quality }: { review: FullPcReview; quality: ReturnType<typeof assessMarketplaceFullPc> }) {
  const separateTotal = separatePcTotal(review);
  return <div className="space-y-4 text-sm leading-6">
    <div>
      <p className="mt-1 text-white/75">{review.condition} · {review.checkedOn} KST</p>
      <p className="mt-1 text-white/70">{review.integratedOffice ? "사무용 내장그래픽 구성 기준입니다. " : ""}부품별 점수에는 근거가 확인된 항목만 반영합니다. 자세히에서 사양과 근거를 볼 수 있습니다.</p>
      {review.purchaseTerms ? <p className="mt-1 text-white/75">{review.purchaseTerms.os} · {review.purchaseTerms.warranty} <a className={sourceStyle} href={review.purchaseTerms.source} target="_blank" rel="noopener noreferrer">조건 출처<span className="sr-only"> (새 창)</span></a></p> : null}
      {review.configurationConflict ? <p className="mt-2 rounded-lg bg-amber-500/10 p-3 text-amber-100">{review.configurationConflict}</p> : null}
    </div>
    <section aria-labelledby="fullpc-part-quality-title" className="space-y-2">
      <h3 id="fullpc-part-quality-title" className="font-semibold text-white">부품별 5점 평가</h3>
      <div className="divide-y divide-white/10 rounded-xl border border-white/15 bg-slate-950/25">
        {quality.slots.map(({ slot, points, checked, failed, criteria, facts, attention }) => {
          const editorial = getPartEditorial(review.parts[slot]);
          const board = slot === "board" && !review.configurationConflict ? getBoardPartExpansion(review.parts.board) : undefined;
          const stateColor = failed.length ? "text-amber-100" : points >= 4 ? "text-cyan-100" : "text-white/70";
          const summary = hasAsrockRyzen9000Advisory(board, review.parts.cpu) ? asrockRyzen9000Advisory.title : board?.sharing ?? attention ?? (failed.length ? `미충족 · ${failed.map(item => item.label).join(", ")}` :
            facts.find(item => item.evidence && (item.label === "게이밍 등급" || item.label === "제조사 라인업"))?.evidence?.[0]);
          return <div key={slot} data-part-quality={slot} className="px-3 pt-3 sm:px-4">
            <div className="grid min-w-0 gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto]">
              <span className="min-w-0 break-words"><span className="mr-2 font-semibold text-cyan-100">{PC_PARTS[slot]}</span>{" "}{review.parts[slot]}</span>
              <span className={`text-xs sm:text-right sm:text-sm ${stateColor}`}>
                <strong className="tabular-nums">{checked > 0 && !review.configurationConflict ? `${points}/5점` : "—"}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-1">
              {summary ? <span className={`min-w-0 break-words text-xs ${stateColor}`}>{summary}</span> : null}
              <PcPartDetailsDrawer part={PC_PARTS[slot]} model={review.parts[slot]}>
              <div className="space-y-3">
              {slot !== "cpu" && slot !== "gpu" && review.tested[slot]?.fact ? <p className="break-words text-white/75">{review.tested[slot].fact}</p> : null}
              <dl className="grid gap-2 sm:grid-cols-2">
                {facts.flatMap(({ label, evidence }) => !evidence || (board && (label === "PCIe·레인 공유" || (label === "전원부" && board.power))) ? [] : [
                  <div key={label} className="min-w-0 rounded-lg bg-white/5 p-2.5">
                    <dt className="font-medium text-cyan-100">{label}</dt>
                    <dd className="break-words text-white/75">{evidence[0]} <a className={sourceStyle} href={evidence[1]} target="_blank" rel="noopener noreferrer">출처<span className="sr-only"> (새 창)</span></a></dd>
                  </div>
                ])}
              </dl>
              {board ? <MotherboardExpansion profile={board} system cpu={review.parts.cpu} /> : null}
              <p className="font-medium text-white">채점 기준 {checked}/5개 확인</p>
              <ul className="space-y-1 text-xs leading-5 text-white/80">
                {criteria.filter(({ met }) => met !== null).map(({ label, met, source }) => <li key={label}>
                  <span className={met ? "text-cyan-100" : "text-amber-100"}>{met ? "충족" : "미충족"}</span> · {label}
                  {source ? <> <a className={sourceStyle} href={source} target="_blank" rel="noopener noreferrer">근거<span className="sr-only"> (새 창)</span></a></> : null}
                </li>)}
              </ul>
              <p className="text-white/75"><span className="font-medium text-amber-100">구매 전 확인</span> · {editorial?.caution ?? purchaseChecks[slot]}</p>
              {editorial?.issue ? <p className="text-amber-100">{editorial.issue.text} <a className={sourceStyle} href={editorial.issue.source} target="_blank" rel="noopener noreferrer">이슈 출처<span className="sr-only"> (새 창)</span></a></p> : null}
              </div>
              </PcPartDetailsDrawer>
            </div>
          </div>;
        })}
      </div>
      <p className="text-xs text-white/70">추가 사양·평가 근거 확인 {quality.checkedOn} KST</p>
    </section>
    {review.costComparison && separateTotal !== null ? <details className="rounded-xl border border-white/15 p-4 text-white/80">
      <summary className="cursor-pointer font-medium text-cyan-100">개별 구매 확인 기록 {fmtWon(separateTotal)} · 부품 8종, 배송, 조립, 동일 보증·OS 조건</summary>
      <dl className="mt-2 divide-y divide-white/10">
        {Object.entries(review.costComparison.parts).map(([slot, part]) => (
          <div key={slot} className="py-2">
            <dt className="font-medium text-white">{PC_PARTS[slot as PcSlot]} · {part.model}</dt>
            <dd>{fmtWon(part.price)} × {part.quantity} · 배송 {fmtWon(part.shipping)} · {formatPriceTime(part.checkedAt)} · <a className={sourceStyle} href={part.source} target="_blank" rel="noopener noreferrer">판매처 확인</a></dd>
          </div>
        ))}
        <div className="py-2">
          <dt className="font-medium text-white">조립·보증·OS</dt>
          <dd>{fmtWon(review.costComparison.assembly.price)} · 배송 {fmtWon(review.costComparison.assembly.shipping)} · {formatPriceTime(review.costComparison.assembly.checkedAt)} · <a className={sourceStyle} href={review.costComparison.assembly.source} target="_blank" rel="noopener noreferrer">서비스 확인</a></dd>
        </div>
      </dl>
    </details> : null}
    <ul className="list-disc space-y-1 pl-5 text-white/75">
      {review.notes.map(note => <li key={note}>{note}</li>)}
    </ul>
    <div className="flex flex-wrap gap-x-4">
      <a className={sourceStyle} href={review.sellerUrl} target="_blank" rel="noopener noreferrer">판매 페이지 <span className="sr-only">(새 창)</span></a>
      <a className={sourceStyle} href={review.partsUrl} target="_blank" rel="noopener noreferrer">판매처 부품표 <span className="sr-only">(새 창)</span></a>
      {review.gpuSource ? <a className={sourceStyle} href={review.gpuSource} target="_blank" rel="noopener noreferrer">GPU 권장 전원 <span className="sr-only">(새 창)</span></a> : null}
    </div>
  </div>;
}
