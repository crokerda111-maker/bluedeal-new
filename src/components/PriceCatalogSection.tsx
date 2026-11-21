import Link from "next/link";
import { CATALOG_PRODUCTS } from "../lib/catalogData";
import { searchCatalog } from "../lib/productCatalog";
import type { PriceCategory } from "../lib/priceCategories";
import CatalogProductCard from "./CatalogProductCard";

type Query = Record<string, string | string[] | undefined>;

export default function PriceCatalogSection({ category, query }: { category: PriceCategory; query: Query }) {
  const results = searchCatalog(CATALOG_PRODUCTS, { category: category.key, q: query.catalogQ, page: query.catalogPage, lifecycle: query.catalogLifecycle }, 12);
  function pageHref(page: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (typeof value === "string" && key !== "catalogPage") params.set(key, value);
    if (page > 1) params.set("catalogPage", String(page));
    return `/prices/${category.key}${params.size ? `?${params}` : ""}#registered-products`;
  }

  return <section id="registered-products" aria-labelledby="registered-products-title" className="scroll-mt-24 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="registered-products-title" className="text-xl font-semibold">등록 상품·특징 <span className="text-cyan-200">{results.total}개</span></h2>
      {results.total ? <p className="text-xs text-white/65">{results.page} / {results.totalPages} 페이지</p> : null}
    </div>
    <p className="text-sm leading-7 text-white/70">모델·출력 옵션·제품군 기준입니다. 국내 판매 여부·후기·현재 가격은 확인된 범위만 상세 페이지와 가격표에 안내합니다.</p>
    <form action={`/prices/${category.key}#registered-products`} method="get" className="bd-surface-md flex flex-col gap-3 p-4 sm:flex-row sm:items-end" aria-label="등록 상품 찾기">
      {Object.entries(query).filter(([key, value]) => !key.startsWith("catalog") && typeof value === "string").map(([key, value]) => <input key={key} type="hidden" name={key} value={value as string} />)}
      <label className="min-w-0 flex-1 text-xs text-white/75">등록 모델·특징 검색<input type="search" name="catalogQ" maxLength={120} defaultValue={results.q} placeholder="모델명 또는 특징" className="mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-[#0a1428] px-3 py-2 text-sm text-white" /></label>
      <label className="text-xs text-white/75">제조사 목록 상태<select name="catalogLifecycle" defaultValue={results.lifecycle} className="mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-[#0a1428] px-3 py-2 text-sm text-white"><option value="">전체 포함</option><option value="exclude-discontinued">단종 목록 제외</option></select></label>
      <button type="submit" className="min-h-11 rounded-xl bg-cyan-200 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-100">상품 찾기</button>
    </form>
    {results.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.items.map(product => <CatalogProductCard key={product.id} product={product} />)}</div>
      : <div className="bd-surface-md p-6 text-sm leading-7 text-white/75">{results.q || results.lifecycle ? <>조건에 맞는 등록 상품이 없습니다. <Link href={`/prices/${category.key}#registered-products`} className="text-cyan-200 underline">상품 검색 초기화</Link></> : <>이 분류는 상품 목록부터 수집하고 있습니다. <Link href={`/contact/write?from=prices&cat=${encodeURIComponent(category.shortTitle)}`} className="text-cyan-200 underline">상품 추가 요청</Link></>}</div>}
    {results.totalPages > 1 ? <nav aria-label={`${category.shortTitle} 등록 상품 페이지`} className="flex items-center justify-center gap-4">
      {results.page > 1 ? <Link rel="prev" href={pageHref(results.page - 1)} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm hover:bg-white/10">이전 상품</Link> : null}
      <span className="text-sm text-white/70">{results.page} / {results.totalPages}</span>
      {results.page < results.totalPages ? <Link rel="next" href={pageHref(results.page + 1)} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm hover:bg-white/10">다음 상품</Link> : null}
    </nav> : null}
  </section>;
}
