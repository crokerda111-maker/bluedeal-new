import cpuReference from "../content/cpuReference.json";
import SmartLink from "./SmartLink";

function SpecificationLink({ model, href }: { model: string; href: string }) {
  return <SmartLink href={href} className="inline-flex min-h-11 items-center text-xs text-cyan-200 hover:underline" title={`${model} AMD 공식 사양 (새 창)`}>
    <span className="sr-only">{model} </span>AMD 공식 사양 ↗
  </SmartLink>;
}

export default function CpuReferenceGuide() {
  return <section className="bd-surface-md p-4 sm:p-6" aria-labelledby="cpu-reference-title">
    <h2 id="cpu-reference-title" className="text-xl font-semibold">AMD CPU 공식 사양 비교</h2>
    <p className="mt-2 text-sm leading-relaxed text-white/75">제조사가 공개한 핵심 사양을 비교합니다. 판매 가격·구성·보증은 상품별 판매처에서 확인하세요.</p>
    <p className="mt-2 text-xs text-white/70">공식 사양 확인일: {cpuReference.checkedOn} (KST) · 공통 소켓: AM5</p>
    <div className="mt-5 grid gap-3 md:hidden">
      {cpuReference.models.map(cpu => <article key={cpu.model} aria-label={cpu.model} className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">{cpu.model}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <dt className="text-white/70">아키텍처</dt><dd>{cpu.architecture}</dd>
          <dt className="text-white/70">코어 / 스레드</dt><dd>{cpu.cores} / {cpu.threads}</dd>
          <dt className="text-white/70">최대 부스트</dt><dd>최대 {cpu.maxBoostGHz} GHz</dd>
          <dt className="text-white/70">L3 캐시</dt><dd>{cpu.l3CacheMB} MB</dd>
        </dl>
        <SpecificationLink model={cpu.model} href={cpu.officialUrl} />
      </article>)}
    </div>
    <div className="mt-5 hidden overflow-x-auto rounded-xl md:block" tabIndex={0} role="region" aria-label="CPU 공식 사양 비교표, 가로 스크롤 가능">
      <table className="w-full min-w-[650px] text-left text-sm">
        <caption className="sr-only">AMD 공식 문서에서 확인한 CPU 4종의 사양. 최대 부스트는 GHz, L3 캐시는 MB 단위입니다.</caption>
        <thead className="border-b border-white/10 bg-white/5 text-xs text-white/75"><tr>
          <th scope="col" className="px-3 py-3">모델 · 출처</th><th scope="col" className="px-3 py-3">아키텍처</th><th scope="col" className="px-3 py-3">코어 / 스레드</th><th scope="col" className="px-3 py-3">최대 부스트</th><th scope="col" className="px-3 py-3">L3 캐시</th>
        </tr></thead>
        <tbody>{cpuReference.models.map(cpu => <tr key={cpu.model} className="border-b border-white/10">
          <th scope="row" className="px-3 py-3 font-normal"><div className="font-semibold">{cpu.model}</div><SpecificationLink model={cpu.model} href={cpu.officialUrl} /></th>
          <td className="px-3 py-3">{cpu.architecture}</td><td className="px-3 py-3">{cpu.cores} / {cpu.threads}</td><td className="px-3 py-3">최대 {cpu.maxBoostGHz} GHz</td><td className="px-3 py-3">{cpu.l3CacheMB} MB</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="mt-4 text-xs leading-relaxed text-white/75">4종 모두 AMD 공식 박스형 제품 사양에는 기본 쿨러가 포함되지 않는 것으로 안내됩니다. 멀티팩이나 판매처 번들의 실제 구성품은 상품 상세에서 별도로 확인하세요.</p>
  </section>;
}
