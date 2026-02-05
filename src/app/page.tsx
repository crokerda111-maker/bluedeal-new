import Link from "next/link";
import HomeHero from "./_components/HomeHero";
import RealtimePosts from "./_components/RealtimePosts";
import { getMeta } from "../lib/prices";
import { DEALS } from "../lib/mockDeals";

function formatAgo(min: number) {
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분 전` : `${h}시간 전`;
}

const QUICK_LINKS: Array<{ title: string; desc: string; href: string }> = [
  { title: "IT 소식", desc: "뉴스/업데이트/루머", href: "/it" },
  { title: "리뷰", desc: "사용기/후기", href: "/community/review" },
  { title: "하드웨어", desc: "부품 질문/추천", href: "/community/hardware" },
  { title: "오버클럭", desc: "PBO/언더볼팅/램 타이밍", href: "/community/overclock" },
  { title: "이슈공유", desc: "드라이버/업데이트/불량", href: "/community/issue" },
  { title: "자료실", desc: "드라이버/시스템/최적화/모니터링", href: "/community/resources" },
  { title: "가격현황", desc: "RAM/CPU/GPU/본체/쿨러", href: "/prices" },
  { title: "핫딜", desc: "카테고리별 핫딜", href: "/hot" },
];

export default async function HomePage() {
  const meta = await getMeta();

  // 메인: 링크만 노출
  const deals = [...DEALS].sort((a, b) => a.minutesAgo - b.minutesAgo).slice(0, 8);

  return (
    <div className="space-y-10">
      {/* HERO (old blue + grid look) */}
      <HomeHero updatedAt={meta.updatedAt} />

      {/* Category quick links (boards) */}
      <section>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-sm font-semibold">카테고리</div>
            <div className="mt-1 text-xs text-white/55">클릭하면 해당 게시판/섹션으로 이동</div>
          </div>
          <Link href="/community" className="text-xs text-cyan-200 hover:underline">
            전체 보기
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {QUICK_LINKS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{c.title}</div>
                <div className="text-white/35 group-hover:text-white/70">→</div>
              </div>
              <div className="mt-2 text-xs text-white/55">{c.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Realtime posts (replaces the old hotdeal feed on home) */}
      <section>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold">실시간 게시글</div>
            <div className="mt-1 text-xs text-white/55">IT + 커뮤니티 최신 글을 한 번에</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/it"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              IT 소식
            </Link>
            <Link
              href="/community"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              커뮤니티
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              문의
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <RealtimePosts limit={10} />
        </div>
      </section>

      {/* Home hot deals (link only) */}
      <section>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-semibold">실시간 핫딜</div>
            <div className="mt-1 text-xs text-white/55">메인에서는 외부/제휴 링크를 숨기고, 글 상세에서만 안내합니다.</div>
          </div>
          <Link href="/hot" className="text-xs text-cyan-200 hover:underline">
            핫딜 더보기 →
          </Link>
        </div>

        <div className="mt-4 grid gap-3">
          {deals.map((d) => (
            <Link
              key={d.id}
              href={`/deals/${d.id}`}
              className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {d.tag ? (
                      <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[11px] leading-none text-cyan-100">
                        {d.tag}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] leading-none text-white/70">
                      {d.category}
                    </span>
                    <span className="text-xs text-white/50">{d.store}</span>
                    <span className="text-xs text-white/35">·</span>
                    <span className="text-xs text-white/50">{formatAgo(d.minutesAgo)}</span>
                  </div>

                  <div className="mt-2 truncate text-base font-semibold tracking-tight group-hover:text-cyan-100">
                    {d.title}
                  </div>

                  <div className="mt-1 text-xs text-white/55">{d.shippingLabel}</div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold">{d.priceLabel}</div>
                  <div className="mt-1 text-[11px] text-white/45">Heat {d.heat}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
