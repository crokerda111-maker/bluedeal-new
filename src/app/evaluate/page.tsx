import Link from "next/link";
import { PART_DOSSIERS } from "../../content/partDossiers";
import { pageMetadata } from "../../lib/site";
import { readCostScenario, SCENARIO_FIELDS, type Evidence } from "../../lib/valueAssessment";

export const metadata = pageMetadata("PC 구매 판단·구성 비교 | BLUEDEAL", "완본체·반본체와 동일 부품 직접 구매 비용을 비교하고, 부품의 장점과 확인된 이슈를 살펴보세요.", "/evaluate", true);
const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const inputClass = "mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-[#060B1A] px-3 py-2 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";
function Sources({ sources }: { sources: Evidence[] }) {
  return <ul className="mt-3 space-y-1 text-xs leading-6 text-white/65">{sources.map(source => <li key={source.url} className="break-words">
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-cyan-300">{source.label}<span className="sr-only"> (새 창)</span> ↗</a>
    <span className="block">최종 확인 {new Date(source.checkedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} KST</span>
  </li>)}</ul>;
}

export default async function EvaluatePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const scenario = readCostScenario(await searchParams);
  return <div className="space-y-8">
    <section className="bd-surface-md p-5 sm:p-8">
      <p className="text-sm font-medium text-cyan-200">PC 구매 판단 · 시험 운영</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">가격 뒤의 구성까지 확인하세요</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">완본체·반본체의 가치는 부품 이름과 할인율만으로 결정되지 않습니다. 같은 부품을 직접 모으는 비용, 부품별 장점과 이슈, OS·조립·보증 조건을 함께 비교합니다.</p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm"><a href="#calculator" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-cyan-100 hover:bg-cyan-300/20">구성 비용 비교</a><a href="#parts" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 hover:bg-white/10">부품 정보 확인</a></div>
    </section>

    <section id="calculator" className="bd-surface-md scroll-mt-40 p-5 sm:p-8" aria-labelledby="calculator-title">
      <h2 id="calculator-title" className="text-xl font-semibold">드래곤볼 대비 얼마나 이득일까요?</h2>
      <p id="calculator-help" className="mt-3 text-sm leading-7 text-white/75">같은 부품을 각각 구매하는 상황의 비용을 직접 입력하세요. 각 부품은 필요한 수량 전체의 금액이며, 배송비는 같은 주문을 중복 계산하지 않습니다. 기본 제공 쿨러처럼 추가 비용이 없으면 0을 입력하세요.</p>
      <p className="mt-2 text-sm leading-7 text-amber-100">직접 입력한 금액의 계산입니다. 실제 판매가 검증이나 블루딜 추천 점수를 뜻하지 않습니다. 금액은 확인 시점 기준이며 구매 전에 판매처의 옵션·쿠폰·배송 조건을 다시 확인하세요.</p>
      <form action="/evaluate#result" method="get" className="mt-6 space-y-5" aria-describedby="calculator-help">
        <input type="hidden" name="calculate" value="1" />
        <label className="block max-w-lg text-sm font-medium" htmlFor="mode">비교할 본체 구성
          <select id="mode" name="mode" defaultValue={scenario.mode} className={inputClass}>
            <option value="fullpc-dedicated">그래픽카드 포함 완본체</option><option value="fullpc-integrated">내장그래픽 완본체</option><option value="halfpc">그래픽카드 제외 반본체</option>
          </select>
        </label>
        <p className="text-xs leading-6 text-white/65">내장그래픽 완본체·반본체는 그래픽카드 금액에 0을 입력하세요. OS 포함 여부는 판매 상품마다 다르므로 서비스 비용에 반영해야 합니다.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SCENARIO_FIELDS.map(field => <label key={field.key} htmlFor={`cost-${field.key}`} className="block text-sm text-white/85">{field.label} <span className="text-white/55">(원)</span>
          <input id={`cost-${field.key}`} name={field.key} type="number" min={field.zero ? 0 : 1} max="100000000" step="1" inputMode="numeric" required defaultValue={scenario.values[field.key]} className={inputClass} />
        </label>)}</div>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-white/15 p-3 text-sm leading-6 text-white/80"><input type="checkbox" name="matched" value="yes" required defaultChecked={scenario.matched} className="mt-1 h-5 w-5 shrink-0 accent-cyan-300" /><span>동일한 모델·용량·수량·옵션을 비교했고, OS·조립·보증 조건의 차이를 비용에 반영했습니다.</span></label>
        <button type="submit" className="min-h-11 rounded-xl bg-cyan-200 px-6 py-3 font-semibold text-[#060B1A] hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">비용 차이 계산하기</button>
        <Link href="/evaluate#calculator" className="ml-4 inline-flex min-h-11 items-center text-sm text-white/75 underline">입력 초기화</Link>
      </form>
      <div id="result" className="scroll-mt-40" aria-live="polite">
        {scenario.errors.length > 0 ? <div role="alert" className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4"><h3 className="font-semibold text-amber-100">입력값을 확인해 주세요</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-white/80">{scenario.errors.map(error => <li key={error}>{error}</li>)}</ul></div> : null}
        {scenario.result ? <div className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-5">
          <p className="text-xs text-cyan-200">직접 입력한 조건의 계산 결과</p>
          <h3 className="mt-2 text-xl font-semibold">{scenario.result.savingsKRW >= 0 ? `본체가 ${won(scenario.result.savingsKRW)} 저렴합니다` : `본체가 ${won(-scenario.result.savingsKRW)} 더 비쌉니다`}</h3>
          <p className="mt-2 text-sm leading-6 text-white/75">직접 구매 합계 대비 차이: <b className="text-white">{scenario.result.savingsPct}%</b></p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-white/65">부품 합계</dt><dd>{won(scenario.partsKRW)}</dd></div><div><dt className="text-white/65">배송비 + 조건 보정 비용</dt><dd>{won(scenario.shippingKRW + scenario.servicesKRW)}</dd></div><div><dt className="text-white/65">직접 구매 총액</dt><dd className="font-semibold">{won(scenario.result.referenceTotalKRW)}</dd></div><div><dt className="text-white/65">본체 최종 결제금액</dt><dd className="font-semibold">{won(scenario.result.deliveredPcTotalKRW)}</dd></div></dl>
          <p className="mt-4 text-xs leading-6 text-white/65">차이율 = (직접 구매 총액 − 본체 결제금액) ÷ 직접 구매 총액 × 100. 성능·품질·AS의 우열은 이 계산만으로 판단할 수 없습니다.</p>
        </div> : null}
      </div>
    </section>

    <section id="parts" className="scroll-mt-40 space-y-5" aria-labelledby="parts-title">
      <div><h2 id="parts-title" className="text-2xl font-semibold">부품의 장점과 주의사항</h2><p className="mt-3 text-sm leading-7 text-white/70">공식 자료로 확인한 정보부터 정리합니다. 모델·리비전·BIOS·사용 조건을 구분하고, 사용자 제보는 제조사 확인 사실과 별도로 다룹니다.</p></div>
      {PART_DOSSIERS.map(part => <article key={part.skuId} className="bd-surface-md p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">{part.name}</h3><span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70">품질 점수: 검토 중</span></div>
        <div className="mt-6 grid gap-6 md:grid-cols-2"><div><h4 className="font-semibold text-cyan-200">확인한 특징·장점</h4><div className="mt-4 space-y-5">{part.strengths.map(item => <div key={item.title}><h5 className="font-semibold">{item.title}</h5><p className="mt-2 text-sm leading-7 text-white/80">{item.detail}</p><p className="mt-1 text-sm leading-7 text-white/65">{item.conditions}</p><Sources sources={item.sources} /></div>)}</div></div>
          <div><h4 className="font-semibold text-amber-100">확인한 이슈·대응</h4>{part.findings.map(item => <div key={item.id} className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4"><p className="text-xs text-amber-100">제조사 공지 · 대응 안내 있음</p><h5 className="mt-2 font-semibold">{item.title}</h5><p className="mt-2 text-sm leading-7 text-white/80">{item.summary}</p><p className="mt-2 text-sm leading-7 text-white/65">{item.conditions}</p><p className="mt-3 text-sm leading-7 text-white/85">{item.action}</p><Sources sources={item.sources} /></div>)}</div>
        </div>
        <p className="mt-6 border-t border-white/10 pt-4 text-sm leading-7 text-white/65">{part.quality.reasoning} 조사한 출처 범위의 기록이며, 다른 이슈가 없다는 보증은 아닙니다.</p>
      </article>)}
    </section>
    <section className="bd-surface-md p-5 sm:p-8"><h2 className="text-xl font-semibold">블루딜 평가가 지킬 기준</h2><ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7 text-white/75"><li>부품·가격·배송·OS·보증 조건이 확인된 구성만 최종 평가합니다. 미확인은 0점이나 평균값으로 채우지 않습니다.</li><li>가격, 부품 품질, 판매자·AS를 따로 검토합니다. 점수 산식은 검토 중이며 실제 상품의 종합 점수는 아직 제공하지 않습니다.</li><li>해결 여부가 확인되지 않은 중대 이슈가 있으면 추천을 보류합니다. 제휴 여부와 수수료는 평가에 반영하지 않습니다.</li></ul><Link href="/prices" className="mt-5 inline-flex min-h-11 items-center text-sm text-cyan-200 underline">판매처와 확인 시각이 있는 가격표 보기 →</Link></section>
  </div>;
}
