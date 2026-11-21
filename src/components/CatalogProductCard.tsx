import Link from "next/link";
import type { CatalogProduct } from "../lib/productCatalog";
import { catalogDate, PRODUCT_KIND_LABELS, productCategoryLabel } from "../lib/productCatalog";

export default function CatalogProductCard({ product }: { product: CatalogProduct }) {
  return <article data-product-id={product.id} className="bd-surface-md flex min-w-0 flex-col p-5">
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="rounded-md bg-cyan-300/10 px-2 py-1 text-cyan-100">{productCategoryLabel(product.category)}</span>
      <span className="text-white/60">{PRODUCT_KIND_LABELS[product.kind]}</span>
      {product.lifecycle === "listed-discontinued" ? <span className="rounded-md bg-amber-200/10 px-2 py-1 text-amber-100">제조사 단종 목록</span> : null}
    </div>
    <p className="mt-4 text-xs text-white/60">{product.brand}</p>
    <h3 className="mt-2 break-words text-base font-semibold leading-7"><Link href={`/products/${product.id}`} className="hover:text-cyan-100">{product.name}</Link></h3>
    <p className="mt-3 break-words text-sm leading-6 text-white/75">{product.features.slice(0, 2).join(" · ") || "상세 자료를 확인하고 있습니다."}</p>
    <div className="mt-auto pt-5">
      <p className="text-xs leading-6 text-white/60">{product.listObservedAt ? `공식 목록 확인 ${catalogDate(product.listObservedAt)}` : product.kind === "source-reviewed-model" ? "공식 사양·공지 검토 자료" : product.kind === "retailer-reviewed-model" ? "판매 표기 확인 · 상세 사양 추가 대조 중" : "기존 등록 사양 · 추가 대조 중"}</p>
      <p className="mt-1 text-xs leading-6 text-white/65">{product.listings.length ? `판매처 가격 기록 ${product.listings.length}건 · 확인 시각은 가격표 참조` : "현재 구매가 미등록 · 확인 상태·출처는 상세 참조"}</p>
      <Link href={`/products/${product.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-cyan-200 hover:underline">특징·출처·확인 상태 보기 <span aria-hidden="true" className="ml-2">→</span></Link>
    </div>
  </article>;
}
