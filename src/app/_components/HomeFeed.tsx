"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HomeFeedData } from "../../lib/homeFeed";

const failed: HomeFeedData = { deals: null, posts: [], failedCount: 1 };

export default function HomeFeed({ hotdealHeading, recentHeading }: { hotdealHeading: ReactNode; recentHeading: ReactNode }) {
  const area = useRef<HTMLElement>(null);
  const [data, setData] = useState<HomeFeedData | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const request = new AbortController();

    function load() {
      fetch("/api/home-feed", { signal: request.signal })
        .then(response => {
          if (!response.ok) throw new Error("Home feed unavailable.");
          return response.json() as Promise<HomeFeedData>;
        })
        .then(result => { if (!request.signal.aborted) setData(result); })
        .catch(() => { if (!request.signal.aborted) setData(failed); });
    }

    if (attempt > 0 || typeof IntersectionObserver === "undefined") {
      load();
      return () => request.abort();
    }

    const observer = new IntersectionObserver(entries => {
      if (request.signal.aborted || !entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      load();
    }, { rootMargin: "320px 0px" });
    observer.observe(element);
    return () => {
      observer.disconnect();
      request.abort();
    };
  }, [attempt]);

  function retry() {
    setData(null);
    setAttempt(count => count + 1);
  }

  const retryButton = <button type="button" onClick={retry} className="mt-2 rounded-md text-sm underline underline-offset-4">다시 불러오기</button>;

  return (
    <>
      <section ref={area}>
        {hotdealHeading}
        <div className="mt-5 grid gap-3">
          {!data && <p role="status" className="bd-surface-md p-5 text-sm text-white/70">핫딜을 불러오는 중입니다.</p>}
          {data?.deals === null && <div className="bd-surface-md p-5 text-sm text-amber-200">
            <p role="status">핫딜을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>
            {retryButton}
          </div>}
          {data?.deals?.length === 0 && <p className="bd-surface-md p-5 text-sm text-white/70">아직 등록된 핫딜이 없습니다.</p>}
          {data?.deals?.map(deal => (
            <Link key={deal.href} href={deal.href} prefetch={false} className="group bd-surface-md p-4 hover:bg-white/10">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                    {deal.category && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px]">{deal.category}</span>}
                    <span>{deal.store}</span>
                    <span>·</span>
                    <span>{deal.date}</span>
                  </div>
                  <div className="mt-2 truncate font-semibold tracking-tight group-hover:text-cyan-100">{deal.title}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-white/70">{deal.excerpt}</div>
                </div>
                <div className="shrink-0 md:text-right">
                  <div className="text-lg font-semibold">{deal.price}</div>
                  <div className="mt-1 text-xs text-white/70">상세 보기 →</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section>
        {recentHeading}
        <div className="bd-surface-md mt-5 space-y-3 p-6">
          {!data && <p role="status" className="text-sm text-white/65">최신 게시글을 불러오는 중입니다.</p>}
          {data && data.failedCount > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <p role="status">{data.posts.length ? "일부 게시판을 불러오지 못해 확인된 글만 표시합니다." : "게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p>
            {retryButton}
          </div>}
          {data && data.posts.length === 0 && data.failedCount === 0 && <p className="text-sm text-white/70">아직 등록된 게시글이 없습니다.</p>}
          {data?.posts.map(post => (
            <div key={post.href} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Link href={post.href} prefetch={false} className="block truncate text-sm font-medium text-white/90 hover:underline">{post.title}</Link>
                <div className="mt-0.5 text-xs text-white/70">{post.author} · {post.date} KST</div>
              </div>
              <div className="shrink-0 text-xs text-white/70">{post.board}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
