import type { CatalogProduct } from "../lib/productCatalog";
import { pcCatalogConfiguration } from "../lib/pcCatalogConfiguration";
import { getBoardPartExpansion } from "../lib/motherboardExpansion";
import { getPartEditorial } from "../lib/productEditorial";
import { formatPriceTime } from "./PriceOffer";
import MotherboardExpansion from "./MotherboardExpansion";

export default function PcSellerConfiguration({ product }: { product: CatalogProduct }) {
  const fields = pcCatalogConfiguration(product);
  const boardNames = fields.find(field => field.key === "board")?.values;
  const cpuNames = fields.find(field => field.key === "cpu")?.values;
  const board = boardNames?.length === 1 ? getBoardPartExpansion(boardNames[0]) : undefined;
  const orderedEvidence = product.sources.filter(source =>
    source.kind === "retailer-component-table" || source.kind === "retailer-listing" || source.kind === "retailer-availability"
  ).sort((a, b) => Date.parse(b.observedAt ?? "") - Date.parse(a.observedAt ?? ""));
  const listing = orderedEvidence.find(source => source.kind !== "retailer-component-table");
  const evidence = [
    ...(listing ? [listing] : []),
    ...orderedEvidence.filter(source => source.kind === "retailer-component-table"),
  ];
  const confirmed = fields.filter(field => field.values.length > 0);
  const missing = fields.filter(field => !field.values.length).map(field => field.label);
  return <div className="text-sm leading-6">
    {confirmed.length ? <>
    <dl className="divide-y divide-white/10 border-y border-white/10">
      {confirmed.map(({ key, label, values, source }) => {
        const editorial = values.length === 1 ? getPartEditorial(values[0]) : undefined;
        return <div key={key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-2.5" data-pc-part={key}>
        <dt className="text-white/75">{label}</dt>
        <dd className="min-w-0 break-words">
          {values.join(" / ")}
          <span className="mt-1 block text-xs text-white/65">{source}{values.length > 1 ? " · 주문 옵션에 따라 달라집니다" : ""}</span>
          {editorial ? <details className="mt-2 text-xs text-white/80">
            <summary className="cursor-pointer text-cyan-100">부품 사양·구매 전 확인</summary>
            <p className="mt-1">{editorial.advantage}</p>
            <p className="mt-1 text-amber-100">{editorial.caution}</p>
            <a className="mt-1 inline-block text-cyan-200 underline" href={editorial.source} target="_blank" rel="noopener noreferrer">사양 출처 <span className="sr-only">(새 창)</span></a>
          </details> : null}
        </dd>
      </div>;
      })}
    </dl>
    {missing.length ? <p className="mt-3 text-amber-100">판매처 확인 필요 · {missing.join(", ")}</p> : null}
    </> : <p className="text-amber-100">판매처 부품표에서 기본 구성을 확인해야 합니다.</p>}
    {board ? <details className="mt-3 rounded-xl border border-white/15 p-3">
      <summary className="min-h-11 cursor-pointer py-2 text-cyan-100">메인보드 SSD 장착·슬롯 공유</summary>
      <MotherboardExpansion profile={board} system cpu={cpuNames?.length === 1 ? cpuNames[0] : undefined} />
    </details> : null}
    <p className="mt-3 text-white/75">부품 점수와 절약률을 확정하려면 실제 출고 모델과 보증, 동일 조건의 개별 구매 총액이 필요합니다.</p>
    {evidence.length ? <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/75">
      {evidence.map(source => <li key={source.url}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline underline-offset-4">{source.label} <span className="sr-only">(새 창)</span></a> · {formatPriceTime(source.observedAt ?? undefined)}
        </li>)}
    </ul> : null}
  </div>;
}
