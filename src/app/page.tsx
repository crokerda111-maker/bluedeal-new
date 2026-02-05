import Link from "next/link";
import RealtimePosts from "./_components/RealtimePosts";
import { PRICE_CATEGORIES } from "../lib/priceCategories";
import { getMeta } from "../lib/prices";
import { DEALS } from "../lib/mockDeals";

function fmtKorean(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default async function HomePage() {
  const meta = await getMeta();

  // 최신 핫딜(링크만 노출)
  const deals = [...DEALS].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 6);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/6 to-white/3 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">BLUEDEAL</h1>
            <p className="mt-2 text-sm text-white/70">IT 소식 · 커뮤니티 · 가격현황 · 핫딜</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/it"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              IT 소식
            </Link>
            <Link
              href="/community"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              커뮤니티
            </Link>
            <Link
              href="/prices"
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              가격현황 보기
            </Link>
          </div>
        </div>
      </section>

      {/* 실시간 게시글 */}
      <RealtimePosts limit={10} />

      {/* 오늘의 현황 요약 */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold">오늘의 현황</div>
            <div className="mt-1 text-sm text-white/70">
              가격현황은 <b>매일 09:00 / 17:00</b> 갱신을 기준으로 운영합니다.
            </div>
          </div>
          <div className="text-sm text-white/70">
            마지막 업데이트: <span className="text-white">{fmtKorean(meta.updatedAt)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRICE_CATEGORIES.map((c) => (
            <Link
              key={c.key}
              href={`/prices/${c.key}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{c.shortTitle}</div>
                  <div className="mt-1 text-[12px] text-white/60">{c.description}</div>
                </div>
                <div className="text-white/40 group-hover:text-white">→</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/prices"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            가격현황 전체
          </Link>
          <Link
            href="/community/issue"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            이슈공유
          </Link>
          <Link
            href="/community/hardware"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            하드웨어 질문
          </Link>
        </div>
      </section>

      {/* 카테고리(게시판 바로가기) */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-semibold">바로가기</div>
        <div className="mt-1 text-sm text-white/70">자주 쓰는 게시판/섹션 링크</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/it" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">IT 소식</div>
            <div className="mt-1 text-[12px] text-white/60">뉴스/업데이트/루머</div>
          </Link>

          <Link href="/community/review" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">리뷰</div>
            <div className="mt-1 text-[12px] text-white/60">사용기/후기</div>
          </Link>

          <Link href="/community/hardware" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">하드웨어</div>
            <div className="mt-1 text-[12px] text-white/60">부품 질문/추천</div>
          </Link>

          <Link href="/community/overclock" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">오버클럭</div>
            <div className="mt-1 text-[12px] text-white/60">PBO/언더볼팅/램 타이밍</div>
          </Link>

          <Link href="/community/issue" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">이슈공유</div>
            <div className="mt-1 text-[12px] text-white/60">드라이버/업데이트/불량</div>
          </Link>

          <Link href="/community/resources" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">자료실</div>
            <div className="mt-1 text-[12px] text-white/60">드라이버/시스템/최적화/모니터링</div>
          </Link>

          <Link href="/prices" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">가격현황</div>
            <div className="mt-1 text-[12px] text-white/60">RAM/CPU/GPU/본체</div>
          </Link>

          <Link href="/hot" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">핫딜</div>
            <div className="mt-1 text-[12px] text-white/60">카테고리별 핫딜</div>
          </Link>

          <Link href="/contact" className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">문의</div>
            <div className="mt-1 text-[12px] text-white/60">공개/비공개 문의</div>
          </Link>
        </div>
      </section>

      {/* 실시간 핫딜(링크만) */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">실시간 핫딜</div>
            <div className="mt-1 text-sm text-white/70">메인에서는 링크만 노출합니다.</div>
          </div>
          <Link href="/hot" className="text-sm text-cyan-200 hover:underline">
            핫딜 더보기 →
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {deals.map((d) => (
            <Link
              key={d.id}
              href={`/deals/${d.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-white/90">{d.title}</div>
                <div className="mt-1 text-[12px] text-white/55">
                  {d.category} · {d.store} · {d.shippingLabel}
                </div>
              </div>
              <div className="shrink-0 text-sm font-semibold">{d.priceLabel}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
