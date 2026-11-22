import type { CatalogProduct, ProductCategory } from "../lib/productCatalog";
import type { PriceItem } from "../lib/mockPrices";
import { PRICE_SORTS } from "../lib/priceFilters";
import { CATEGORY_FACETS, facetLabel, productFacetOptions, readProductFilters, unknownBrand, type SearchQuery } from "../lib/productFilters";

const control = "mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-[#0a1428] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";
export default function ProductSearchForm({ category, products, offersById, query }: { category?: ProductCategory; products: readonly CatalogProduct[]; offersById: ReadonlyMap<string, readonly PriceItem[]>; query: SearchQuery }) {
  const filters = readProductFilters(query, category);
  const detailedOptions = (category ? CATEGORY_FACETS[category] : []).map(facet => ({
    facet,
    options: productFacetOptions(products, offersById, facet),
    selected: filters.facets[facet.key] ?? "",
  })).filter(({ options, selected }) => options.values.length || selected);
  const brands = [...new Set(products.map(p => p.brand).filter(b => !unknownBrand(b)))].sort((a, b) => a.localeCompare(b, "ko-KR"));
  const path = `/prices${category ? "/" + category : ""}`;
  return <form action={`${path}#registered-products`} method="get" className="bd-surface-md space-y-4 p-4 sm:p-5" aria-label="상품 검색과 필터">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="min-w-0 text-xs text-white/75 sm:col-span-2">모델·특징·판매자 검색
        <input type="search" name="q" maxLength={100} defaultValue={filters.q} placeholder={category === "fullpc" || category === "halfpc" ? "예: 9800X3D, RTX 5080, 32GB" : "예: 모델명, 규격, 판매자"} aria-describedby="product-search-help" className={control} />
      </label>
      <label className="text-xs text-white/75">브랜드<select name="brand" defaultValue={filters.brand} className={control}><option value="">전체 브랜드</option>{brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}{filters.brand && filters.brand !== "__unknown" && !brands.includes(filters.brand) ? <option value={filters.brand}>{filters.brand} (0)</option> : null}<option value="__unknown">브랜드 확인 전</option></select></label>
      <label className="text-xs text-white/75">가격 기록<select name="priceState" defaultValue={filters.priceState} className={control}><option value="">가격 미등록 상품도 포함</option><option value="recorded">가격 기록 있음</option><option value="missing">가격 기록 없음</option></select></label>
    </div>
    {detailedOptions.length > 0 || category === "gpu" ? <fieldset className="border-t border-white/10 pt-4"><legend className="px-1 text-sm font-medium text-cyan-100">부품별 상세 조건</legend><div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {detailedOptions.map(({ facet, options, selected }) => {
        const unknown = facet.key === "dram" ? "unknown" : "__unknown";
        return <label key={facet.key} className="min-w-0 text-xs text-white/75">{facet.label}<select name={facet.key} defaultValue={selected} className={control}>
          <option value="">전체</option>
          {options.values.map(([value, count]) => <option key={value} value={value}>{facetLabel(facet, value)} ({count})</option>)}
          {selected && selected !== unknown && !options.values.some(([v]) => v === selected) ? <option value={selected}>{facetLabel(facet, selected)} (0)</option> : null}
          {options.unknown || selected === unknown ? <option value={unknown}>미확인 ({options.unknown})</option> : null}
        </select></label>;
      })}
      {category === "gpu" ? <label className="text-xs text-white/75">상품 상태<select name="condition" defaultValue={filters.condition} className={control}><option value="standard">일반 기록 · 리퍼 제외</option><option value="refurbished">리퍼·벌크</option><option value="all">모두 보기</option></select></label> : null}
    </div></fieldset> : null}
    {category === "cpu" && filters.facets.cores ? <p className="text-xs text-white/70">이전 링크의 코어 수 조건 {filters.facets.cores === "__unknown" ? "미확인" : `${filters.facets.cores}코어`}이 적용됐습니다. 검색을 다시 실행하면 이 조건이 해제됩니다.</p> : null}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label className="text-xs text-white/75">가격 기록 정렬<select name="sort" defaultValue={typeof query.sort === "string" && Object.hasOwn(PRICE_SORTS, query.sort) ? query.sort : "total-asc"} className={control}>{Object.entries(PRICE_SORTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-xs text-white/75">제조사 목록 상태<select name="lifecycle" defaultValue={filters.lifecycle} className={control}><option value="">전체 포함</option><option value="exclude-discontinued">단종 목록 제외</option></select></label>
      <label className="text-xs text-white/75">등록 기준<select name="kind" defaultValue={filters.kind} className={control}><option value="">모두 보기</option><option value="model">모델·판매 구성</option><option value="listed-wattage-option">파워 출력 옵션</option><option value="product-family">제품군</option></select></label>
    </div>
    <div className="flex flex-wrap items-center gap-3"><button type="submit" className="min-h-11 rounded-xl bg-cyan-200 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200">상품·가격 찾기</button><a href={path} className="inline-flex min-h-11 items-center px-2 text-sm text-cyan-200 underline">조건 초기화</a></div>
    <p id="product-search-help" className="text-xs leading-6 text-white/65">{category === "cpu" ? "DDR4와 DDR5를 모두 지원하는 CPU도 메인보드가 지원하는 규격에 맞춰 메모리를 골라야 합니다. " : ""}상세 조건은 확인된 사양과 판매 구성 기준입니다. 가격은 상품별 확인 시점의 기록입니다.</p>
  </form>;
}
