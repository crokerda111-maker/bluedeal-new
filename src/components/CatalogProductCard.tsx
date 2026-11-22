import Link from "next/link";
import type { CatalogProduct } from "../lib/productCatalog";
import { catalogDate, PRODUCT_KIND_LABELS, productCategoryLabel } from "../lib/productCatalog";
import type { PriceItem } from "../lib/mockPrices";
import { priceFreshness } from "../lib/priceFilters";

export default function CatalogProductCard({ product, offers, now }: { product: CatalogProduct; offers?: readonly PriceItem[]; now: number }) {
  const offer = offers?.[0];
  const observed = offer?.checkedAt || offer?.updatedAt || "";
  const observedLabel = Number.isFinite(Date.parse(observed)) ? new Date(observed).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) + " KST" : "시각 미확인";
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
      {offer ? <div className="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
        {offer.availability === "out-of-stock" ? <p className="text-xs text-amber-100">품절 상품의 이전 가격</p> : null}
        {offer.condition === "refurbished" ? <p className="text-xs text-amber-100">리퍼·벌크 · 보증 별도 확인</p> : null}
        <p className="text-xs text-white/65">확인 시점 상품가{offer.couponPrice || offer.cardPrice || offer.instantPrice ? " · 조건부 혜택 적용 전" : ""}</p>
        <p className="mt-1 text-lg font-semibold text-cyan-100">{offer.price.toLocaleString("ko-KR")}원</p>
        <p className="mt-1 text-xs leading-6 text-white/75">{offer.source} · {typeof offer.shippingFee === "number" ? `배송비 포함 ${(offer.price + offer.shippingFee).toLocaleString("ko-KR")}원` : "배송비 미확인"}</p>
        <p className="mt-1 text-xs leading-5 text-white/60">확인 {observedLabel}</p>
        {priceFreshness(offer, now) === "stale" ? <p className="mt-1 text-xs text-amber-100">24시간 경과 · 판매처 재확인</p> : null}
      </div> : offers ? <p className="mb-3 text-sm text-white/70">{product.listings.length ? "현재 조건에 맞는 가격 기록 없음" : "가격 확인 중"}</p> : null}
      <p className="text-xs leading-6 text-white/60">{product.listObservedAt ? `공식 목록 확인 ${catalogDate(product.listObservedAt)}` : product.kind === "source-reviewed-model" ? "공식 사양·공지 검토 자료" : product.kind === "retailer-reviewed-model" ? "판매 표기 확인 · 상세 사양 추가 대조 중" : "기존 등록 사양 · 추가 대조 중"}</p>
      <p className="mt-1 text-xs leading-6 text-white/65">{product.listings.length ? `판매처 가격 기록 ${product.listings.length}건 · 확인 시각은 가격표 참조` : "현재 구매가 미등록 · 확인 상태·출처는 상세 참조"}</p>
      <Link href={`/products/${product.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-cyan-200 hover:underline">가격·특징·출처 보기 <span aria-hidden="true" className="ml-2">→</span></Link>
    </div>
  </article>;
}
