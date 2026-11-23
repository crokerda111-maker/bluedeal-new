import type { CatalogProduct } from "../lib/productCatalog";
import { pcCatalogConfiguration } from "../lib/pcCatalogConfiguration";
import { formatPriceTime } from "./PriceOffer";

export default function PcSellerConfiguration({ product }: { product: CatalogProduct }) {
  const fields = pcCatalogConfiguration(product);
  const evidence = product.sources.find(source => source.kind === "retailer-component-table") ??
    product.sources.find(source => source.kind === "retailer-listing");
  return <div className="text-sm leading-6">
    <p className="mb-3 text-white/80">판매처가 공개한 기본 구성과 선택 옵션입니다. 정확한 모델과 보증이 필요한 항목은 주문 전 판매처에 확인하세요.</p>
    <dl className="divide-y divide-white/10 border-y border-white/10">
      {fields.map(({ key, label, values, source }) => <div key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-2.5">
        <dt className="text-white/75">{label}</dt>
        <dd className="min-w-0 break-words">
          {values.length ? <>
            {values.join(" / ")}
            <span className="mt-1 block text-xs text-white/65">{source}{values.length > 1 ? " · 주문 옵션에 따라 확인 필요" : ""}</span>
          </> : <span className="text-amber-100">판매처에서 확인 필요</span>}
        </dd>
      </div>)}
    </dl>
    <p className="mt-3 text-white/75">부품 구성 점수와 절약률은 모델·보증과 동일 조건의 개별 구매 비용이 확인되면 표시합니다.</p>
    {evidence ? <p className="mt-2 text-xs text-white/75">
      <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline underline-offset-4">{evidence.kind === "retailer-component-table" ? "판매처 부품표" : "판매 페이지"} <span className="sr-only">(새 창)</span></a> · {formatPriceTime(evidence.observedAt ?? undefined)}
    </p> : null}
  </div>;
}
