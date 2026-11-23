import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CATALOG_PRODUCTS, getCatalogProduct } from "../../../lib/catalogData";
import { catalogDate, PRODUCT_KIND_LABELS, productCategoryLabel } from "../../../lib/productCatalog";
import type { ProductSource } from "../../../lib/productCatalog";
import { pageMetadata } from "../../../lib/site";
import { getPriceView } from "../../../lib/prices";
import { getOfferAffiliateCodes } from "../../../lib/affiliateStore";
import { PriceAmount, PurchaseLink } from "../../../components/PriceOffer";
import { productHighlights } from "../../../lib/productFilters";
import FullPcConfiguration from "../../../components/FullPcConfiguration";
import fullPcReviews from "../../../content/fullPcReviews.json";
import { getCaseOptionPhoto, getCaseOptions, getPartEditorial, getProductEditorial, getProductPhoto, productEditorialCheckedOn } from "../../../lib/productEditorial";
import ProductPhoto from "../../../components/ProductPhoto";
import CaseOptionGallery from "../../../components/CaseOptionGallery";
import { getProductBuyingNotes } from "../../../lib/productBuyingNotes";
import { productMarketplaceLinks } from "../../../lib/productMarketplace";
import MarketplacePriceLinks from "../../../components/MarketplacePriceLinks";

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
  if (product.listings.length || productMarketplaceLinks(product.id, []).length) await connection();
  const { data, now } = await getPriceView(product.category);
  const listingIds = new Set(product.listings.map(listing => listing.id));
  const offers = data.items.filter(item => listingIds.has(item.id));
  const highlights = productHighlights(product, offers);
  const componentSpecs = product.specifications.filter(spec => /^판매처 (부품표|기본사양) · /.test(spec.label));
  const configurationReview = fullPcReviews.find(review => review.productId === product.id && !review.configuration);
  const editorial = getProductEditorial(product.id);
  const buyingNotes = getProductBuyingNotes(product);
  const documentedIssue = editorial?.issue ?? buyingNotes?.issue;
  const advantage = editorial?.advantage ?? buyingNotes?.advantage;
  const caution = editorial?.caution ?? buyingNotes?.caution;
  const casePhoto = configurationReview ? getPartEditorial(configurationReview.parts.case)?.photo : undefined;
  const photo = getProductPhoto(product.id) ?? casePhoto;
  const caseOptions = getCaseOptions(product.id);
  const productNotes = caseOptions
    ? product.notes.map(note => note === "제품군 기준입니다. 색상·패널·팬 구성에 따른 정확한 옵션은 확인 중입니다."
      ? "제조사에서 확인한 색상·패널 사진을 위에서 선택할 수 있습니다. 팬 구성과 국내 구매 가능 옵션은 판매처에서 확인하세요."
      : note)
    : product.notes;
  const marketLinks = productMarketplaceLinks(product.id, offers);
  const affiliateCodes = await getOfferAffiliateCodes([...offers, ...marketLinks]);
  const sponsoredMarketLinks = marketLinks.filter(link => affiliateCodes.has(link.goCode));
  const informationCheckedAt = [product.listObservedAt, ...product.sources.map(source => source.observedAt)].filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
  return <article className="space-y-6">
    <nav aria-label="상품 경로" className="flex flex-wrap gap-2 text-sm text-white/65"><Link href="/prices" className="text-cyan-200 hover:underline">상품·가격비교</Link><span aria-hidden="true">/</span><Link href={`/prices/${product.category}`} className="hover:underline">{productCategoryLabel(product.category)}</Link></nav>
    <header className={`bd-surface p-5 sm:p-7 ${photo ? "grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.7fr)]" : ""}`}>
      <div className="min-w-0">
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">{productCategoryLabel(product.category)}</span><span className="rounded-full border border-white/15 px-3 py-1 text-white/75">{PRODUCT_KIND_LABELS[product.kind]}</span>{product.lifecycle === "listed-discontinued" ? <span className="rounded-full border border-amber-200/30 bg-amber-200/10 px-3 py-1 text-amber-100">제조사 단종 목록</span> : null}</div>
      <p className="mt-5 text-sm text-white/65">{product.brand}</p><h1 className="mt-2 break-words text-2xl font-semibold leading-relaxed tracking-tight sm:text-3xl">{product.name}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">{product.description}</p><p className="mt-3 text-xs text-white/55">상품 관리번호 {product.referenceCode}</p>
      {highlights.length ? <dl className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-3">{highlights.map(({ key, label, value }) => <div key={key} className="rounded-xl border border-white/15 bg-slate-950/25 p-3" data-spec-summary={key}>
        <dt className="text-xs text-white/70">{label}</dt><dd className="mt-1 break-words font-semibold text-cyan-100">{value}</dd>
      </div>)}</dl> : null}
      <div className="mt-5 flex flex-wrap gap-3"><Link href={`/contact/write?from=products&product=${product.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-100">상품 정보 수정·추가 요청</Link><Link href="/community/review" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-3 text-sm text-white/80 hover:bg-white/10">사용기 게시판</Link></div>
      </div>
      {photo ? <div id="product-photo" className="min-w-0 scroll-mt-24">
        {casePhoto ? <p className="mb-2 text-sm text-white/75">기본 케이스 외관</p> : null}
        {caseOptions?.length ? <CaseOptionGallery key={product.id} options={caseOptions.map(option => ({ label: option.label, photo: getCaseOptionPhoto(option) }))} /> : <ProductPhoto photo={photo} />}
      </div> : null}
    </header>

    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <section id="product-prices" className="bd-surface-md scroll-mt-24 p-5 sm:p-6" aria-labelledby="product-prices-title">
          <h2 id="product-prices-title" className="text-xl font-semibold">판매처별 가격·할인</h2>
          <p className="mt-3 text-sm leading-7 text-white/75">확인 시점의 가격입니다. 같은 모델·용량·옵션과 보증 조건인지 확인해 주세요. 전체 판매처의 최저가를 보장하지 않습니다.</p>
          {affiliateCodes.size ? <p className="mt-3 text-sm leading-7 text-white" role="note">이 페이지에는 제휴 링크가 포함되어 있습니다. 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다.</p> : null}
          {sponsoredMarketLinks.length ? <div className="mt-4 space-y-2">
            <MarketplacePriceLinks links={sponsoredMarketLinks} />
            <p className="text-xs leading-6 text-white/65">현재 판매가·배송비·할인 조건은 각 판매처에서 확인할 수 있습니다.</p>
          </div> : null}
          {offers.length ? <>
            {!affiliateCodes.size ? <p className="mt-3 text-sm leading-7 text-white" role="note">이 상품의 판매처 링크는 일반 링크입니다.</p> : null}
            <ul className="mt-5 space-y-5">{offers.map(item => <li key={item.id} className="rounded-xl border border-white/15 p-4">
              <h3 className="break-words font-semibold">{item.name}</h3>
              <p className="mt-2 break-words text-sm text-white/65">{[item.source, item.seller].filter(Boolean).join(" · ")}</p>
              {item.spec ? <p className="mt-2 text-sm leading-7 text-white/80">{item.spec}</p> : null}
              <div className="mt-4"><PriceAmount item={item} now={now} /></div>
              <div className="mt-4"><PurchaseLink item={item} affiliate={affiliateCodes.has(item.goCode ?? "")} /></div>
            </li>)}</ul>
          </> : <p className="mt-4 text-sm leading-7 text-white/70">블루딜에 기록된 판매가는 아직 없습니다.</p>}
          <Link href={`/prices/${product.category}`} className="mt-4 inline-flex min-h-11 items-center text-sm text-cyan-200 underline">같은 부품의 다른 상품 비교</Link>
        </section>
        {configurationReview ? <section id="fullpc-configuration" className="bd-surface-md scroll-mt-24 space-y-4 p-5 sm:p-6" aria-labelledby="fullpc-configuration-title">
          <h2 id="fullpc-configuration-title" className="text-xl font-semibold">완본체 부품 구성</h2>
          <FullPcConfiguration review={configurationReview} />
        </section> : null}
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-xl font-semibold">특징·상세 정보</h2>{product.features.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-white/80">{product.features.map(feature => <li key={feature}>{feature}</li>)}</ul> : <p className="mt-4 text-sm leading-7 text-white/70">추가 사양 자료를 확인하고 있습니다.</p>}
          {product.specifications.length ? <dl className="mt-5 divide-y divide-white/10 border-y border-white/10">{product.specifications.map(specification => <div key={`${specification.label}:${specification.value}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 py-3 text-sm"><dt className="text-white/60">{specification.label}</dt><dd className="break-words text-white/85">{specification.value}</dd></div>)}</dl> : null}
          {productNotes.length ? <div className="mt-5 rounded-xl border border-amber-200/25 bg-amber-200/5 p-4"><h3 className="text-sm font-semibold text-amber-100">옵션 확인사항</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-7 text-white/75">{productNotes.map(note => <li key={note}>{note}</li>)}</ul></div> : null}
        </section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-xl font-semibold">장점·구매 전 확인</h2>
          {advantage && caution ? <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-cyan-200/20 p-4"><dt className="font-semibold text-cyan-100">장점</dt><dd className="mt-2 text-sm leading-7 text-white/80">{advantage}</dd></div>
              <div className="rounded-xl border border-amber-200/20 p-4"><dt className="font-semibold text-amber-100">구매 전 확인</dt><dd className="mt-2 text-sm leading-7 text-white/80">{caution}</dd></div>
            </dl>
            {editorial ? <p className="mt-3 text-xs leading-6 text-white/70">{productEditorialCheckedOn} KST 확인 · <a className="text-cyan-200 underline" href={editorial.source} target="_blank" rel="noopener noreferrer">사양 근거<span className="sr-only"> (새 창)</span></a></p> : buyingNotes ? <details className="mt-3">
              <summary className="cursor-pointer text-sm text-cyan-200">사양 근거와 확인 날짜</summary>
              <div className="mt-3"><Sources items={buyingNotes.sources} /></div>
            </details> : null}
          </> : null}
          {product.strengths.length ? <div className="mt-5 space-y-5">{product.strengths.map(strength => <div key={strength.title}><h3 className="font-semibold text-cyan-100">{strength.title}</h3><p className="mt-2 text-sm leading-7 text-white/80">{strength.detail}</p><p className="mt-2 text-sm leading-7 text-white/65">{strength.conditions}</p><div className="mt-3"><Sources items={strength.sources} /></div></div>)}</div> : !advantage ? <p className="mt-4 text-sm leading-7 text-white/70">장점과 사용 조건은 추가 조사 중입니다.</p> : null}
          {documentedIssue ? <div className="mt-5 rounded-xl border border-amber-200/30 bg-amber-200/5 p-4">
            <h3 className="font-semibold text-amber-100">공식 공지로 확인한 이슈</h3>
            <p className="mt-2 text-sm leading-7 text-white/80">{documentedIssue.text}</p>
            <a className="mt-2 inline-block text-sm text-cyan-200 underline" href={documentedIssue.source} target="_blank" rel="noopener noreferrer">이슈 출처<span className="sr-only"> (새 창)</span></a>
          </div> : null}
          {product.issues.map(issue => <div key={issue.title} className="mt-5 rounded-xl border border-amber-200/30 bg-amber-200/5 p-4"><h3 className="font-semibold text-amber-100">{issue.title}</h3><p className="mt-3 text-sm leading-7 text-white/80">{issue.summary}</p><p className="mt-2 text-sm leading-7 text-white/70">{issue.conditions}</p><p className="mt-2 text-sm leading-7 text-white/85">{issue.action}</p><div className="mt-4"><Sources items={issue.sources} /></div></div>)}
        </section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-xl font-semibold">후기·사용기</h2><p className="mt-4 text-sm leading-7 text-white/75">{product.reviewSummary ?? "이 상품의 후기 경향은 아직 검토하지 않았습니다. 실제 구매자 후기와 독립 리뷰를 확인한 뒤 출처와 사용 조건을 함께 보완하겠습니다."}</p>{product.reviewSources.length ? <div className="mt-4"><Sources items={product.reviewSources} /></div> : null}<Link href="/community/review" className="mt-4 inline-flex min-h-11 items-center text-sm text-cyan-200 underline">커뮤니티 사용기 보기</Link></section>
      </div>

      <aside className="min-w-0 space-y-6">
        {product.category === "fullpc" || product.category === "halfpc" ? <section className="bd-surface-md p-5 sm:p-6" aria-labelledby="pc-savings-title">
          <h2 id="pc-savings-title" className="text-lg font-semibold">조립 대비 절약률</h2>
          <p className="mt-3 font-semibold text-amber-100">동일 구성 가격 대조 중</p>
          <p className="mt-3 text-sm leading-7 text-white/75">{configurationReview ? "판매처의 기본 부품 8종을 확인했습니다. " : componentSpecs.length ? `판매처 부품표 ${componentSpecs.length}개 항목을 상세 사양에 기록했습니다. ` : "정확한 전체 부품 구성을 확인하고 있습니다. "}각 부품의 동일 모델·옵션 가격과 배송비, 본체의 최종 결제금액·OS·보증 조건을 대조한 뒤 절약률을 제공합니다.</p>
          <Link href="/evaluate" className="mt-3 inline-flex min-h-11 items-center text-sm text-cyan-200 underline">직접 확인한 구성 비용 계산하기</Link>
          <Link href={`/prices/${product.category}#today-pc`} className="block text-sm text-cyan-200 underline py-3">오늘의 가격·부품 구성 비교</Link>
        </section> : null}
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-lg font-semibold">확인 상태</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-white/60">항목 기준</dt><dd className="mt-1">{PRODUCT_KIND_LABELS[product.kind]}</dd></div><div><dt className="text-white/60">국내 판매·보증</dt><dd className="mt-1">{product.domesticState === "listing-observed" ? "판매 표기 확인 · 보증 조건 별도 확인" : "확인 필요"}</dd></div><div><dt className="text-white/60">정확한 제조사 품번</dt><dd className="mt-1">{product.manufacturerPartNumber ?? "확인 필요"}</dd></div><div><dt className="text-white/60">현재 가격·할인·재고</dt><dd className="mt-1">판매처 재확인 필요</dd></div><div><dt className="text-white/60">자료 확인일</dt><dd className="mt-1">{catalogDate(informationCheckedAt)}</dd></div></dl>{product.lifecycle === "listed-current" ? <p className="mt-5 text-xs leading-6 text-white/65">제조사 현행 목록에 포함된 항목입니다. 국내 판매 또는 재고 보유를 뜻하지 않습니다.</p> : null}</section>
        <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-lg font-semibold">공식 자료·출처</h2><div className="mt-4"><Sources items={product.sources} /></div></section>
        {product.listings.length ? <section className="bd-surface-md p-5 sm:p-6"><h2 className="text-lg font-semibold">판매처 연결</h2><p className="mt-3 text-sm leading-7 text-white/70">가격 확인일과 옵션을 함께 확인해 주세요.</p><ul className="mt-4 space-y-3">{product.listings.map(listing => <li key={listing.id}><Link href={listing.pricePage} className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline">{listing.merchant} 등록 가격표 보기</Link><p className="break-words text-xs leading-6 text-white/60">{listing.seller}</p></li>)}</ul></section> : null}
      </aside>
    </div>
  </article>;
}
