import Link from "next/link";
import { formatPriceTime } from "../../components/PriceOffer";
import { PART_DOSSIERS } from "../../content/partDossiers";
import { getCatalogProduct } from "../../lib/catalogData";
import { priceBenefits } from "../../lib/priceBenefits";
import { priceFreshness } from "../../lib/priceFilters";
import { getPriceView } from "../../lib/prices";
import { pageMetadata } from "../../lib/site";
import { PC_UPGRADE_FIELDS, readCostScenario, SCENARIO_FIELDS, type Evidence } from "../../lib/valueAssessment";

type EvaluateProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ searchParams }: EvaluateProps) {
  const hasScenario = Object.keys(await searchParams).length > 0;
  return pageMetadata("완본체 vs 드래곤볼 비용 계산기 | 블루딜", "완본체 결제가에 램·SSD·파워 보완비를 더하고, 같은 목표 구성의 부품 직접 구매 견적과 비교하세요.", "/evaluate", hasScenario);
}
const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
const inputClass = "mt-2 block min-h-11 w-full rounded-xl border border-white/20 bg-[#060B1A] px-3 py-2 text-base text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";
function Sources({ sources }: { sources: Evidence[] }) {
  return <ul className="mt-3 space-y-1 text-xs leading-6 text-white/65">{sources.map(source => <li key={source.url} className="break-words">
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-cyan-300">{source.label}<span className="sr-only"> (새 창)</span> ↗</a>
    <span className="block">최종 확인 {new Date(source.checkedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} KST</span>
  </li>)}</ul>;
}

export default async function EvaluatePage({ searchParams }: EvaluateProps) {
  const query = await searchParams;
  const product = typeof query.product === "string" ? getCatalogProduct(query.product) : undefined;
  const category = product?.category;
  const isSystem = category === "fullpc" || category === "halfpc";
  const system = isSystem ? product : undefined;
  const view = isSystem ? await getPriceView(category) : undefined;
  const listingIds = new Set(system?.listings.map(listing => listing.id));
  const quotes = view?.data.items.filter(item => listingIds.has(item.id)).flatMap(item => {
    const shipping = item.shippingFee;
    if (typeof shipping !== "number" || shipping < 0 || item.availability !== "in-stock" || !item.checkedAt ||
        !item.availabilityCheckedAt || priceFreshness(item, view.now) !== "recent" ||
        priceFreshness({ ...item, checkedAt: item.availabilityCheckedAt }, view.now) !== "recent") return [];
    const benefits = priceBenefits(item, view.now).filter(benefit => benefit.state === "observed");
    const observed = [
      { key: "ordinary", label: "기본가", amount: item.price, note: item.shippingNote },
      ...benefits.filter(benefit => benefit.kind !== "card" || !item.cardRequiresCoupon || benefits.some(other => other.kind === "coupon"))
        .map(benefit => ({ key: benefit.kind, label: benefit.kind === "instant" ? "조건부 즉시할인가" : benefit.kind === "coupon" ? "조건부 쿠폰가" : item.cardRequiresCoupon ? "조건부 쿠폰+카드가" : "조건부 카드가", amount: benefit.amount, note: benefit.note })),
    ];
    return observed.map(price => ({ id: `${item.id}:${price.key}`, label: `${item.source ?? "판매처"} · ${price.label}`, total: price.amount + shipping, checkedAt: item.checkedAt, note: price.note }));
  }) ?? [];
  const quoteRequested = query.calculate === undefined ? (typeof query.offer === "string" ? `${query.offer}:ordinary` : "") : query.quote;
  const selectedQuote = quotes.find(quote => quote.id === quoteRequested);
  const quoteUnavailable = query.calculate !== undefined && quoteRequested !== undefined && quoteRequested !== "" && !selectedQuote;
  const scenario = readCostScenario({ ...query, mode: query.mode ?? (system?.category === "halfpc" ? "halfpc" : undefined),
    pc: selectedQuote ? String(selectedQuote.total) : query.pc });
  const errors = quoteUnavailable ? ["선택한 판매가를 다시 확인해 주세요. 남아 있는 판매가를 고르거나 현재 결제금액을 직접 입력할 수 있습니다.", ...scenario.errors] : scenario.errors;
  const result = errors.length ? null : scenario.result;
  const calculatorLink = system ? `/evaluate?${new URLSearchParams({ product: system.id, ...(typeof query.offer === "string" ? { offer: query.offer } : {}) })}#calculator` : "/evaluate#calculator";
  return <div className="space-y-8">
    <section className="bd-surface-md p-5 sm:p-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">완본체 vs 드래곤볼 비용 계산기</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">완본체·반본체 구매에 필요한 부품 보완비와 배송비를 더해 같은 구성의 직접 구매 견적과 비교하세요.</p>
      <div className="mt-4 flex flex-wrap gap-5 text-sm text-cyan-200">
        <Link href="/prices/fullpc#today-pc" className="inline-flex min-h-11 items-center underline">오늘의 완본체 비교</Link>
        <Link href="/prices/halfpc#today-pc" className="inline-flex min-h-11 items-center underline">오늘의 반본체 비교</Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-3 text-sm"><a href="#calculator" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-cyan-100 hover:bg-cyan-300/20">구성 비용 비교</a><a href="#parts" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 hover:bg-white/10">부품 정보 확인</a></div>
    </section>

    <section id="calculator" className="bd-surface-md scroll-mt-40 p-5 sm:p-8" aria-labelledby="calculator-title">
      <h2 id="calculator-title" className="text-xl font-semibold">부품 보완비까지 합친 가격 비교</h2>
      <p id="calculator-help" className="mt-3 text-sm leading-7 text-white/75">본체 결제금액과 필요한 보완비를 입력하세요. 직접 구매 쪽은 배송·조립 등을 포함한 견적 총액이나 부품별 금액으로 비교할 수 있습니다.</p>
      {system ? <p className="mt-3 text-sm leading-7 text-white/80"><Link href={`/products/${system.id}#product-prices`} className="text-cyan-200 underline underline-offset-4">{system.name} 판매처·할인 조건 보기</Link></p> : null}
      <form action="/evaluate#result" method="get" className="mt-6 space-y-5" aria-describedby="calculator-help">
        <input type="hidden" name="calculate" value="1" />
        {system ? <input type="hidden" name="product" value={system.id} /> : null}
        <label className="block max-w-lg text-sm font-medium" htmlFor="mode">비교할 본체 구성
          <select id="mode" name="mode" defaultValue={scenario.mode} className={inputClass}>
            <option value="fullpc-dedicated">그래픽카드 포함 완본체</option><option value="fullpc-integrated">내장그래픽 완본체</option><option value="halfpc">그래픽카드 제외 반본체</option>
          </select>
        </label>
        <fieldset className="space-y-4 rounded-xl border border-white/15 p-4">
          <legend className="px-2 font-semibold text-cyan-100">본체 구매 비용</legend>
          {quotes.length ? <label className="block text-sm font-medium" htmlFor="pc-quote">판매처 가격 선택
            <select id="pc-quote" name="quote" defaultValue={selectedQuote?.id ?? ""} className={inputClass}>
              <option value="">직접 입력</option>
              {quotes.map(quote => <option key={quote.id} value={quote.id}>{quote.label} · 배송 포함 {won(quote.total)}</option>)}
            </select>
          </label> : system ? <p className="text-sm leading-6 text-amber-100">최근 24시간 안에 가격과 재고를 확인했고 배송비를 합산할 수 있는 판매가가 없습니다. 판매처에서 현재 결제금액을 확인해 입력하세요.</p> : null}
          {quotes.length ? <p className="text-xs leading-6 text-white/70">판매처 가격을 선택하면 아래 직접 입력 칸보다 우선 적용합니다. 쿠폰·카드는 본인에게 적용되는 조건을 확인하고 선택하세요.</p> : null}
          <label className="block max-w-lg text-sm text-white/85" htmlFor="cost-pc">{quotes.length ? "직접 입력 시 " : ""}배송 포함 본체 결제금액 (원)
            <input id="cost-pc" name="pc" type="number" min="1" max="100000000" step="1" inputMode="numeric" required={!quotes.length} defaultValue={selectedQuote ? (typeof query.pc === "string" ? query.pc : "") : scenario.values.pc} className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">{PC_UPGRADE_FIELDS.map(field => <label key={field.key} htmlFor={`cost-${field.key}`} className="block text-sm text-white/85">{field.label} (원)
            <input id={`cost-${field.key}`} name={field.key} type="number" min="0" max="100000000" step="1" inputMode="numeric" defaultValue={scenario.values[field.key]} className={inputClass} />
          </label>)}</div>
          <p className="text-xs leading-6 text-white/70">보완비는 배송·장착비를 포함한 추가 지출입니다. 보완하지 않는 항목은 비워 두세요. 예상 중고 판매액이나 조건을 확인하지 못한 적립금은 빼지 않습니다.</p>
        </fieldset>
        <fieldset className="space-y-4 rounded-xl border border-white/15 p-4">
          <legend className="px-2 font-semibold text-cyan-100">부품 직접 구매 비용</legend>
          <label className="block max-w-lg text-sm text-white/85" htmlFor="cost-reference-total">직접 구매 견적의 최종 총액 (원)
            <input id="cost-reference-total" name="referenceTotal" type="number" min="1" max="100000000" step="1" inputMode="numeric" defaultValue={scenario.values.referenceTotal} className={inputClass} />
          </label>
          <p className="text-xs leading-6 text-white/70">배송·조립·OS·보증을 반영한 견적 총액을 입력하면 부품별 금액은 계산에서 제외됩니다.</p>
          <details open={scenario.submitted && !scenario.estimateProvided} className="rounded-lg border border-white/15 p-3">
            <summary className="cursor-pointer font-medium text-cyan-100">부품별로 직접 견적 입력</summary>
            <p className="mt-3 text-xs leading-6 text-white/70">부품별로 필요한 수량의 총액을 입력하세요. 배송비는 주문당 한 번만 더하고, 기본 쿨러나 반본체의 그래픽카드처럼 추가 비용이 없으면 0을 입력하세요.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SCENARIO_FIELDS.filter(field => field.key !== "pc").map(field => <label key={field.key} htmlFor={`cost-${field.key}`} className="block text-sm text-white/85">{field.label} (원)
              <input id={`cost-${field.key}`} name={field.key} type="number" min={field.zero ? 0 : 1} max="100000000" step="1" inputMode="numeric" defaultValue={scenario.values[field.key]} className={inputClass} />
            </label>)}</div>
          </details>
        </fieldset>
        <label className="flex min-h-11 items-start gap-3 rounded-xl border border-white/15 p-3 text-sm leading-6 text-white/80"><input type="checkbox" name="matched" value="yes" required defaultChecked={scenario.matched} className="mt-1 h-5 w-5 shrink-0 accent-cyan-300" /><span>보완 후 양쪽의 목표 구성과 용량이 같고, OS·조립·보증 조건의 차이를 비용에 반영했습니다.</span></label>
        <button type="submit" className="min-h-11 rounded-xl bg-cyan-200 px-6 py-3 font-semibold text-[#060B1A] hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">비용 차이 계산하기</button>
        <Link href={calculatorLink} className="ml-4 inline-flex min-h-11 items-center text-sm text-white/75 underline">입력 초기화</Link>
      </form>
      <div id="result" className="scroll-mt-40" aria-live="polite">
        {errors.length > 0 ? <div role="alert" className="mt-6 rounded-xl border border-amber-300/30 bg-amber-300/5 p-4"><h3 className="font-semibold text-amber-100">입력값을 확인해 주세요</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-white/80">{errors.map(error => <li key={error}>{error}</li>)}</ul></div> : null}
        {result ? <div className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-5">
          <p className="text-xs text-cyan-200">직접 입력한 조건의 계산 결과</p>
          <h3 className="mt-2 text-xl font-semibold">{result.savingsKRW === 0 ? "두 방식의 총비용이 같습니다" : `본체가 ${won(Math.abs(result.savingsKRW))} ${result.savingsKRW > 0 ? "저렴합니다" : "더 비쌉니다"}`}</h3>
          <p className="mt-2 text-sm leading-6 text-white/75">직접 구매 대비 절약률 <b className="text-white">{result.savingsPct}%</b></p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-white/65">배송 포함 본체 결제금액</dt><dd>{won(scenario.basePcKRW)}</dd></div>
            <div><dt className="text-white/65">램·SSD·기타 보완비 합계</dt><dd>{won(scenario.upgradeKRW)}</dd></div>
            {!scenario.estimateProvided ? <><div><dt className="text-white/65">개별 부품 합계</dt><dd>{won(scenario.partsKRW)}</dd></div><div><dt className="text-white/65">부품 배송비·조건 보정 비용</dt><dd>{won(scenario.shippingKRW + scenario.servicesKRW)}</dd></div></> : null}
            <div><dt className="text-white/65">보완 후 본체 총액</dt><dd className="font-semibold">{won(result.deliveredPcTotalKRW)}</dd></div>
            <div><dt className="text-white/65">직접 구매 총액</dt><dd className="font-semibold">{won(result.referenceTotalKRW)}</dd></div>
          </dl>
          {selectedQuote ? <p className="mt-4 text-xs leading-6 text-white/75">{selectedQuote.label} · {formatPriceTime(selectedQuote.checkedAt)} 관측. {selectedQuote.note}</p> : null}
          <p className="mt-4 text-xs leading-6 text-white/65">절약률은 직접 구매 총액을 기준으로 계산합니다. 실제 결제 전 쿠폰·카드와 출고 구성을 확인하세요.</p>
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
