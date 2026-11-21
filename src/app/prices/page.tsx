import Link from "next/link";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";
import { getMeta, getPrices } from "../../lib/prices";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata("PC 부품 가격현황 | BLUEDEAL", "확인한 PC 부품의 상품가, 배송 조건과 가격 확인 시각을 비교하세요.", "/prices");

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
            <h1 className="text-2xl font-semibold tracking-tight">가격현황</h1>
            <p className="mt-2 text-sm text-white/70">
              주요 PC 부품/본체 가격을 한눈에 봅니다. (갱신: <b>{meta.schedule}</b>)
            </p>
          </div>
          <div className="text-sm text-white/70">
            최근 가격 확인: <span className="text-white">{fmtKorean(meta.updatedAt)}</span>
          </div>
        </div>

        <p className="mt-4 text-sm text-white/75">현재 {populatedCount}개 분류에서 확인한 상품 <b className="text-cyan-200">{itemCount}개</b>를 안내합니다. 가격 확인 시각은 상품마다 다릅니다.</p>
        <p className="mt-2 text-xs text-white/65">같은 모델의 판매처별 상품도 각각 집계합니다.</p>
        <Link href="/products" className="mt-4 mr-4 inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm text-cyan-200 hover:bg-white/10">전체 상품 특징·상세 정보 보기 →</Link>
        <Link href="/evaluate" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-cyan-300/25 bg-cyan-300/5 px-4 text-sm text-cyan-200 hover:bg-cyan-300/10">PC 구성 비용·부품 이슈 확인 →</Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRICE_CATEGORIES.map((c, index) => (
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
              {prices[index].items.length > 0 ? (
                <>
                  <div className="text-sm font-medium text-cyan-200">확인한 상품 {prices[index].items.length}개</div>
                  <div className="mt-1 text-xs leading-relaxed text-white/65">최근 확인 {fmtKorean(prices[index].updatedAt)}</div>
                </>
              ) : <div className="text-sm text-white/65">등록된 가격이 아직 없습니다.</div>}
            </div>
          </Link>
        ))}
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
