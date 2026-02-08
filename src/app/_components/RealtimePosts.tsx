"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COMMUNITY_BOARDS } from "../../lib/boardConfig";
import { apiListBoardPosts, mapApiPostToPost } from "../../lib/apiClient";
import { formatKoreanDate } from "../../lib/postStorage";

type FeedPost = {
  id: string;
  title: string;
  boardKey: string;
  // 작성자명은 비어있을 수 있음(게스트/이전 데이터/비공개 등)
  // UI에서는 아래 렌더링/매핑 단계에서 '익명'으로 처리.
  authorName?: string;
  createdAt: string;
};

export default function RealtimePosts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  const slugs = useMemo(() => {
    const communitySlugs = COMMUNITY_BOARDS.map((b) => b.slug);
    return ["it", ...communitySlugs];
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const results = await Promise.all(
          slugs.map((slug) =>
            apiListBoardPosts(slug, 1, 3).catch(() => ({ items: [], page: 1, page_size: 3, total: 0 }))
          )
        );

		// 타입을 명시해서(특히 authorName) Vercel 빌드에서 타입 추론이 흔들리지 않게 고정
		const all: FeedPost[] = results
          .flatMap((r) => r.items)
          .map(mapApiPostToPost)
          .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
          .slice(0, 6)
		  .map((p): FeedPost => ({
            id: p.id,
            title: p.title,
            boardKey: p.boardKey,
            // 작성자명이 비어있는 케이스(guest/이전 데이터 등)에서 타입 에러를 방지하고 UI를 일관되게 유지
            authorName: p.authorName ?? "익명",
            createdAt: p.createdAt,
          }));

        if (mounted) setPosts(all);
      } catch (e: any) {
        if (mounted) {
          setError(e?.message ?? "실시간 목록을 불러오지 못했습니다.");
          setPosts([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slugs]);

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">실시간 게시글</h2>
          <p className="mt-1 text-xs text-white/60">IT + 커뮤니티 최신</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/community"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            커뮤니티
          </Link>
          <Link
            href="/it"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            IT 소식
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        {loading ? (
          <div className="text-sm text-white/70">불러오는 중...</div>
        ) : error ? (
          <div className="text-sm text-white/70">{error}</div>
        ) : posts.length === 0 ? (
          <div className="text-sm text-white/70">아직 게시글이 없습니다.</div>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => {
              const href = p.boardKey === "it" ? `/it/${p.id}` : `/community/${p.boardKey}/${p.id}`;
              return (
                <li
                  key={`${p.boardKey}-${p.id}`}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"
                >
                  <Link href={href} className="block">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{p.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/60">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            {p.boardKey}
                          </span>
                          <span>{p.authorName ?? "익명"}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] text-white/50">{formatKoreanDate(p.createdAt)}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
