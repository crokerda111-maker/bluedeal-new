import Link from "next/link";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";
import { getMeta, getPrices } from "../../lib/prices";
import { CATALOG_PRODUCTS, CATALOG_SUMMARY } from "../../lib/catalogData";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata("PC 상품·가격현황 | BLUEDEAL", "분류별 등록 상품의 특징과 확인한 판매처 가격·배송 조건·확인 시각을 함께 살펴보세요.", "/prices");

function fmtKorean(ts: string) {
  if (!ts) return "확인 전";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "확인 전";
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) + " KST";
}

export default async function PricesHubPage() {
  const [meta, prices] = await Promise.all([
    getMeta(),
    Promise.all(PRICE_CATEGORIES.map(category => getPrices(category.key))),
  ]);
  const itemCount = prices.reduce((total, category) => total + category.items.length, 0);
  const populatedCount = prices.filter(category => category.items.length > 0).length;

  return (
    <div className="space-y-8">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">상품·가격현황</h1>
            <p className="mt-2 text-sm text-white/70">
              분류를 선택하면 등록 상품의 특징과 판매처 가격 기록을 함께 볼 수 있습니다.
            </p>
          </div>
          <div className="text-sm text-white/70">
            최근 가격 확인: <span className="text-white">{fmtKorean(meta.updatedAt)}</span>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#050b18]/60 p-4"><dt className="text-xs text-white/65">등록 상품·옵션·제품군</dt><dd className="mt-2 text-2xl font-semibold text-cyan-100">{CATALOG_SUMMARY.entries}<span className="ml-1 text-xs font-normal">개</span></dd></div>
          <div className="rounded-xl bg-[#050b18]/60 p-4"><dt className="text-xs text-white/65">판매처 가격 기록</dt><dd className="mt-2 text-2xl font-semibold text-cyan-100">{itemCount}<span className="ml-1 text-xs font-normal">건 · {populatedCount}개 분류</span></dd></div>
        </dl>
        <p className="mt-3 text-xs leading-6 text-white/65">모델·출력 옵션·제품군을 구분해 집계하며, 전체 시장 목록은 보완 중입니다. 가격 기록은 판매처별로 집계한 과거 확인 자료입니다. 현재 가격·배송·할인 조건은 판매처에서 다시 확인해 주세요.</p>
        <Link href="/products" className="mt-4 mr-4 inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm text-cyan-200 hover:bg-white/10">전체 상품 특징·상세 정보 보기 →</Link>
        <Link href="/evaluate" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cyan-300/25 bg-cyan-300/5 px-4 text-sm text-cyan-200 hover:bg-cyan-300/10">PC 구성 비용·부품 이슈 확인 →</Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRICE_CATEGORIES.map((c, index) => {
          const registered = CATALOG_SUMMARY.categoryCounts[c.key];
          const examples = CATALOG_PRODUCTS.filter(product => product.category === c.key).slice(0, 2);
          return (
          <Link
            key={c.key}
            href={`/prices/${c.key}`}
            className="group bd-surface-md p-5 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{c.shortTitle}</div>
                <div className="mt-1 text-sm text-white/65">{c.description}</div>
              </div>
              <div className="text-white/60 transition group-hover:text-white">→</div>
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="text-sm font-medium text-cyan-200">등록 항목 {registered}개</div>
              <div className="mt-2 text-sm text-white/80">판매처 가격 기록 {prices[index].items.length}건</div>
              <div className="mt-1 text-xs leading-relaxed text-white/65">{prices[index].items.length ? `최근 가격 확인 ${fmtKorean(prices[index].updatedAt)}` : registered ? "상품 정보 등록됨 · 판매처 가격 확인 전" : "상품 목록·판매처 가격 수집 전"}</div>
              {examples.length ? <p className="mt-3 line-clamp-2 break-words text-xs leading-6 text-white/65">{examples.map(product => product.name).join(" · ")}</p> : null}
              <div className="mt-4 text-sm text-cyan-100">{registered ? "등록 상품·가격 보기" : "수집 상태·추가 요청"} →</div>
            </div>
          </Link>
        ); })}
      </section>

      <section className="bd-surface-md p-6 text-sm text-white/70">
        <div className="font-semibold text-white">제휴/가격 안내</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>가격은 상품별 확인 시각 기준이며, 실제 구매 시점에는 달라질 수 있습니다.</li>
          <li>일부 링크는 제휴 링크일 수 있으며, 구매 시 일정 수수료를 받을 수 있습니다.</li>
          <li>선택한 판매 상품을 안내하며, 전체 판매처의 최저가를 보장하지 않습니다. 상품 링크는 새 창으로 열립니다.</li>
        </ul>
        <div className="mt-3">
          자세한 내용/문의는{" "}
          <Link className="text-cyan-200 hover:text-cyan-100" href="/contact/write?vis=public">
            공개 문의 게시판
          </Link>
          에 남겨주세요.
        </div>
      </section>
    </div>
  );
}
