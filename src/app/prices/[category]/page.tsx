import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategory } from "../../../lib/priceCategories";
import type { PriceCategoryKey } from "../../../lib/priceCategories";
import { getMeta, getPrices } from "../../../lib/prices";

function fmtKorean(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function fmtWon(v: number) {
  try {
    return new Intl.NumberFormat("ko-KR").format(v) + "원";
  } catch {
    return `${v}원`;
  }
}

function pct(v?: number) {
  if (typeof v !== "number") return "-";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

export default async function PricesCategoryPage({ params }: { params: { category: string } }) {
  const category = getCategory(params.category);
  if (!category) return notFound();

  const meta = await getMeta();
  const data = await getPrices(category.key as PriceCategoryKey);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-white/60">
            <Link className="hover:text-white" href="/prices">
              가격현황
            </Link>{" "}
            <span className="text-white/40">/</span> <span className="text-white">{category.shortTitle}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{category.title}</h1>
          <p className="mt-2 text-sm text-white/70">{category.description}</p>
        </div>

        <div className="text-sm text-white/70">
          마지막 업데이트: <span className="text-white">{fmtKorean(data.updatedAt || meta.updatedAt)}</span>
          <div className="text-[12px] text-white/50">갱신: 매일 09:00 / 17:00</div>
        </div>
      </div>

      <div className="bd-surface-md">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-4 py-3 text-left font-medium">제품</th>
                <th className="px-4 py-3 text-left font-medium">스펙</th>
                <th className="px-4 py-3 text-right font-medium">현재가</th>
                <th className="px-4 py-3 text-right font-medium">24h</th>
                <th className="px-4 py-3 text-right font-medium">7일 최저</th>
                <th className="px-4 py-3 text-right font-medium">30일 최저</th>
                <th className="px-4 py-3 text-right font-medium">링크</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-white/60" colSpan={7}>
                    데이터가 아직 없습니다.{" "}
                    <Link className="text-cyan-200 hover:text-cyan-100" href="/contact">
                      제보하기
                    </Link>
                  </td>
                </tr>
              ) : (
                data.items.map((it) => {
                  const link = it.goCode ? `/go/${it.goCode}` : it.url || "#";
                  const linkLabel = it.goCode ? "최저가 보기" : it.url ? "보기" : "-";

                  return (
                    <tr key={it.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{it.name}</div>
                        {it.source ? <div className="text-[12px] text-white/50">{it.source}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-white/70">{it.spec || "-"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{fmtWon(it.price)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{pct(it.change24hPct)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{typeof it.low7d === "number" ? fmtWon(it.low7d) : "-"}</td>
                      <td className="px-4 py-3 text-right text-white/70">{typeof it.low30d === "number" ? fmtWon(it.low30d) : "-"}</td>
                      <td className="px-4 py-3 text-right">
                        {linkLabel === "-" ? (
                          <span className="text-white/40">-</span>
                        ) : (
                          <a
                            className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white"
                            href={link}
                            rel="noreferrer"
                          >
                            {linkLabel} →
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bd-surface-md p-5 text-sm text-white/70">
        <div className="font-semibold text-white">알림</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>가격은 갱신 시점 기준이며, 실제 구매 시점에는 달라질 수 있습니다.</li>
          <li>일부 링크는 제휴 링크일 수 있으며, 구매 시 일정 수수료를 받을 수 있습니다.</li>
        </ul>
        <div className="mt-3">
          구매 팁/제휴 문의는{" "}
          <Link className="text-cyan-200 hover:text-cyan-100" href="/contact/public">
            공개 문의 게시판
          </Link>
          에 남겨주세요.
        </div>
      </div>
    </div>
  );
}
