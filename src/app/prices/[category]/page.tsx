import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "../../../lib/priceCategories";
import type { PriceItem } from "../../../lib/mockPrices";
import { getPriceView } from "../../../lib/prices";
import SmartLink from "../../../components/SmartLink";
import ProductSearchForm from "../../../components/ProductSearchForm";
import DailyPcComparison from "../../../components/DailyPcComparison";
import CpuReferenceGuide from "../../../components/CpuReferenceGuide";
import GpuReferenceGuide from "../../../components/GpuReferenceGuide";
import { filterPrices, readPriceFilters } from "../../../lib/priceFilters";
import { pageMetadata } from "../../../lib/site";
import { getOfferAffiliateCodes } from "../../../lib/affiliateStore";
import { CATALOG_SUMMARY, CATALOG_PRODUCTS } from "../../../lib/catalogData";
import PriceCatalogSection from "../../../components/PriceCatalogSection";
import { formatPriceTime as fmtKorean, PriceAmount, PurchaseLink, fmtWon } from "../../../components/PriceOffer";
import distributorReview from "../../../content/distributorReviewSummary.json";
import distributorPromotions from "../../../content/distributorPromotions.json";
import cpuReviewSummary from "../../../content/cpuReviewSummary.json";
import ramReviewSummary from "../../../content/ramReviewSummary.json";
import ssdReviewSummary from "../../../content/ssdReviewSummary.json";
import gpuReviewSummary from "../../../content/gpuReviewSummary.json";
import coolingReviewSummary from "../../../content/coolingReviewSummary.json";
import caseReviewSummary from "../../../content/caseReviewSummary.json";
import systemsReviewSummary from "../../../content/systemsReviewSummary.json";
import mixedReviewSummary from "../../../content/mixedReviewSummary.json";
import hddReviewSummary from "../../../content/hddReviewSummary.json";
import pcOptionReviewSummary from "../../../content/pcOptionReviewSummary.json";
import halfpcOptionReviewSummary from "../../../content/halfpcOptionReviewSummary.json";
import pcFollowupReviewSummary from "../../../content/pcFollowupReviewSummary.json";
import { indexProductOffers, matchesProduct, matchesProductSearch, readProductFilters, searchProducts } from "../../../lib/productFilters";

type PricePageProps = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: PricePageProps) {
  const category = getCategory((await params).category);
  if (!category) return pageMetadata("상품·가격비교 | BLUEDEAL", "가격 카테고리를 찾을 수 없습니다.", undefined, true);
  const { data } = await getPriceView(category.key);
  const query = await searchParams;
  const filtered = Object.values(query).some(value => Array.isArray(value) ? value.some(Boolean) : Boolean(value));
  return pageMetadata(`${category.title} | BLUEDEAL`, `${category.description} 상품가·배송비·판매자·확인 시각을 함께 비교하세요.`, `/prices/${category.key}`, filtered || !data.items.length);
}

function pct(value?: number | null) {
  if (typeof value !== "number") return "기록 대기";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function ProductInfo({ item, officialLabel = "공식 사양" }: { item: PriceItem; officialLabel?: string }) {
  return (
    <div>
      <div className="font-semibold text-white">{item.name}</div>
      {item.spec ? <div className="mt-2 text-sm leading-relaxed text-white/75">{item.spec}</div> : null}
      {item.ssdDram ? <div className="mt-1 text-xs text-white/70">DRAM 캐시: {item.ssdDram === "present" ? "있음" : item.ssdDram === "absent" ? "없음" : "미확인"}</div> : null}
      <div className="mt-2 text-xs text-white/60">{[item.source, item.seller].filter(Boolean).join(" · ")}</div>
      {item.officialUrl ? (
        <SmartLink className="mt-2 inline-block text-xs text-cyan-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" href={item.officialUrl} title={`${item.name} ${officialLabel} (새 창)`}>
          {officialLabel} ↗
        </SmartLink>
      ) : null}
    </div>
  );
}

export default async function PricesCategoryPage({ params, searchParams }: PricePageProps) {
  const { category: categoryKey } = await params;
  const category = getCategory(categoryKey);
  if (!category) return notFound();
  const { meta, data, now } = await getPriceView(category.key);
  const query = await searchParams;
  const filters = readPriceFilters(query);
  const productFilters = readProductFilters(query, category.key);
  const products = CATALOG_PRODUCTS.filter(product => product.category === category.key);
  const offersById = indexProductOffers(products, data.items);
  const owners = new Map(products.flatMap(product => product.listings.map(listing => [listing.id, product] as const)));
  const matching = new Set(products.filter(product => matchesProduct(product, offersById.get(product.id) ?? [], productFilters)).map(product => product.id));
  const items = filterPrices(data.items, category.key, { ...filters, query: "" }).filter(item => {
    const product = owners.get(item.id);
    return Boolean(product && matching.has(product.id) && matchesProductSearch(product, [item], productFilters.q));
  });
  const results = searchProducts(products, offersById, productFilters, items);
  const matchedOffers = indexProductOffers(products, items);
  const canonicalQuery = { ...query, q: productFilters.q, lifecycle: productFilters.lifecycle };
  const affiliateCodes = await getOfferAffiliateCodes(items);
  const retailCount = (distributorReview.retailCategoryCounts as Record<string, number>)[category.key] ?? 0;
  const hasPurchaseLinks = items.some(item => Boolean(item.goCode));
  const reportHref = `/contact/write?from=prices&cat=${encodeURIComponent(category.shortTitle)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-white/60">
            <Link className="hover:text-white" href="/prices">상품·가격비교</Link>{" "}
            <span aria-hidden="true">/</span> <span className="text-white">{category.shortTitle}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{category.title}</h1>
          <p className="mt-2 text-sm text-white/70">{category.description}</p>
        </div>
        <div className="text-sm text-white/70">
          최근 가격 확인: <span className="text-white">{data.items.length ? fmtKorean(data.updatedAt) : "아직 없음"}</span>
          <div className="mt-1 text-xs text-white/60">{meta.schedule}</div>
        </div>
      </div>

      <div className="bd-surface-md p-4 text-sm leading-relaxed text-white/75">
        <p>등록 항목 <b className="text-cyan-200">{CATALOG_SUMMARY.categoryCounts[category.key]}개</b> · 판매처 가격 기록 <b className="text-cyan-200">{data.items.length}건</b></p>
        <nav aria-label="분류 내 바로가기" className="mt-2 flex flex-wrap gap-4 text-cyan-200"><a href="#registered-products" className="inline-flex min-h-11 items-center underline">등록 상품·특징</a><a href="#price-records" className="inline-flex min-h-11 items-center underline">판매처 가격 기록</a></nav>
      </div>

      {category.key === "fullpc" || category.key === "halfpc" ? <DailyPcComparison kind={category.key} now={now} /> : null}
      <ProductSearchForm category={category.key} products={products} offersById={offersById} query={query} />
      <PriceCatalogSection category={category} query={canonicalQuery} results={results} offersById={matchedOffers} now={now} />

      <section id="price-records" aria-labelledby="price-records-title" className="scroll-mt-24 space-y-4">
      <h2 id="price-records-title" className="text-xl font-semibold">판매처 가격 기록 <span className="text-cyan-200">{data.items.length}건</span></h2>
      {retailCount ? <div className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75"><p>{distributorReview.reviewedOn} KST, 서린 공식 판매 상세에서 이 분류의 수량1·선택 구성·가격·배송비 {retailCount}건을 추가 대조했습니다. 상품별 실제 확인 시각을 확인해 주세요.</p><p className="mt-2">쿠폰 상세는 로그인이 필요해 개인별 쿠폰·회원 혜택을 금액에서 차감하지 않았습니다. 공개 Npay 5% 안내는 상품금액 40만원 이상·최대6만원·대상카드 조건이며, 행사 이미지에 연도가 명시되지 않아 결제창 확인 전 할인액을 계산하지 않았습니다. <a href={distributorPromotions.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline">공식 행사 안내<span className="sr-only"> (새 창)</span></a></p></div> : null}
      {category.key === "cpu" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{cpuReviewSummary.reviewedOn} KST 기준, 과거 핫딜 {cpuReviewSummary.reviewedPosts}건을 모델·판매처별로 검토했습니다. 중복과 판매 구성을 구분해 {cpuReviewSummary.retailerModels}개 모델을 정리하고, 실제 판매 페이지에서 확인한 가격 {cpuReviewSummary.priceOffers}건을 제공합니다. 품절·인증 제한·결제수단·관부가세 미확인 상품은 확인되지 않은 금액을 현재가로 등록하지 않았습니다. 과거 포인트·경유·게임 증정 혜택은 현재 할인으로 간주하지 않습니다.</p> : null}
      {category.key === "ram" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{ramReviewSummary.reviewedOn} KST 기준, 과거 RAM 핫딜 {ramReviewSummary.reviewedPosts}건의 판매주소와 구성을 검토했습니다. 기존 가격 {ramReviewSummary.recheckedLegacyOffers}건을 다시 확인하고 현재 선택 구성의 가격 {ramReviewSummary.priceOffers}건을 제공합니다. 단품·세트, 총 용량·모듈 수, 색상·RGB·CL·AMD 패키지를 구분합니다. 품절·종료 행사와 확인되지 않은 옵션·접근 제한 상품은 금액을 추정하지 않았으며, 모든 원문이나 시장 전체의 현재가 확인이 끝났다는 뜻은 아닙니다.</p> : null}
      {category.key === "ssd" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{ssdReviewSummary.reviewedOn} KST 기준, 과거 SSD 분류 {ssdReviewSummary.reviewedPosts}건을 SSD 본품 후보 {ssdReviewSummary.ssdCandidates}건, 외장 케이스·도킹·허브 {ssdReviewSummary.accessories}건, HDD·NAS {ssdReviewSummary.hddNasCandidates}건으로 나눴습니다. 현재 선택 구성의 가격 {data.items.length}건을 제공하며, 용량·품번·방열판·수입 형태·국내 보증을 구분합니다. 품절·종료 행사·관부가세·미확인 옵션은 가격을 추정하지 않았습니다. 모든 원문의 현재가 확인이나 독립 성능·후기 검토가 끝났다는 뜻은 아닙니다.</p> : null}
      {category.key === "gpu" ? <div className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75"><p>{gpuReviewSummary.reviewedOn} KST 기준, 과거 GPU 분류 {gpuReviewSummary.reviewedPosts}건을 검토하고 있습니다. G마켓 GPU 판매 페이지 {gpuReviewSummary.verifiedGmarketListings}개에서 수량1 가격 {gpuReviewSummary.freshPriceOffers}건을 확인했으며, 다른 판매처 관측 {gpuReviewSummary.additionalMerchantObservations}건을 추가했습니다. 기존 품절 상품 {gpuReviewSummary.retainedOutOfStockOffers}건은 이전 가격·확인일을 보존한 과거 기록입니다.</p><p className="mt-2">리퍼·벌크 {gpuReviewSummary.refurbishedOffers}건은 상품 상태 필터에서 따로 볼 수 있습니다. 일반 판매 기록은 리퍼를 제외한 분류이며 모든 상품의 신품·보증 확인을 뜻하지 않습니다. 조립PC·지지대·묶음·응모성 행사 금액은 GPU 단품가로 사용하지 않았습니다. 정확한 제조사 품번·보증·성능·후기 검토는 계속 진행 중입니다.</p></div> : null}
      <div className="bd-surface-md p-4 text-sm leading-relaxed text-white/75">
        <p>표시된 금액은 <b className="text-white">확인 시점의 판매처 가격</b>입니다. 선택한 판매 상품을 안내하며, 전체 판매처의 최저가를 보장하지 않습니다.</p>
        <p className="mt-2">상품별 배송비·할인 조건·확인 시각을 확인해 주세요.</p>
        <p className="mt-2 text-white" role="note">{affiliateCodes.size > 0
          ? "이 포스팅은 제휴마케팅이 포함된 광고로 커미션을 지급 받습니다."
          : hasPurchaseLinks ? "이 페이지의 판매처 링크는 일반 링크입니다."
            : "상품별 판매 조건과 링크는 확인된 정보가 있을 때 표시합니다."}</p>
      </div>

      {category.key === "cooler" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{coolingReviewSummary.reviewedOn} KST 기준, 과거 쿨러 분류 {coolingReviewSummary.reviewedPosts}건에서 판매주소 {coolingReviewSummary.merchantObservations}개를 확인해 수량1 상품가·배송비 {coolingReviewSummary.freshPriceOffers}건을 등록했습니다. CPU 수랭·공랭, 시스템 팬, 방열판과 리퍼 상태를 구분합니다. 등록된 제조사 목록의 모든 모델에 국내 가격이 확인된 것은 아닙니다. 종료 행사·구매 불가·404·접근 제한 출처와 케이스·음료·휴대용 팬 혼입은 현재 쿨러 가격으로 사용하지 않았습니다.</p> : null}
      {category.key === "case" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{caseReviewSummary.reviewedOn} KST 기준, 과거 케이스 분류 {caseReviewSummary.originalCategoryPosts}건과 쿨러에서 옮긴 해외 케이스 {caseReviewSummary.transferredPosts}건을 검토했습니다. 실제 판매주소 {caseReviewSummary.merchantObservations}개에서 수량1 상품가·배송비 {caseReviewSummary.freshPriceOffers}건을 등록했습니다. 제조사 제품군과 실제 판매 색상·구성을 구분합니다. 리퍼 분류에 상품이 없거나 해외 배송·세금·개별 구성이 확인되지 않은 항목은 현재 가격으로 표시하지 않습니다. 판매 사양 충돌과 입고예정 미정 안내는 각 상품에서 확인하세요.</p> : null}
      {category.key === "halfpc" || category.key === "fullpc" ? (
        <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">
          {systemsReviewSummary.reviewedOn} KST 기준, 과거 {category.key === "halfpc" ? "반본체" : "완본체"} 후보 글 {systemsReviewSummary.totalCandidatePosts[category.key]}건 중 {systemsReviewSummary.reviewedPosts[category.key]}건을 첫 분류했습니다.
          이 분류에는 부품 묶음 후보에서 재분류한 항목도 포함하며, 등록 구성 {CATALOG_SUMMARY.categoryCounts[category.key]}개를 위 목록에서 확인할 수 있습니다.{" "}
          {category.key === "halfpc" ? <>{halfpcOptionReviewSummary.reviewedOn} KST에 판매처 {halfpcOptionReviewSummary.reviewedMerchantPages}개를 후속 확인해 수량1 합계 {halfpcOptionReviewSummary.verifiedQuotes}건을 가격표에 연결했습니다. 일반가 {halfpcOptionReviewSummary.ordinaryQuotes}건과 조건부 자동 쿠폰가 {halfpcOptionReviewSummary.conditionalCouponQuotes}건을 구분합니다. 최대 혜택가·수량 조건이 확인되지 않은 {halfpcOptionReviewSummary.unconfirmedQuotes}건은 구매가를 등록하지 않았습니다. 기존 접근 제한 {systemsReviewSummary.restrictedPosts.halfpc}건은 재시도하지 않았습니다.</> : <>
            수량1 금액·배송 안내가 확인된 {data.items.length}건을 가격표에 연결했습니다. 부품 묶음 후보에서 확인한 추가 판매 기록 {mixedReviewSummary.priceRecords.fullpc}건을 포함합니다. 자동 쿠폰·카드 금액은 대상·기간·중복조건을 추가 확인해야 하는 조건부 표시입니다.{" "}
            {systemsReviewSummary.remainingPosts.fullpc > 0 ? <>남은 {systemsReviewSummary.remainingPosts.fullpc}건은 아직 판매처 검토가 필요합니다.</> : <>후보 글의 첫 분류를 마쳤으며, 기존 접근 제한 {systemsReviewSummary.restrictedPosts.fullpc}건은 재시도하지 않았습니다. 품절·판매 종료·구성 식별 불가·옵션 미확인 항목을 현재 구매가로 등록하지 않았습니다.</>}
          </>}{" "}
          메인보드·SSD·파워 등 정확한 전체 부품 목록과 개별 구매가를 모두 확인하기 전에는 부품 등급·조립 대비 절약률·품질 점수를 산정하지 않습니다.
        </p>
      ) : null}
      {category.key === "bundle" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{mixedReviewSummary.reviewedOn} KST 기준, 부품 묶음 후보 {mixedReviewSummary.candidatePosts}건을 완본체·단일 부품·일부 부품 패키지로 구분했습니다. 실제 패키지 {mixedReviewSummary.packageModels}개는 확인 시점 품절 상태여서 현재 구매가를 등록하지 않았습니다. 제목에 없는 부품의 포함·미포함을 추정하지 않았고, 묶음 금액을 개별 부품 가격으로 나누지 않았습니다. 정확한 포함 구성·호환성·보증·부품별 구매가를 추가 확인해야 합니다.</p> : null}
      {category.key === "ram" ? <p className="text-sm leading-relaxed text-white/70">원문에서 복구한 판매주소 {mixedReviewSummary.recoveredRamPosts}건을 추가 확인해 이 표에는 가격 기록 총 {data.items.length}건을 제공합니다. CL28·CL30과 화이트·다른 색상은 별도 구성으로 구분합니다.</p> : null}
      {category.key === "hdd" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{hddReviewSummary.reviewedOn} KST 기준, SSD 분류에서 분리한 HDD·NAS 후보 {hddReviewSummary.reviewedPosts}건을 검토했습니다. WD 공식 데이터시트의 품번별 표를 대조한 HDD {hddReviewSummary.manufacturerModels}개를 등록했으며 현재 구매가 기록은 {data.items.length}건입니다. NAS 본체·다개입 패키지·검색 대표 상품의 금액을 HDD 단품 가격으로 사용하지 않았습니다. 기존 접근 제한 {hddReviewSummary.restrictedPosts}건은 재시도하지 않았고 국내 판매·배송·할인·유통사 보증은 추가 확인이 필요합니다.</p> : null}
      {category.key === "fullpc" ? <p className="text-sm leading-relaxed text-white/70">선택형 판매번호 {pcOptionReviewSummary.reviewedMerchantPages}개를 후속 확인해 기본 선택·수량1 가격 {pcOptionReviewSummary.verifiedQuotes}건을 추가했습니다. 기본 RAM·SSD 옵션이 품절인 {pcOptionReviewSummary.defaultOptionUnavailable}건은 현재 구매가에 넣지 않았습니다. 선택한 부품명·OS 포함 범위는 각 상품에서 확인하세요. ‘변경없음’ 표기만으로 정확한 부품 품번을 확정하지 않습니다.</p> : null}
      {category.key === "fullpc" ? <p className="text-sm leading-relaxed text-white/70">{pcFollowupReviewSummary.reviewedOn} KST에 남은 수량 합계 미확인 판매처 {pcFollowupReviewSummary.reviewedMerchantPages}건을 추가 검토해 선택 색상·수량1 쿠폰 합계 {pcFollowupReviewSummary.verifiedQuotes}건을 연결했습니다. 판매처 부품표 {pcFollowupReviewSummary.sellerComponentRows}종을 확인한 {pcFollowupReviewSummary.pendingMerchantIdentity}건은 판매 주체·OS·보증 추가 확인이 남아 새 구매가를 등록하지 않았습니다. <Link href="/products/reviewed-mixed-fullpc-himart-0058108391" className="text-cyan-200 underline underline-offset-4">부품표와 남은 확인사항 보기 →</Link></p> : null}
      <p className="text-sm text-white/70">전체 {data.items.length}개 중 <b className="text-white">{items.length}개</b> 표시 · 배송비 미확인 상품은 포함 금액 정렬에서 뒤에 표시하며, 품절 상품의 이전 기록은 모든 정렬에서 마지막에 표시합니다.</p>
      <p className="text-xs leading-relaxed text-white/65">같은 모델도 판매처별로 별도 집계합니다. 색상·구성·유통사·보증 조건을 함께 확인해 비교하세요.</p>

      {items.length === 0 ? (
        <div className="bd-surface-md px-4 py-10 text-center text-white/70">
          {data.items.length ? <>조건에 맞는 상품이 없습니다. <Link className="text-cyan-200 hover:underline" href={`/prices/${category.key}#price-records`}>필터 초기화</Link></> : <>{category.key === "bundle" ? "확인한 패키지는 품절 상태여서 현재 구매가를 등록하지 않았습니다." : "확인된 현재 구매가가 아직 없습니다."} {CATALOG_SUMMARY.categoryCounts[category.key] ? <a href="#registered-products" className="text-cyan-200 underline">위의 등록 상품·특징을 먼저 살펴보세요.</a> : null} <Link className="text-cyan-200 hover:underline" href={reportHref}>판매처 제보하기</Link></>}
        </div>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            {items.map((item) => (
              <article key={item.id} aria-label={item.name} className="bd-surface-md space-y-4 p-5">
                <ProductInfo item={item} officialLabel={category.key === "gpu" ? "GPU 공식 사양" : "공식 사양"} />
                <PriceAmount item={item} now={now} />
                <dl className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-xs">
                  <div><dt className="text-white/60">24시간 변동</dt><dd className="mt-1 text-white/80">{pct(item.change24hPct)}</dd></div>
                  <div><dt className="text-white/60">7일 관측 최저</dt><dd className="mt-1 text-white/80">{typeof item.low7d === "number" ? fmtWon(item.low7d) : "기록 대기"}</dd></div>
                  <div><dt className="text-white/60">30일 관측 최저</dt><dd className="mt-1 text-white/80">{typeof item.low30d === "number" ? fmtWon(item.low30d) : "기록 대기"}</dd></div>
                </dl>
                <PurchaseLink item={item} affiliate={affiliateCodes.has(item.goCode ?? "")} />
              </article>
            ))}
          </div>

          <div className="bd-surface-md hidden md:block">
            <div className="overflow-x-auto rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" tabIndex={0} role="region" aria-label={`${category.shortTitle} 가격 비교표, 가로 스크롤 가능`}>
              <table className="w-full min-w-[1060px] text-sm">
                <caption className="sr-only">확인한 {category.shortTitle} 판매 상품 {items.length}개. 가격과 배송비는 원화 기준입니다.</caption>
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th scope="col" className="w-72 px-4 py-3 text-left font-medium">제품 · 판매자</th>
                    <th scope="col" className="w-64 px-4 py-3 text-left font-medium">확인 시점 가격</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">24시간 변동</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">7일 관측 최저</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">30일 관측 최저</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">판매처</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} id={item.id} className="scroll-mt-24 border-t border-white/10 align-top">
                      <th scope="row" className="px-4 py-5 text-left font-normal"><ProductInfo item={item} officialLabel={category.key === "gpu" ? "GPU 공식 사양" : "공식 사양"} /></th>
                      <td className="px-4 py-5"><PriceAmount item={item} now={now} /></td>
                      <td className="whitespace-nowrap px-3 py-5 text-right text-white/70">{pct(item.change24hPct)}</td>
                      <td className="whitespace-nowrap px-3 py-5 text-right text-white/70">{typeof item.low7d === "number" ? fmtWon(item.low7d) : "기록 대기"}</td>
                      <td className="whitespace-nowrap px-3 py-5 text-right text-white/70">{typeof item.low30d === "number" ? fmtWon(item.low30d) : "기록 대기"}</td>
                      <td className="px-4 py-5 text-right"><PurchaseLink item={item} affiliate={affiliateCodes.has(item.goCode ?? "")} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-white/60">상품가 관측 기록 기준입니다. 24시간 전후의 비교 기록이 없거나 7일·30일의 기록 기간을 채우지 못하면 ‘기록 대기’로 표시합니다. 기록 사이의 가격 변동은 반영되지 않을 수 있습니다.</p>
        </>
      )}

      </section>

      {category.key === "cpu" ? <CpuReferenceGuide /> : null}
      {category.key === "gpu" ? <GpuReferenceGuide /> : null}

      <div className="bd-surface-md p-5 text-sm leading-relaxed text-white/70">
        <div className="font-semibold text-white">구매 전 확인</div>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>구매 시점의 가격·재고·배송 조건은 판매처에서 다시 확인해 주세요. 상품·공식 사양 링크는 새 창으로 열립니다.</li>
          {category.key === "ram" ? <li>6000MT/s 등 표기 속도는 오버클럭 프로필 기준입니다. CPU·메인보드의 지원 사양과 QVL을 확인하고 BIOS에서 XMP/EXPO 설정이 필요한지 확인해 주세요.</li> : null}
          {category.key === "ram" ? <li>32GB(16GB×2)·48GB(24GB×2)는 두 모듈을 합한 키트 총용량입니다. 데스크톱 UDIMM 규격과 슬롯 수, 메모리 높이·쿨러 간섭을 확인하고 서로 다른 키트를 섞어 사용할 때는 호환성을 별도로 확인해 주세요.</li> : null}
          {category.key === "ssd" ? <li>SSD의 슬롯 규격과 지원 인터페이스를 확인해 주세요. DRAM ‘미확인’은 자료에서 탑재 여부를 확정하지 못한 상태이며, HMB 지원을 DRAM 탑재로 취급하지 않습니다.</li> : null}
          {category.key === "cpu" ? <li>메인보드의 CPU 지원 목록과 필요한 BIOS 버전, 쿨러 포함 여부를 확인해 주세요. 같은 CPU라도 박스형·멀티팩·판매처 번들의 구성과 보증 조건은 다를 수 있습니다.</li> : null}
          {category.key === "gpu" ? <li>GPU 공식 사양은 NVIDIA 기준입니다. 실제 판매 카드의 길이·두께, 케이스 공간, 파워 용량·전원 커넥터, 모니터 출력 단자와 유통사 보증을 제품별로 확인해 주세요.</li> : null}
        </ul>
        <p className="mt-4">가격 오류·상품 추가 요청은 <Link className="text-cyan-200 hover:underline" href={reportHref}>비공개 문의</Link>로 남겨주세요.</p>
        <p className="mt-2">구매 팁·제휴 문의는 <Link className="text-cyan-200 hover:underline" href="/contact/write?vis=public">공개 문의 게시판</Link>을 이용해 주세요.</p>
      </div>
    </div>
  );
}
