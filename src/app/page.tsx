import Link from "next/link";
import HomeHero from "./_components/HomeHero";
import RealtimePosts from "./_components/RealtimePosts";
import { getMeta, getPrices } from "../lib/prices";
import { PRICE_CATEGORIES } from "../lib/priceCategories";
import { listOnlinePostsByBoard } from "../lib/onlinePosts";
import type { Post } from "../lib/postTypes";
import { pageMetadata, SITE_DESCRIPTION, SITE_URL } from "../lib/site";
import { CATALOG_SUMMARY } from "../lib/catalogData";

export const metadata = pageMetadata("블루딜 | PC 부품 가격·핫딜·IT 커뮤니티", SITE_DESCRIPTION, "/");
export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
}

const PRIMARY_ROUTES = [
  {
    eyebrow: "PRODUCTS",
    title: "PC 상품 목록",
    desc: "부품의 특징과 공식 자료, 확인 상태를 분류별로 살펴봅니다.",
    href: "/products",
    action: "전체 상품 보기",
  },
  {
    eyebrow: "NEWS",
    title: "IT 소식",
    desc: "새로운 하드웨어 뉴스와 업데이트, 곰선생 추천픽을 확인합니다.",
    href: "/it",
    action: "새 소식 보기",
  },
  {
    eyebrow: "COMMUNITY",
    title: "커뮤니티",
    desc: "질문과 사용기, 하드웨어 정보와 문제 해결 경험을 함께 나눕니다.",
    href: "/community",
    action: "게시판 둘러보기",
  },
  {
    eyebrow: "DEAL",
    title: "핫딜",
    desc: "할인 상품과 구매 링크를 모아 빠르게 판단할 수 있게 보여줍니다.",
    href: "/community/hotdeal",
    action: "핫딜 확인하기",
  },
] as const;

const COMMUNITY_LINKS = [
  { title: "IT 소식", desc: "뉴스·업데이트·루머", href: "/it" },
  { title: "리뷰", desc: "사용기·후기", href: "/community/review" },
  { title: "하드웨어", desc: "부품 질문·추천", href: "/community/hardware" },
  { title: "오버클럭", desc: "PBO·언더볼팅·램 타이밍", href: "/community/overclock" },
  { title: "이슈공유", desc: "드라이버·업데이트·불량", href: "/community/issue" },
  { title: "자료실", desc: "드라이버·시스템·모니터링", href: "/community/resources" },
] as const;

function SectionTitle({
  eyebrow,
  title,
  desc,
  href,
  action,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/80">{eyebrow}</div>
        <h2 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
        <p className="mt-2 text-sm text-white/55">{desc}</p>
      </div>
      {href && action ? (
        <Link href={href} className="text-sm text-cyan-200 hover:text-cyan-100 hover:underline">
          {action} →
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const [meta, priceResults, hotDeals] = await Promise.all([
    getMeta(),
    Promise.all(PRICE_CATEGORIES.map((category) => getPrices(category.key))),
    listOnlinePostsByBoard("hotdeal", 4).catch(() => null as Post[] | null),
  ]);
  const itemCount = priceResults.reduce((sum, result) => sum + result.items.length, 0);
  const deals = (hotDeals ?? []).filter((post) => !post.isPrivate).slice(0, 4);

  return (
    <div className="space-y-16 pb-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "블루딜", alternateName: "BLUEDEAL", url: SITE_URL, inLanguage: "ko-KR" }).replace(/</g, "\\u003c") }} />
      <HomeHero updatedAt={meta.updatedAt} schedule={meta.schedule} itemCount={itemCount} catalogCount={CATALOG_SUMMARY.entries} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIMARY_ROUTES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bd-surface-md p-6 transition hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-white/10"
          >
            <div className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/70">{item.eyebrow}</div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight group-hover:text-cyan-100">{item.title}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-white/60">{item.desc}</p>
            <div className="mt-5 text-sm font-medium text-white/85">{item.action} →</div>
          </Link>
        ))}
      </section>

      <section>
        <SectionTitle
          eyebrow="HOT DEAL"
          title="실시간 핫딜"
          desc="카테고리별 할인 상품과 구매처 정보를 모아봅니다."
          href="/community/hotdeal"
          action="핫딜 게시판"
        />
        <div className="mt-5 grid gap-3">
          {hotDeals === null ? <p role="status" className="bd-surface-md p-5 text-sm text-amber-200">핫딜을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p> : null}
          {hotDeals !== null && deals.length === 0 ? (
            <div className="bd-surface-md p-5 text-sm text-white/70">아직 등록된 핫딜이 없습니다.</div>
          ) : null}
          {deals.map((deal) => (
            <Link key={deal.id} href={`/community/hotdeal/${deal.id}`} className="group bd-surface-md p-4 hover:bg-white/10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    {deal.extra?.category ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">{String(deal.extra.category).toUpperCase()}</span> : null}
                    <span>{String(deal.extra?.store ?? "판매처 미표시")}</span>
                    <span>·</span>
                    <span>{formatDate(deal.createdAt)}</span>
                  </div>
                  <div className="mt-2 truncate font-semibold tracking-tight group-hover:text-cyan-100">{deal.title}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-white/70">{deal.content}</div>
                </div>
                <div className="shrink-0 md:text-right">
                  <div className="text-lg font-semibold">{String(deal.extra?.price ?? "가격 확인")}</div>
                  <div className="mt-1 text-xs text-white/70">상세 보기 →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          eyebrow="COMMUNITY"
          title="최신 게시글"
          desc="IT 소식과 사용자 경험을 빠르게 확인합니다."
          href="/community"
          action="커뮤니티 전체"
        />
        <div className="mt-5">
          <RealtimePosts limit={3} showHeader={false} />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="EXPLORE" title="주제별로 둘러보기" desc="관심 있는 게시판으로 바로 이동합니다." />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {COMMUNITY_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="group bd-surface-md p-4 hover:bg-white/10">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-white/35 group-hover:text-white/70">→</div>
              </div>
              <div className="mt-2 text-xs text-white/55">{item.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
