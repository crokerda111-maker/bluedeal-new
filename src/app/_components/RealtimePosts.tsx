"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ALL_BOARDS, boardKeyToPath } from "../../lib/boardConfig";
import type { Post } from "../../lib/postTypes";
import { apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";

export default function RealtimePosts({ limit = 5, showHeader = true }: { limit?: number; showHeader?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Home: 노출은 IT + 커뮤니티만 (문의 제외)
    const boards = ALL_BOARDS.filter((b) => b.key !== "inquiry");
    const perBoard = Math.max(3, Math.ceil(limit / 2));

    Promise.allSettled(boards.map((b) => apiListPosts(b.key, perBoard)))
      .then((lists) => {
        if (cancelled) return;
        setFailedCount(lists.filter((result) => result.status === "rejected").length);
        const all = lists.flatMap((result) => result.status === "fulfilled" ? result.value.filter((post) => !post.isPrivate) : []);
        all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setPosts(all.slice(0, limit));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailedCount(boards.length);
        setPosts([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit, attempt]);

  const title = showHeader ? "실시간 게시글" : null;

  return (
    <section className="bd-surface-md p-6">
      {title ? (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Link className="text-sm text-cyan-200 hover:underline" href="/community">
            더보기
          </Link>
        </div>
      ) : null}

      {!loading && failedCount > 0 ? (
        <div role="status" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <p>{posts.length > 0 ? "일부 게시판을 불러오지 못해 확인된 글만 표시합니다." : "게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}</p>
          <button type="button" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }} className="mt-2 rounded-md underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">다시 불러오기</button>
        </div>
      ) : null}

      <div className="space-y-3">
        {loading ? <p role="status" className="text-sm text-white/65">최신 게시글을 불러오는 중입니다.</p> : null}
        {posts.length === 0 && !loading && failedCount === 0 ? <div className="text-sm text-white/45">아직 등록된 게시글이 없습니다.</div> : null}
        {posts.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link className="block truncate text-sm font-medium text-white/90 hover:underline" href={`${boardKeyToPath(p.boardKey)}/${p.id}`}>
                {p.title}
              </Link>
              <div className="mt-0.5 text-[12px] text-white/55">
                {p.authorName ?? "익명"} · {formatKoreanDate(p.createdAt)}
              </div>
            </div>

            <div className="shrink-0 text-[12px] text-white/40">{p.boardKey}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
