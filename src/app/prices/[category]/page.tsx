import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "../../../lib/priceCategories";
import type { PriceItem } from "../../../lib/mockPrices";
import { getPriceView } from "../../../lib/prices";
import SmartLink from "../../../components/SmartLink";
import PriceFilterForm from "../../../components/PriceFilterForm";
import CpuReferenceGuide from "../../../components/CpuReferenceGuide";
import GpuReferenceGuide from "../../../components/GpuReferenceGuide";
import { filterPrices, priceFreshness, readPriceFilters } from "../../../lib/priceFilters";
import { pageMetadata } from "../../../lib/site";
import { OUTBOUND_LINKS } from "../../../lib/outbound";
import { resolveAffiliateUrl } from "../../../lib/affiliate";
import { CATALOG_SUMMARY } from "../../../lib/catalogData";
import PriceCatalogSection from "../../../components/PriceCatalogSection";
import { priceBenefits } from "../../../lib/priceBenefits";
import cpuReviewSummary from "../../../content/cpuReviewSummary.json";
import ramReviewSummary from "../../../content/ramReviewSummary.json";
import ssdReviewSummary from "../../../content/ssdReviewSummary.json";

type PricePageProps = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: PricePageProps) {
  const category = getCategory((await params).category);
  if (!category) return pageMetadata("가격현황 | BLUEDEAL", "가격 카테고리를 찾을 수 없습니다.", undefined, true);
  const { data } = await getPriceView(category.key);
  const query = await searchParams;
  const filtered = Object.values(query).some(value => Array.isArray(value) ? value.some(Boolean) : Boolean(value));
  return pageMetadata(`${category.title} | BLUEDEAL`, `${category.description} 상품가·배송비·판매자·확인 시각을 함께 비교하세요.`, `/prices/${category.key}`, filtered || !data.items.length);
}

function fmtKorean(ts?: string) {
  if (!ts) return "확인 전";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "확인 전";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) + " KST";
}

function fmtWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

function pct(value?: number | null) {
  if (typeof value !== "number") return "기록 대기";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function PriceAmount({ item, now }: { item: PriceItem; now: number }) {
  const shippingFee = item.shippingFee;
  const freshness = priceFreshness(item, now);
  return (
    <div>
      <div className="text-lg font-semibold text-white">{fmtWon(item.price)}</div>
      {item.instantPrice || item.couponPrice || item.cardPrice ? <div className="text-xs text-white/65">{item.instantPrice ? "조건부 할인 적용 전 상품가" : "쿠폰·카드 적용 전 상품가"}</div> : null}
      <div className="mt-1 text-xs text-white/70">
        {typeof shippingFee === "number" ? (shippingFee === 0 ? "기본 배송비 무료" : `기본 배송비 ${fmtWon(shippingFee)}`) : "배송비 판매처 확인"}
      </div>
      {typeof shippingFee === "number" ? <div className="mt-1 text-xs text-cyan-200">배송비 포함 {fmtWon(item.price + shippingFee)}</div> : null}
      {item.shippingNote ? <div className="mt-1 text-xs text-white/60">{item.shippingNote}</div> : null}
      {item.priceNote ? <div className="mt-2 max-w-xs text-xs leading-relaxed text-white/70">{item.priceNote}</div> : null}
      {priceBenefits(item, now).map(benefit => <details key={benefit.kind} className="mt-3 max-w-xs rounded-lg border border-cyan-200/20 p-2 text-xs leading-6">
        <summary className="cursor-pointer text-cyan-100">{benefit.state === "expired" ? "종료된 혜택 기록 · " : benefit.state === "upcoming" ? "시작 전 혜택 기록 · " : "조건부 "}{benefit.kind === "instant" ? "즉시할인가" : benefit.kind === "coupon" ? "쿠폰가" : item.cardRequiresCoupon ? "쿠폰+카드가" : "카드가"} {fmtWon(benefit.amount)} · 조건 보기</summary>
        <p className="mt-2 text-white/80">{benefit.note}</p>
        <p className="mt-2 text-white/65">{benefit.startsOn ? `${benefit.startsOn}부터 · ` : ""}{benefit.endsAt ? `${fmtKorean(benefit.endsAt)} 종료` : benefit.endsOn ? `${benefit.endsOn}까지 (KST)` : "종료일 미확인 · 판매처 재확인"}</p>
        {benefit.kind === "card" && item.cardRequiresCoupon ? <p className="text-amber-100">쿠폰 발급·유효기간도 함께 충족해야 합니다.</p> : null}
        <p className="text-white/65">배송비 별도 · 확인 시점 표시가 · 개인별 적용은 결제 전 확인</p>
      </details>)}
      <div className="mt-2 text-xs text-white/60">확인 {fmtKorean(item.checkedAt || item.updatedAt)}</div>
      {freshness === "stale" ? <div className="mt-2 text-xs text-amber-200">확인 후 24시간 경과 · 판매처 가격 재확인</div> : null}
      {freshness === "unknown" ? <div className="mt-2 text-xs text-amber-200">가격 확인 시각 미확인</div> : null}
      <div className="mt-1 text-xs text-white/60">{item.availability === "out-of-stock" ? "확인 시점 품절 · 재입고 여부 판매처 확인" : item.availability === "in-stock" ? "확인 시점 판매 중 · 현재 재고는 판매처 확인" : "재고는 판매처에서 확인해 주세요"}</div>
    </div>
  );
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

function PurchaseLink({ item, affiliate }: { item: PriceItem; affiliate: boolean }) {
  if (!item.goCode) return <span className="text-xs text-white/60">판매처 링크 준비 중</span>;
  return (
    <div className="space-y-1"><SmartLink
      className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      href={`/go/${item.goCode}`}
      rel={affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
      title={`${item.name} 판매처 보기 (새 창)`}
    >
      판매처 보기 ↗
    </SmartLink><div className="text-xs text-white/65">{affiliate ? "제휴 링크" : "일반 링크"}</div></div>
  );
}

export default async function PricesCategoryPage({ params, searchParams }: PricePageProps) {
  const { category: categoryKey } = await params;
  const category = getCategory(categoryKey);
  if (!category) return notFound();
  const { meta, data, now } = await getPriceView(category.key);
  const query = await searchParams;
  const filters = readPriceFilters(query);
  const items = filterPrices(data.items, category.key, filters);
  const affiliateCodes = new Set<string>();
  for (const item of items) {
    if (!item.goCode) continue;
    const outbound = OUTBOUND_LINKS[item.goCode];
    const resolution = outbound ? resolveAffiliateUrl(outbound) : null;
    if (resolution && resolution.mode !== "passthrough") affiliateCodes.add(item.goCode);
  }
  const hasPurchaseLinks = items.some(item => Boolean(item.goCode));
  const reportHref = `/contact/write?from=prices&cat=${encodeURIComponent(category.shortTitle)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-white/60">
            <Link className="hover:text-white" href="/prices">가격현황</Link>{" "}
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

      <PriceCatalogSection category={category} query={query} />

      <section id="price-records" aria-labelledby="price-records-title" className="scroll-mt-24 space-y-4">
      <h2 id="price-records-title" className="text-xl font-semibold">판매처 가격 기록 <span className="text-cyan-200">{data.items.length}건</span></h2>
      {category.key === "cpu" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{cpuReviewSummary.reviewedOn} KST 기준, 과거 핫딜 {cpuReviewSummary.reviewedPosts}건을 모델·판매처별로 검토했습니다. 중복과 판매 구성을 구분해 {cpuReviewSummary.retailerModels}개 모델을 정리하고, 실제 판매 페이지에서 확인한 가격 {cpuReviewSummary.priceOffers}건을 제공합니다. 품절·인증 제한·결제수단·관부가세 미확인 상품은 확인되지 않은 금액을 현재가로 등록하지 않았습니다. 과거 포인트·경유·게임 증정 혜택은 현재 할인으로 간주하지 않습니다.</p> : null}
      {category.key === "ram" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{ramReviewSummary.reviewedOn} KST 기준, 과거 RAM 핫딜 {ramReviewSummary.reviewedPosts}건의 판매주소와 구성을 검토했습니다. 기존 가격 {ramReviewSummary.recheckedLegacyOffers}건을 다시 확인하고 현재 선택 구성의 가격 {ramReviewSummary.priceOffers}건을 제공합니다. 단품·세트, 총 용량·모듈 수, 색상·RGB·CL·AMD 패키지를 구분합니다. 품절·종료 행사와 확인되지 않은 옵션·접근 제한 상품은 금액을 추정하지 않았으며, 모든 원문이나 시장 전체의 현재가 확인이 끝났다는 뜻은 아닙니다.</p> : null}
      {category.key === "ssd" ? <p className="rounded-xl border border-cyan-200/20 bg-cyan-200/5 p-4 text-sm leading-relaxed text-white/75">{ssdReviewSummary.reviewedOn} KST 기준, 과거 SSD 분류 {ssdReviewSummary.reviewedPosts}건을 SSD 본품 후보 {ssdReviewSummary.ssdCandidates}건, 외장 케이스·도킹·허브 {ssdReviewSummary.accessories}건, HDD·NAS {ssdReviewSummary.hddNasCandidates}건으로 나눴습니다. 현재 선택 구성의 가격 {ssdReviewSummary.priceOffers}건을 제공하며, 용량·품번·방열판·수입 형태·국내 보증을 구분합니다. 품절·종료 행사·관부가세·미확인 옵션은 가격을 추정하지 않았습니다. 모든 원문의 현재가 확인이나 독립 성능·후기 검토가 끝났다는 뜻은 아닙니다.</p> : null}
      <div className="bd-surface-md p-4 text-sm leading-relaxed text-white/75">
        <p>표시된 금액은 <b className="text-white">확인 시점의 판매처 가격</b>입니다. 선택한 판매 상품을 안내하며, 전체 판매처의 최저가를 보장하지 않습니다.</p>
        <p className="mt-2">상품별 배송비·할인 조건·확인 시각을 확인해 주세요.</p>
        <p className="mt-2 text-white" role="note">{affiliateCodes.size > 0
          ? "이 포스팅은 제휴마케팅이 포함된 광고로 커미션을 지급 받습니다."
          : hasPurchaseLinks ? "이 페이지의 판매처 링크는 일반 링크입니다."
            : "상품별 판매 조건과 링크는 확인된 정보가 있을 때 표시합니다."}</p>
      </div>

      {data.items.length ? <PriceFilterForm category={category.key} items={data.items} filters={filters} /> : null}
      <p className="text-sm text-white/70">전체 {data.items.length}개 중 <b className="text-white">{items.length}개</b> 표시 · 배송비 미확인 상품은 포함 금액 정렬에서 마지막에 표시합니다.</p>
      <p className="text-xs leading-relaxed text-white/65">같은 모델도 판매처별로 별도 집계합니다. 색상·구성·유통사·보증 조건을 함께 확인해 비교하세요.</p>

      {items.length === 0 ? (
        <div className="bd-surface-md px-4 py-10 text-center text-white/70">
          {data.items.length ? <>조건에 맞는 상품이 없습니다. <Link className="text-cyan-200 hover:underline" href={`/prices/${category.key}#price-records`}>필터 초기화</Link></> : <>판매처 가격·재고는 아직 확인하지 못했습니다. {CATALOG_SUMMARY.categoryCounts[category.key] ? <a href="#registered-products" className="text-cyan-200 underline">위의 등록 상품·특징을 먼저 살펴보세요.</a> : null} <Link className="text-cyan-200 hover:underline" href={reportHref}>판매처 제보하기</Link></>}
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
