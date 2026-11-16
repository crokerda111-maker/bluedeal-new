import gpuReference from "../content/gpuReference.json";
import SmartLink from "./SmartLink";

export default function GpuReferenceGuide() {
  return <details className="bd-surface-md p-4 sm:p-6">
    <summary className="cursor-pointer rounded-lg text-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">GeForce RTX 50 GPU 기준 사양 비교</summary>
    <p className="mt-3 text-sm leading-relaxed text-white/75">NVIDIA가 공개한 GPU 기준 사양입니다. 위 판매 상품의 제조사별 클럭·크기·전원 커넥터·권장 파워·구성·보증은 해당 제품에서 별도로 확인하세요.</p>
    <p className="mt-2 text-xs text-white/70">공식 사양 확인일: {gpuReference.checkedOn} (KST) · 아키텍처: {gpuReference.architecture}</p>
    <SmartLink href={gpuReference.officialUrl} className="mt-2 inline-flex min-h-11 items-center text-sm text-cyan-200 hover:underline" title="NVIDIA 공식 GPU 사양 비교 (새 창)">NVIDIA 공식 GPU 사양 ↗</SmartLink>
    <div className="mt-3 grid gap-3 md:hidden">
      {gpuReference.models.map(gpu => <article key={gpu.model} aria-label={gpu.model} className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-sm font-semibold text-white">{gpu.model}</h3>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <dt className="text-white/70">그래픽 메모리</dt><dd>{gpu.memoryGB.join(" / ")} GB {gpu.memoryType}</dd>
          <dt className="text-white/70">메모리 버스</dt><dd>{gpu.memoryBusBits} bit</dd>
          <dt className="text-white/70">CUDA 코어</dt><dd>{gpu.cudaCores.toLocaleString("ko-KR")}</dd>
        </dl>
      </article>)}
    </div>
    <div className="mt-3 hidden overflow-x-auto rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 md:block" tabIndex={0} role="region" aria-label="GPU 기준 사양 비교표, 가로 스크롤 가능">
      <table className="w-full min-w-[600px] text-left text-sm">
        <caption className="sr-only">NVIDIA 공식 GPU 7종의 기준 사양. RTX 5060 Ti는 16GB와 8GB 모델을 함께 표시합니다.</caption>
        <thead className="border-b border-white/10 bg-white/5 text-xs text-white/75"><tr>
          <th scope="col" className="px-3 py-3">GPU 모델</th><th scope="col" className="px-3 py-3">그래픽 메모리</th><th scope="col" className="px-3 py-3">메모리 버스</th><th scope="col" className="px-3 py-3">CUDA 코어</th>
        </tr></thead>
        <tbody>{gpuReference.models.map(gpu => <tr key={gpu.model} className="border-b border-white/10">
          <th scope="row" className="px-3 py-3 font-semibold">{gpu.model}</th>
          <td className="px-3 py-3">{gpu.memoryGB.join(" / ")} GB {gpu.memoryType}</td><td className="px-3 py-3">{gpu.memoryBusBits} bit</td><td className="px-3 py-3">{gpu.cudaCores.toLocaleString("ko-KR")}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="mt-4 text-xs leading-relaxed text-white/75">RTX 5060 Ti의 8GB·16GB는 서로 다른 메모리 용량입니다. 비교할 때 같은 GPU와 용량인지 확인하세요. 코어 수만으로 실제 게임·작업 성능을 판단할 수는 없습니다.</p>
  </details>;
}
