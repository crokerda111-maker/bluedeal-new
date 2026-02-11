"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ALL_BOARDS, boardKeyToPath } from "../../lib/boardConfig";
import { MOCK_POSTS } from "../../lib/mockPosts";
import type { Post } from "../../lib/postTypes";
import { ApiError, apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";

export default function RealtimePosts({ limit = 5, showHeader = true }: { limit?: number; showHeader?: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    // Home: 노출은 IT + 커뮤니티만 (문의 제외)
    const boards = ALL_BOARDS.filter((b) => b.key !== "inquiry");
    const perBoard = Math.max(3, Math.ceil(limit / 2));

    Promise.all(
      boards.map((b) =>
        apiListPosts(b.key, perBoard).catch(() => []),
      ),
    )
      .then((lists) => {
        if (cancelled) return;
        const all = lists.flat();
        all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setPosts(all.slice(0, limit));
      })
      .catch((e: any) => {
        if (cancelled) return;
        const msg = typeof e?.message === "string" ? e.message : "게시글을 불러오지 못했습니다.";
        const code = e instanceof ApiError ? e.code : e?.code;
        setError({ message: msg, code });

        // fallback: seed
        const seed = [...MOCK_POSTS].filter((p) => p.boardKey !== "inquiry");
        seed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        setPosts(seed.slice(0, limit));
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  const isKvMissing = error?.code === "KV_NOT_CONFIGURED";

  const title = useMemo(() => (showHeader ? "실시간 게시글" : null), [showHeader]);

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

      {error ? (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${isKvMissing ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
          {isKvMissing ? "온라인 게시판 연결이 아직 설정되지 않아 샘플 글을 표시합니다." : `게시글을 불러오지 못했습니다. (${error.message})`}
        </div>
      ) : null}

      <div className="space-y-3">
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
