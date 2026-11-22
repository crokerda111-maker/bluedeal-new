import Link from "next/link";
import type { CatalogProduct } from "../lib/productCatalog";
import type { PriceCategory } from "../lib/priceCategories";
import type { PriceItem } from "../lib/mockPrices";
import { productSearchHref, type SearchQuery } from "../lib/productFilters";
import CatalogProductCard from "./CatalogProductCard";

export default function PriceCatalogSection({ category, query, results, offersById, now }: {
  category?: PriceCategory; query: SearchQuery;
  results: { total: number; page: number; totalPages: number; items: CatalogProduct[] };
  offersById: ReadonlyMap<string, readonly PriceItem[]>;
  now: number;
}) {
  const path = `/prices${category ? "/" + category.key : ""}`;
  return <section id="registered-products" aria-labelledby="registered-products-title" className="scroll-mt-24 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="registered-products-title" className="text-xl font-semibold">상품·가격 비교 결과 <span className="text-cyan-200">{results.total}개</span></h2>
      {results.total ? <p className="text-xs text-white/65">{results.page} / {results.totalPages} 페이지</p> : null}
    </div>
    <p className="text-sm leading-7 text-white/70">모델·출력 옵션·제품군을 구분합니다. 가격이 없는 상품도 사양과 출처를 확인할 수 있습니다. 선택한 검색 조건은 아래 판매처 가격 기록에도 함께 적용됩니다.</p>
    {results.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.items.map(product => <CatalogProductCard key={product.id} product={product} offers={offersById.get(product.id) ?? []} now={now} />)}</div>
      : <div className="bd-surface-md p-6 text-sm leading-7 text-white/75">조건에 맞는 등록 상품이 없습니다. <Link href={path} className="text-cyan-200 underline">상품 검색 초기화</Link>{category ? <Link href={`/contact/write?from=prices&cat=${encodeURIComponent(category.shortTitle)}`} className="ml-4 text-cyan-200 underline">상품 추가 요청</Link> : null}</div>}
    {results.totalPages > 1 ? <nav aria-label={`${category?.shortTitle ?? "전체"} 상품 페이지`} className="flex items-center justify-center gap-4">
      {results.page > 1 ? <Link rel="prev" href={productSearchHref(category?.key, query, results.page - 1) + "#registered-products"} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm hover:bg-white/10">이전 상품</Link> : null}
      <span className="text-sm text-white/70">{results.page} / {results.totalPages}</span>
      {results.page < results.totalPages ? <Link rel="next" href={productSearchHref(category?.key, query, results.page + 1) + "#registered-products"} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm hover:bg-white/10">다음 상품</Link> : null}
    </nav> : null}
  </section>;
}
