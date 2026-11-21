import Link from "next/link";
import { notFound } from "next/navigation";
import { CATALOG_PRODUCTS, getCatalogProduct } from "../../../lib/catalogData";
import { catalogDate, PRODUCT_KIND_LABELS, productCategoryLabel } from "../../../lib/productCatalog";
import type { ProductSource } from "../../../lib/productCatalog";
import { pageMetadata } from "../../../lib/site";

export function generateStaticParams() { return CATALOG_PRODUCTS.map(product => ({ id: product.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const product = getCatalogProduct((await params).id);
  return product ? pageMetadata(`${product.name} 정보 | BLUEDEAL`, product.description, `/products/${product.id}`, true)
    : pageMetadata("등록된 상품이 없습니다 | BLUEDEAL", "상품 목록에서 다른 제품을 확인해 주세요.", undefined, true);
}

function Sources({ items }: { items: ProductSource[] }) {
  return <ul className="space-y-3">{items.map(source => <li key={source.url} className="min-w-0 text-sm leading-6"><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-cyan-200 underline underline-offset-4">{source.label}<span className="sr-only"> (새 창)</span></a>{source.observedAt ? <span className="mt-1 block text-xs text-white/60">확인 {catalogDate(source.observedAt)}</span> : <span className="mt-1 block text-xs text-white/60">기존 등록 출처 · 정확한 모델 상세 대조 필요</span>}</li>)}</ul>;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const product = getCatalogProduct((await params).id);
  if (!product) notFound();
  const informationCheckedAt = product.listObservedAt ?? product.sources.map(source => source.observedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return <article className="space-y-6">
    <nav aria-label="상품 경로" className="flex flex-wrap gap-2 text-sm text-white/65"><Link href="/products" className="text-cyan-200 hover:underline">상품 목록</Link><span aria-hidden="true">/</span><Link href={`/products?category=${product.category}`} className="hover:underline">{productCategoryLabel(product.category)}</Link></nav>
    <header className="bd-surface p-5 sm:p-7">
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">{productCategoryLabel(product.category)}</span><span className="rounded-full border border-white/15 px-3 py-1 text-white/75">{PRODUCT_KIND_LABELS[product.kind]}</span>{product.lifecycle === "listed-discontinued" ? <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-amber-100">제조사 단종 목록</span> : null}</div>
      <p className="mt-5 text-sm text-white/65">{product.brand}</p><h1 className="mt-2 break-words text-2xl font-semibold leading-relaxed tracking-tight sm:text-3xl">{product.name}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">{product.description}</p><p className="mt-3 text-xs text-white/55">상품 관리번호 {product.referenceCode}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Link href={`/contact/write?from=products&product=${product.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-100">상품 정보 수정·추가 요청</Link><Link href="/community/review" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-3 text-sm text-white/80 hover:bg-white/10">사용기 게시판</Link></div>
    </header>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-xl font-semibold">특징·상세 정보</h2>{product.features.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-white/80">{product.features.map(feature => <li key={feature}>{feature}</li>)}</ul> : <p className="mt-4 text-sm leading-7 text-white/70">추가 사양 자료를 확인하고 있습니다.</p>}
          {product.specifications.length ? <dl className="mt-5 divide-y divide-white/10 border-y border-white/10">{product.specifications.map(specification => <div key={`${specification.label}:${specification.value}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3 text-sm"><dt className="text-white/60">{specification.label}</dt><dd className="break-words text-white/85">{specification.value}</dd></div>)}</dl> : null}
          {product.notes.length ? <div className="mt-5 rounded-xl border border-amber-200/25 bg-amber-200/5 p-4"><h3 className="text-sm font-semibold text-amber-100">옵션 확인사항</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-7 text-white/75">{product.notes.map(note => <li key={note}>{note}</li>)}</ul></div> : null}
        </section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-xl font-semibold">장점·구매 전 확인</h2>{product.strengths.length ? <div className="mt-5 space-y-5">{product.strengths.map(strength => <div key={strength.title}><h3 className="font-semibold text-cyan-100">{strength.title}</h3><p className="mt-2 text-sm leading-7 text-white/80">{strength.detail}</p><p className="mt-2 text-sm leading-7 text-white/65">{strength.conditions}</p><div className="mt-3"><Sources items={strength.sources} /></div></div>)}</div> : <p className="mt-4 text-sm leading-7 text-white/70">장점과 사용 조건은 추가 조사 중입니다. 제품명이나 제조사 소개만으로 성능·품질 점수를 부여하지 않습니다.</p>}
          {product.issues.map(issue => <div key={issue.title} className="mt-5 rounded-xl border border-amber-200/30 bg-amber-200/5 p-4"><h3 className="font-semibold text-amber-100">{issue.title}</h3><p className="mt-3 text-sm leading-7 text-white/80">{issue.summary}</p><p className="mt-2 text-sm leading-7 text-white/70">{issue.conditions}</p><p className="mt-2 text-sm leading-7 text-white/85">{issue.action}</p><div className="mt-4"><Sources items={issue.sources} /></div></div>)}
        </section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-xl font-semibold">후기·사용기</h2><p className="mt-4 text-sm leading-7 text-white/75">{product.reviewSummary ?? "이 상품의 후기 경향은 아직 검토하지 않았습니다. 실제 구매자 후기와 독립 리뷰를 확인한 뒤 출처와 사용 조건을 함께 보완하겠습니다."}</p>{product.reviewSources.length ? <div className="mt-4"><Sources items={product.reviewSources} /></div> : null}<Link href="/community/review" className="mt-4 inline-flex min-h-11 items-center text-sm text-cyan-200 underline">커뮤니티 사용기 보기</Link></section>
      </div>

      <aside className="min-w-0 space-y-6">
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-lg font-semibold">확인 상태</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-white/60">항목 기준</dt><dd className="mt-1">{PRODUCT_KIND_LABELS[product.kind]}</dd></div><div><dt className="text-white/60">국내 판매·보증</dt><dd className="mt-1">{product.domesticState === "listing-observed" ? "판매 표기 확인 · 보증 조건 별도 확인" : "확인 필요"}</dd></div><div><dt className="text-white/60">정확한 제조사 품번</dt><dd className="mt-1">{product.manufacturerPartNumber ?? "확인 필요"}</dd></div><div><dt className="text-white/60">현재 가격·할인·재고</dt><dd className="mt-1">판매처 재확인 필요</dd></div><div><dt className="text-white/60">자료 확인일</dt><dd className="mt-1">{catalogDate(informationCheckedAt)}</dd></div></dl>{product.lifecycle === "listed-current" ? <p className="mt-5 text-xs leading-6 text-white/65">제조사 현행 목록에 포함된 항목입니다. 국내 판매 또는 재고 보유를 뜻하지 않습니다.</p> : null}</section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-lg font-semibold">공식 자료·출처</h2><div className="mt-4"><Sources items={product.sources} /></div></section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-lg font-semibold">판매처 연결</h2>{product.listings.length ? <><p className="mt-3 text-sm leading-7 text-white/70">확인한 판매 상품의 가격표입니다. 가격 확인일과 옵션을 함께 확인해 주세요.</p><ul className="mt-4 space-y-3">{product.listings.map(listing => <li key={listing.id}><Link href={listing.pricePage} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline">{listing.merchant} 등록 가격표 보기</Link><p className="break-words text-xs leading-6 text-white/60">{listing.seller}</p></li>)}</ul></> : <p className="mt-3 text-sm leading-7 text-white/70">같은 모델·옵션의 판매처를 확인하고 있습니다. 검증한 구매 링크를 연결하면 가격·배송·혜택 조건을 함께 안내하겠습니다.</p>}</section>
      </aside>
    </div>
  </article>;
}
