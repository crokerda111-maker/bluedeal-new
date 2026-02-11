import Link from "next/link";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";
import { getMeta } from "../../lib/prices";

function fmtKorean(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default async function PricesHubPage() {
  const meta = await getMeta();

  return (
    <div className="space-y-8">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">가격현황</h1>
            <p className="mt-2 text-sm text-white/70">
              주요 PC 부품/본체 가격을 한눈에 봅니다. (갱신: <b>매일 09:00 / 17:00</b>)
            </p>
          </div>
          <div className="text-sm text-white/70">
            마지막 업데이트: <span className="text-white">{fmtKorean(meta.updatedAt)}</span>
          </div>
        </div>

        {meta.note ? <div className="mt-3 text-[12px] text-white/50">{meta.note}</div> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRICE_CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={`/prices/${c.key}`}
            className="group bd-surface-md p-5 transition hover:border-white/20 hover:bg-white/10"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{c.shortTitle}</div>
                <div className="mt-1 text-sm text-white/65">{c.description}</div>
              </div>
              <div className="text-white/60 transition group-hover:text-white">→</div>
            </div>
          </Link>
        ))}
      </section>

      <section className="bd-surface-md p-6 text-sm text-white/70">
        <div className="font-semibold text-white">제휴/가격 안내</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>가격은 갱신 시점 기준이며, 실제 구매 시점에는 달라질 수 있습니다.</li>
          <li>일부 링크는 제휴 링크일 수 있으며, 구매 시 일정 수수료를 받을 수 있습니다.</li>
          <li>최저가/상품 링크는 새 창으로 열립니다.</li>
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
