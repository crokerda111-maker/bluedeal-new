import Link from "next/link";
import { CATALOG_BRANDS, CATALOG_PRODUCTS, CATALOG_SUMMARY } from "../../lib/catalogData";
import { catalogHref, PRODUCT_CATEGORIES, searchCatalog } from "../../lib/productCatalog";
import type { CatalogQuery } from "../../lib/productCatalog";
import CatalogProductCard from "../../components/CatalogProductCard";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata("PC 상품 목록 | BLUEDEAL", "부품·제품군의 특징과 확인한 출처를 살펴보고, 필요한 정보와 구매 조건을 확인하세요.", "/products", true);
const fieldClass = "mt-2 w-full rounded-xl border border-white/20 bg-[#0a1428] px-3 py-2.5 text-sm text-white";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<CatalogQuery> }) {
  const results = searchCatalog(CATALOG_PRODUCTS, await searchParams);
  return <div className="space-y-7">
    <section className="bd-surface p-5 sm:p-7">
      <p className="text-xs font-medium tracking-widest text-cyan-200">BLUEDEAL CATALOG</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">PC 상품 목록</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">부품의 특징과 공식 자료를 분류별로 찾아보세요. 국내 판매와 구매 조건은 항목별 확인 상태를 표시합니다.</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['전체 등록 항목', CATALOG_SUMMARY.entries], ['모델', CATALOG_SUMMARY.models], ['파워 출력 옵션', CATALOG_SUMMARY.outputOptions], ['케이스 제품군', CATALOG_SUMMARY.families]].map(([label, value]) =>
          <div key={label} className="rounded-xl border border-white/10 bg-[#050b18]/60 p-3 sm:p-4"><dt className="text-xs text-white/65">{label}</dt><dd className="mt-2 text-2xl font-semibold text-cyan-100">{value}<span className="ml-1 text-xs font-normal text-white/65">개</span></dd></div>)}
      </dl>
      <p className="mt-4 text-xs leading-6 text-white/65">모델·출력 옵션·제품군 기준이며 전체 시장 목록은 보완 중입니다. 미확인 가격·평점은 표시하지 않습니다.</p>
    </section>

    <section className="bd-surface-md p-5" aria-labelledby="catalog-filter-title">
      <h2 id="catalog-filter-title" className="text-lg font-semibold">상품 찾기</h2>
      <form method="get" action="/products" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
        <label className="text-xs text-white/75">모델명·특징<input type="search" name="q" maxLength={120} defaultValue={results.q} placeholder="예: 9800X3D, Peerless, 850W" className={fieldClass} /></label>
        <label className="text-xs text-white/75">분류<select name="category" defaultValue={results.category} className={fieldClass}><option value="">전체 분류</option>{PRODUCT_CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.label} ({CATALOG_SUMMARY.categoryCounts[category.key]})</option>)}</select></label>
        <label className="text-xs text-white/75">브랜드<select name="brand" defaultValue={results.brand} className={fieldClass}><option value="">전체 브랜드</option>{CATALOG_BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}</select></label>
        <label className="text-xs text-white/75">목록 상태<select name="lifecycle" defaultValue={results.lifecycle} className={fieldClass}><option value="">전체 포함</option><option value="exclude-discontinued">단종 목록 제외</option></select></label>
        <button type="submit" className="self-end rounded-xl bg-cyan-200 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-100">검색</button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">{PRODUCT_CATEGORIES.filter(category => CATALOG_SUMMARY.categoryCounts[category.key] > 0).map(category =>
        <Link key={category.key} href={catalogHref({ q: "", brand: "", lifecycle: "", category: category.key })} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-3 text-white/75 hover:border-cyan-200/50 hover:text-cyan-100">{category.label}</Link>)}<Link href="/products" className="inline-flex min-h-10 items-center px-2 text-cyan-200 underline">조건 초기화</Link></div>
    </section>

    <section aria-labelledby="catalog-results-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="catalog-results-title" className="text-lg font-semibold">검색 결과 <span className="text-cyan-200">{results.total}개</span></h2><p className="text-xs text-white/65">{results.page} / {results.totalPages} 페이지</p></div>
      {results.items.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{results.items.map(product => <CatalogProductCard key={product.id} product={product} />)}</div> : <div className="rounded-2xl border border-white/15 p-7"><h3 className="font-semibold">조건에 맞는 등록 항목이 없습니다.</h3><p className="mt-3 text-sm leading-7 text-white/70">검색어를 줄이거나 다른 분류를 선택해 주세요. 아직 비어 있는 분류는 제품 목록을 추가하고 있습니다.</p><Link href="/products" className="mt-4 inline-flex min-h-11 items-center text-cyan-200 underline">전체 목록 보기</Link></div>}
      {results.totalPages > 1 ? <nav aria-label="상품 목록 페이지" className="mt-6 flex items-center justify-center gap-4">{results.page > 1 ? <Link rel="prev" href={catalogHref(results, results.page - 1)} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-5 text-sm hover:bg-white/10">이전</Link> : null}<span className="text-sm text-white/70">{results.page} / {results.totalPages}</span>{results.page < results.totalPages ? <Link rel="next" href={catalogHref(results, results.page + 1)} className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-5 text-sm hover:bg-white/10">다음</Link> : null}</nav> : null}
    </section>
  </div>;
}
