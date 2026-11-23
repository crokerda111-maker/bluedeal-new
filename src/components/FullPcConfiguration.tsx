import { PC_PARTS, type PcSlot } from "../lib/dailyPc";
import { scoreFullPcParts, separatePcTotal, type FullPcReview } from "../lib/fullPcReview";
import { getPartEditorial } from "../lib/productEditorial";
import { fmtWon, formatPriceTime } from "./PriceOffer";

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

export default function FullPcConfiguration({ review }: { review: FullPcReview }) {
  const { score, range, slots } = scoreFullPcParts(review);
  const separateTotal = separatePcTotal(review);
  return <div className="space-y-4 text-sm leading-6">
    <div>
      <p className="font-semibold text-cyan-100">{score === null ? "부품 구성 점수 확인 중" : `부품 구성 점수 ${score}/100`}</p>
      {score === null ? <p className="mt-1 text-white/75">확인된 사양으로 계산한 범위 {range[0]}–{range[1]}/100 · 미확인 항목에 따라 달라집니다.</p> : null}
      <p className="mt-1 text-white/75">{review.condition} · {review.checkedOn} KST</p>
      <p className="mt-1 text-white/70">{review.integratedOffice ? "사무용 내장그래픽 구성 기준입니다. 16GB 메모리와 500GB SSD부터 평가합니다." : "CPU와 GPU·VRAM은 비교할 성능 급을 정합니다. 부품 구성 점수는 확장성·용량·전원·냉각 사양의 충족도를 표시합니다."} 결제금액, 보증, 실측 발열·소음은 별도로 확인하세요.</p>
      {review.purchaseTerms ? <p className="mt-1 text-white/75">{review.purchaseTerms.os} · {review.purchaseTerms.warranty} <a className={sourceStyle} href={review.purchaseTerms.source} target="_blank" rel="noopener noreferrer">조건 출처<span className="sr-only"> (새 창)</span></a></p> : null}
      {review.comparisonStatus ? <p className="mt-1 text-amber-100">{review.comparisonStatus}</p> : null}
      {review.configurationConflict ? <p className="mt-1 text-amber-100">{review.configurationConflict}</p> : null}
      {review.notForSale ? <p className="mt-1 text-amber-100">확인 시점에 이 판매번호의 주문이 중단돼 있습니다.</p> : null}
    </div>
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
    <dl className="divide-y divide-white/10 border-y border-white/10">
      {Object.entries(PC_PARTS).map(([slot, label]) => {
        const part = slot as keyof typeof PC_PARTS;
        const assessment = slots.find(item => item.slot === part);
        const editorial = getPartEditorial(review.parts[part]);
        const singleModule = part === "ram" && assessment?.criteria[1]?.met === false;
        const caution = editorial?.caution ?? (singleModule
          ? "메모리 모듈이 한 개입니다. 두 모듈 구성이 필요하면 같은 규격의 모듈과 추가 장착 비용을 확인하세요."
          : purchaseChecks[part]);
        return <div key={slot} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-white/70">{label}</dt>
          <dd className="min-w-0 break-words">
            <p className="font-medium text-white">{review.parts[part]}</p>
            {editorial ? <p className="mt-2 text-white/80"><span className="font-semibold text-cyan-100">장점</span> · {editorial.advantage} <a className={sourceStyle} href={editorial.source} target="_blank" rel="noopener noreferrer">근거<span className="sr-only"> (새 창)</span></a></p> : null}
            <p className="mt-1 text-white/75"><span className="font-medium text-amber-100">구매 전 확인</span> · {caution}</p>
            {editorial?.issue ? <p className="mt-1 text-amber-100">{editorial.issue.text} <a className={sourceStyle} href={editorial.issue.source} target="_blank" rel="noopener noreferrer">이슈 출처<span className="sr-only"> (새 창)</span></a></p> : null}
            {assessment ? <>
              <p className="mt-1 text-white/75">{assessment.fact}</p>
              <p className="text-xs font-semibold text-cyan-100">{Number(assessment.earned.toFixed(1))}/{assessment.weight}점 충족{assessment.pending ? " · 일부 사양 확인 필요" : ""}</p>
              <ul className="mt-1 space-y-1 text-xs text-white/75">
                {assessment.criteria.map(({ label, met }) => <li key={label}><span className={met === true ? "text-cyan-100" : "text-amber-100"}>{met === null ? "확인 필요" : met ? "충족" : "미충족"}</span> · {label}</li>)}
              </ul>
              {assessment.url ? <a className={sourceStyle} href={assessment.url} target="_blank" rel="noopener noreferrer">사양 근거 <span className="sr-only">(새 창)</span></a> : null}
            </> : null}
          </dd>
        </div>;
      })}
    </dl>
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
