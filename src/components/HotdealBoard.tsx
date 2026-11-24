"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HOTDEAL_CATEGORIES, HOTDEAL_MAX_PREMIUM, hotdealCategory, hotdealPrice, isActiveHotdeal, isHotdealAuthor, isRecommendedHotdeal } from "../lib/hotdeal";
import type { HotdealCategory } from "../lib/hotdeal";
import type { Post } from "../lib/postTypes";
import { apiListPosts } from "../lib/postsClient";
import { formatKoreanDate } from "../lib/postStorage";
import PostLoadError from "./PostLoadError";

type Tab = "all" | "popular" | "coupang-low" | "records" | HotdealCategory;

const FILTERS = [
  { value: "all", label: "검증 핫딜" },
  { value: "popular", label: "인기" },
  { value: "coupang-low", label: "쿠팡최저가" },
  ...HOTDEAL_CATEGORIES.slice(0, 6),
  { value: "records", label: "제보·이전 기록" },
] as const;

function tabClass(selected: boolean) {
  return "whitespace-nowrap rounded-full px-3 py-2 text-sm outline-offset-2 focus-visible:outline-cyan-200 " +
    (selected ? "bg-cyan-300 font-semibold text-slate-950" : "text-white/80 hover:bg-white/10");
}

function DealCard({ post, now }: { post: Post; now: number }) {
  const deal = post.hotdeal;
  const active = deal && isActiveHotdeal(deal, now);
  const recommended = isRecommendedHotdeal(deal, now);
  const category = HOTDEAL_CATEGORIES.find(item => item.value === hotdealCategory(post.extra?.category))?.label;
  const price = hotdealPrice(post);
  const author = deal ? post.authorName : isHotdealAuthor(post.authorName) ? "커뮤니티 회원" : post.authorName ?? "익명";

  return (
    <li className="bd-surface-md flex min-w-0 flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/70">
        <span className="rounded-md bg-white/10 px-2 py-1 text-white/90">{category}</span>
        {typeof post.extra?.store === "string" ? <span>{post.extra.store}</span> : null}
        <span className={recommended ? "font-medium text-emerald-200" : ""}>
          {recommended ? "최저가 근처 확인" : active ? "비교 근거 미검증" : deal ? "가격 재확인 필요" : "커뮤니티 제보"}
        </span>
      </div>
      <h2 className="text-lg font-semibold [overflow-wrap:anywhere]">
        <Link href={"/community/hotdeal/" + post.id} className="hover:text-cyan-200 focus-visible:underline">{post.title}</Link>
      </h2>
      {price ? (
        <p className="text-sm text-white/75">
          <strong className={recommended ? "text-lg text-cyan-200" : "text-lg text-white/80"}>{price}</strong>
          {" "}{active ? "배송비 포함" : deal ? "이전 확인가" : "제보 가격"}
        </p>
      ) : null}
      {deal ? (
        <p className="line-clamp-2 text-sm text-white/75 [overflow-wrap:anywhere]">{deal.option} · {deal.conditions}</p>
      ) : null}
      <p className="mt-auto pt-1 text-xs text-white/65">
        {author} · {deal ? "확인 " : ""}{formatKoreanDate(deal?.checkedAt ?? post.createdAt)}
      </p>
    </li>
  );
}

export default function HotdealBoard() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiListPosts("hotdeal", 200).then(data => {
      if (cancelled) return;
      setPosts(data.filter(post => !post.isPrivate));
      setNow(Date.now());
      setStatus("ready");
    }).catch(() => { if (!cancelled) setStatus("error"); });
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => { cancelled = true; window.clearInterval(clock); };
  }, [attempt]);

  const term = query.trim().toLowerCase();
  const filtered = posts.filter(post => {
    if (isRecommendedHotdeal(post.hotdeal, now) === (tab === "records")) return false;
    if (tab === "popular" && !post.hotdealClicks) return false;
    if (tab === "coupang-low" && !(post.extra?.store === "쿠팡" && post.hotdeal?.lowestIn30Days)) return false;
    if (tab !== "all" && tab !== "popular" && tab !== "coupang-low" && tab !== "records" && hotdealCategory(post.extra?.category) !== tab) return false;
    return !term || [post.title, post.extra?.store, post.hotdeal?.option, post.content].join(" ").toLowerCase().includes(term);
  });
  if (tab === "popular") filtered.sort((a, b) => (b.hotdealClicks ?? 0) - (a.hotdealClicks ?? 0));

  return (
    <div className="space-y-5">
      <section className="bd-surface-md p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">핫딜</h1>
            <p className="mt-2 text-sm text-white/75">같은 모델·옵션과 구매 조건에서 배송비 포함 확인 최저가의 {HOTDEAL_MAX_PREMIUM}% 이내인 상품을 보여줍니다.</p>
          </div>
          <Link href="/community/hotdeal/write" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
            핫딜 제보
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-white/10 pt-4" role="group" aria-label="핫딜 분류">
          {FILTERS.map(({ value, label }) => (
            <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={tabClass(tab === value)}>{label}</button>
          ))}
          <select
            aria-label="더보기 분류"
            value={HOTDEAL_CATEGORIES.slice(6).some(item => item.value === tab) ? tab : ""}
            onChange={event => setTab((event.target.value || "all") as Tab)}
            className="rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">더보기</option>
            {HOTDEAL_CATEGORIES.slice(6).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <input type="search" aria-label="핫딜 검색" value={query} maxLength={100}
          onChange={event => setQuery(event.target.value)} placeholder="상품명, 판매처, 옵션 검색"
          className="mt-4 w-full max-w-md rounded-xl border border-white/15 bg-slate-950/70 px-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:border-cyan-300 focus:outline-none"
        />
        {tab === "coupang-low" ? <p className="mt-3 text-sm text-white/75">최근 30일간 확인한 동일 옵션의 쿠팡 배송비 포함 가격을 비교합니다.</p> : null}
        {tab === "popular" ? <p className="mt-3 text-sm text-white/75">검증 핫딜 중 제휴 구매 링크 클릭이 많은 순으로 보여줍니다.</p> : null}
      </section>

      {status === "error" ? (
        <PostLoadError onRetry={() => { setStatus("loading"); setAttempt(value => value + 1); }} />
      ) : status === "loading" ? (
        <p className="bd-surface-md p-6 text-sm text-white/75" role="status">핫딜을 불러오고 있습니다.</p>
      ) : filtered.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(post => <DealCard key={post.id} post={post} now={now} />)}</ul>
      ) : (
        <p className="bd-surface-md p-6 text-sm text-white/75" role="status">{tab === "records" ? "표시할 제보·이전 기록이 없습니다." : "조건을 충족한 핫딜이 없습니다."}</p>
      )}
    </div>
  );
}
