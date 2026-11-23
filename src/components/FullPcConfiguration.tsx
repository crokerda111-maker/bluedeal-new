import { PC_PARTS } from "../lib/dailyPc";
import { scoreFullPcParts, type FullPcReview } from "../lib/fullPcReview";

const sourceStyle = "text-cyan-200 underline underline-offset-4";

export default function FullPcConfiguration({ review }: { review: FullPcReview }) {
  const { score, slots } = scoreFullPcParts(review);
  return <div className="space-y-4 text-sm leading-6">
    <div>
      <p className="font-semibold text-cyan-100">{score === null ? "부품 구성 점수 확인 중" : `부품 구성 점수 ${score}/100`}</p>
      <p className="mt-1 text-white/75">{review.condition} · {review.checkedOn} KST</p>
      <p className="mt-1 text-white/70">CPU와 GPU·VRAM은 비교할 성능 급을 정합니다. 부품 구성 점수는 확장성·용량·전원·냉각 사양의 충족도를 표시합니다. 결제금액, 보증, 실측 발열·소음은 별도로 확인하세요.</p>
    </div>
    <dl className="divide-y divide-white/10 border-y border-white/10">
      {Object.entries(PC_PARTS).map(([slot, label]) => {
        const part = slot as keyof typeof PC_PARTS;
        const assessment = slots.find(item => item.slot === part);
        return <div key={slot} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 py-3">
          <dt className="text-white/70">{label}</dt>
          <dd className="min-w-0 break-words">
            <p className="font-medium text-white">{review.parts[part]}</p>
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
      <a className={sourceStyle} href={review.gpuSource} target="_blank" rel="noopener noreferrer">GPU 권장 전원 <span className="sr-only">(새 창)</span></a>
    </div>
  </div>;
}
