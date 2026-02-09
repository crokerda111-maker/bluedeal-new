"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBoardByKey, POST_TYPE_LABEL, boardKeyToPath } from "../../lib/boardConfig";
import { MOCK_POSTS } from "../../lib/mockPosts";
import type { Post } from "../../lib/postTypes";
import { loadLocalPosts, formatKoreanDate } from "../../lib/postStorage";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function mergePosts(local: Post[], seed: Post[]): Post[] {
  const map = new Map<string, Post>();
  // local 우선
  for (const p of [...seed, ...local]) map.set(p.id, p);
  return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function postHref(p: Post): string {
  if (p.boardKey === "it") return `/it/${p.id}`;
  if (p.boardKey === "inquiry") return `/contact/${p.id}`;
  return `/community/${p.boardKey}/${p.id}`;
}

export default function RealtimePosts({
  limit = 10,
  showHeader = true,
  className,
}: {
  limit?: number;
  showHeader?: boolean;
  className?: string;
}) {
  const [localPosts, setLocalPosts] = useState<Post[]>([]);

  useEffect(() => {
    const refresh = () => setLocalPosts(loadLocalPosts());
    refresh();

    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes("bluedeal_posts_v1")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const merged = useMemo(() => {
    // 홈에는 문의글은 제외(구색/노출 최소)
    const local = localPosts.filter((p) => p.boardKey !== "inquiry");
    const seed = MOCK_POSTS.filter((p) => p.boardKey !== "inquiry");
    return mergePosts(local, seed).slice(0, limit);
  }, [localPosts, limit]);

  return (
    <div className={cn("bd-surface-md p-4", className)}>
      {showHeader ? (
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">실시간 게시글</div>
          <div className="text-xs text-white/55">새 글 작성은 각 게시판에서 가능합니다</div>
        </div>
      ) : null}

      <div className={cn("divide-y divide-white/10", showHeader && "mt-3")}>
        {merged.length === 0 ? (
          <div className="py-10 text-center text-sm text-white/60">아직 게시글이 없습니다.</div>
        ) : (
          merged.map((p) => {
            const board = getBoardByKey(p.boardKey);
            const boardTitle = board?.title ?? String(p.boardKey);
            const href = postHref(p);

            return (
              <div key={p.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                      {boardTitle}
                    </span>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-100">
                      {POST_TYPE_LABEL[p.type]}
                    </span>
                    {p.authorName ? (
                      <span className="text-[11px] text-white/50">by {p.authorName}</span>
                    ) : null}
                  </div>

                  <Link href={href} className="mt-1 block truncate text-sm text-white/85 hover:underline">
                    {p.title}
                  </Link>

                  <div className="mt-1 text-[12px] text-white/50">{formatKoreanDate(p.createdAt)}</div>
                </div>

                <div className="shrink-0">
                  <Link
                    href={boardKeyToPath(p.boardKey)}
                    className={cn(
                      "rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10",
                    )}
                  >
                    게시판 →
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
