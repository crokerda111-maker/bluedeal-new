import Link from "next/link";
import { getStoredAffiliateMappings } from "../../../lib/affiliateStore";
import { boardKeyToPath } from "../../../lib/boardConfig";
import { GMARKET_BLACK_FRIDAY as event } from "../../../lib/gmarketBlackFriday";
import { hotdealPrice, isFeaturedHotdeal, type VerifiedHotdeal } from "../../../lib/hotdeal";
import { listOnlinePostsByBoard } from "../../../lib/onlinePosts";
import { formatKoreanDate } from "../../../lib/postStorage";
import type { Post } from "../../../lib/postTypes";
import { pageMetadata } from "../../../lib/site";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata(
  "2026 G마켓 블랙프라이데이 11월 26~30일 | PC 부품·완본체 핫딜 · 블루딜",
  "2026년 11월 26~30일 지마켓 블랙프라이데이 공식 행사관과 PC 부품·완본체·주변기기·식품 핫딜. 상품별 배송비, 쿠폰과 카드 조건을 확인하세요.",
  event.path,
);

type ReviewedDeal = Post & { hotdeal: VerifiedHotdeal };

function DealList({ deals, historical = false }: { deals: ReviewedDeal[]; historical?: boolean }) {
  return (
    <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/15">
      {deals.map(post => {
        const checkedBeforeEvent = Date.parse(post.hotdeal.checkedAt) < event.startsAt;
        return (
          <li key={post.id} className="bg-slate-950/35 hover:bg-white/5">
            <Link href={boardKeyToPath("hotdeal") + "/" + encodeURIComponent(post.id)} prefetch={false} className="block px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200 sm:px-6">
              <span className="block break-words font-semibold text-white">{post.title}</span>
              <span className="mt-1 block text-sm leading-6 text-slate-300">
                배송 포함 {hotdealPrice(post)} · {checkedBeforeEvent ? "행사 전 " : ""}{historical ? "기록" : "확인"} <time dateTime={post.hotdeal.checkedAt}>{formatKoreanDate(post.hotdeal.checkedAt)} KST</time>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

async function loadEvent() {
  const now = Date.now();
  const ended = now >= event.endsAt;
  const [posts, mappings] = await Promise.all([
    listOnlinePostsByBoard("hotdeal", 200, {
      includeHotdealClicks: false,
      createdBetween: { from: event.trackingStartsAt, until: event.endsAt },
    }).catch(() => null),
    ended ? null : getStoredAffiliateMappings([event.officialUrl]),
  ]);
  const affiliate = mappings?.get(event.officialUrl);
  const reviewed = (posts ?? []).filter((post): post is ReviewedDeal => {
    if (post.isPrivate || post.extra?.store !== "G마켓" || !post.hotdeal) return false;
    const checked = Date.parse(post.hotdeal.checkedAt);
    return checked >= event.trackingStartsAt && checked < event.endsAt && checked <= now;
  });
  const active = ended ? [] : reviewed.filter(post => isFeaturedHotdeal(post.hotdeal, now));
  const archive = reviewed.filter(post => ended || Date.parse(post.hotdeal.validUntil) <= now);
  return { now, ended, available: posts !== null, affiliate, active, archive };
}

export default async function GmarketBlackFridayPage() {
  const { now, ended, available, affiliate, active, archive } = await loadEvent();
  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#182531] via-[#111729] to-[#271810] p-5 sm:p-9">
        <p className="text-sm font-semibold text-amber-200">{event.dates} · 한국시간 · {ended ? "행사 종료" : now < event.startsAt ? "행사 예고" : "행사 기간"}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{event.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
          G마켓 공식 행사관에서 중복 쿠폰, 카드 할인과 시간대별 특가를 확인할 수 있습니다. 상품별 쿠폰 자격, 결제 카드, 배송비를 함께 확인하세요.
        </p>
        {!ended ? (
          <div className="mt-5">
            {affiliate ? <p className="mb-2 text-sm text-slate-200">아래 행사관 링크를 이용하면 제휴사 조건에 따라 블루딜이 수수료를 받을 수 있습니다.</p> : null}
            <a href={affiliate ? "/go/" + affiliate.code : event.officialUrl} rel={affiliate ? "sponsored" : undefined} className="inline-flex min-h-11 items-center rounded-xl bg-amber-200 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">G마켓 공식 행사관 보기 →</a>
          </div>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-slate-300">일정 출처 <a className="underline underline-offset-4" href={event.officialUrl}>G마켓 공식 행사관</a> · 2026년 11월 26일 확인</p>
      </header>

      {!ended ? (
        <section aria-labelledby="current-gmarket-deals">
          <h2 id="current-gmarket-deals" className="text-xl font-bold">지금 확인한 G마켓 핫딜</h2>
          <p className="mb-4 mt-2 text-sm leading-6 text-slate-300">블루딜이 판매 페이지에서 확인한 가격입니다. 블랙프라이데이 혜택 적용 여부와 쿠폰·카드 조건은 상품 글에서 확인하세요.</p>
          {active.length ? <DealList deals={active} /> : <p className="rounded-2xl border border-white/15 p-4 text-sm text-slate-300">{available ? "현재 게시 기준을 충족한 진행 중 핫딜을 확인하는 중입니다." : "핫딜을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요."}</p>}
        </section>
      ) : null}

      {archive.length ? (
        <section aria-labelledby="archived-gmarket-deals">
          <h2 id="archived-gmarket-deals" className="mb-2 text-xl font-bold">이전 G마켓 특가 기록</h2>
          <p className="mb-4 text-sm text-slate-300">확인 당시 가격이며 현재 판매가는 상품 글에서 다시 확인하세요.</p>
          <DealList deals={archive} historical />
        </section>
      ) : null}

      <nav aria-label="블랙프라이데이 관련 페이지" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-cyan-200">
        <Link className="underline underline-offset-4" href="/events">이달의 행사 캘린더</Link>
        <Link className="underline underline-offset-4" href="/community/hotdeal">핫딜 게시판</Link>
        <Link className="underline underline-offset-4" href="/prices/fullpc">완본체 가격 비교</Link>
        <Link className="underline underline-offset-4" href="/prices">부품 가격 비교</Link>
      </nav>
    </div>
  );
}
