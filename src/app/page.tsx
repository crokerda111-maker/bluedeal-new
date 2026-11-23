import Link from "next/link";
import HomeFeed from "./_components/HomeFeed";
import MarketplaceFullPcPicks from "../components/MarketplaceFullPcPicks";
import { getPriceView } from "../lib/prices";
import { pageMetadata, SITE_DESCRIPTION, SITE_URL } from "../lib/site";

export const metadata = pageMetadata("블루딜 | 오늘의 완본체 베스트·부품 구성 비교", SITE_DESCRIPTION, "/");
export const revalidate = 300;

const PRIMARY_ROUTES = [
  {
    eyebrow: "PRODUCTS",
    title: "PC 상품·가격비교",
    desc: "반본체와 개별 부품의 판매가, 배송비, 구성 차이를 확인합니다.",
    href: "/prices",
    action: "부품 가격 보기",
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
        <Link href={href} prefetch={false} className="text-sm text-cyan-200 hover:text-cyan-100 hover:underline">
          {action} →
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const { data, now } = await getPriceView("fullpc");

  return (
    <div className="space-y-16 pb-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "블루딜", alternateName: "BLUEDEAL", url: SITE_URL, inLanguage: "ko-KR" }).replace(/</g, "\\u003c") }} />
      <MarketplaceFullPcPicks items={data.items} now={now} home />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRIMARY_ROUTES.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="group bd-surface-md p-6 transition hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-white/10"
          >
            <div className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/70">{item.eyebrow}</div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight group-hover:text-cyan-100">{item.title}</h2>
            <p className="mt-3 min-h-12 text-sm leading-6 text-white/60">{item.desc}</p>
            <div className="mt-5 text-sm font-medium text-white/85">{item.action} →</div>
          </Link>
        ))}
      </section>

      <HomeFeed
        hotdealHeading={<SectionTitle
          eyebrow="HOT DEAL"
          title="실시간 핫딜"
          desc="카테고리별 할인 상품과 구매처 정보를 모아봅니다."
          href="/community/hotdeal"
          action="핫딜 게시판"
        />}
        recentHeading={<SectionTitle
          eyebrow="COMMUNITY"
          title="최신 게시글"
          desc="IT 소식과 사용자 경험을 빠르게 확인합니다."
          href="/community"
          action="커뮤니티 전체"
        />}
      />

      <section>
        <SectionTitle eyebrow="EXPLORE" title="주제별로 둘러보기" desc="관심 있는 게시판으로 바로 이동합니다." />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {COMMUNITY_LINKS.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false} className="group bd-surface-md p-4 hover:bg-white/10">
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
