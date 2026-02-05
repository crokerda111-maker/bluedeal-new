"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInquiryBoard, inquiryVisibilityToBoardKey, POST_TYPE_LABEL, POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import { MOCK_POSTS } from "../../../lib/mockPosts";
import type { Post, PostType, InquiryVisibility } from "../../../lib/postTypes";
import { formatKoreanDate, getLocalPostsByBoard } from "../../../lib/postStorage";

function mergePosts(a: Post[], b: Post[]): Post[] {
  const map = new Map<string, Post>();
  for (const p of [...b, ...a]) map.set(p.id, p);
  return Array.from(map.values()).sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
}

export default function InquiryBoardPage({ params }: { params: { visibility: string } }) {
  const vis = params.visibility as InquiryVisibility;
  const board = getInquiryBoard(vis);
  const [typeFilter, setTypeFilter] = useState<"all" | PostType>("all");
  const [localPosts, setLocalPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!board) return;
    const key = inquiryVisibilityToBoardKey(vis);
    setLocalPosts(getLocalPostsByBoard(key));

    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes("bluedeal_posts_v1")) {
        setLocalPosts(getLocalPostsByBoard(key));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [board, vis]);

  const merged = useMemo(() => {
    if (!board) return [];
    const key = inquiryVisibilityToBoardKey(vis);
    const seed = MOCK_POSTS.filter((p) => p.boardKey === key);
    return mergePosts(localPosts, seed);
  }, [board, localPosts, vis]);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return merged;
    return merged.filter((p) => p.type === typeFilter);
  }, [merged, typeFilter]);

  if (!board) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">없는 게시판</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/contact">
          문의로 돌아가기
        </Link>
      </div>
    );
  }

  const isPrivateBoard = vis === "private";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{board.title}</h1>
            <p className="mt-1 text-sm text-white/70">{board.description}</p>
            {board.writeHint ? <p className="mt-2 text-[12px] text-white/50">{board.writeHint}</p> : null}
          </div>

          <Link
            href={`/contact/${board.slug}/write`}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            글쓰기
          </Link>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTypeFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            typeFilter === "all"
              ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          }`}
        >
          전체
        </button>
        {POST_TYPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setTypeFilter(o.value)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              typeFilter === o.value
                ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 text-white/60">
              <tr>
                <th className="px-4 py-3 text-left">말머리</th>
                <th className="px-4 py-3 text-left">제목</th>
                <th className="px-4 py-3 text-left">작성일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-white/60">
                    아직 글이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white/70">{POST_TYPE_LABEL[p.type]}</td>
                    <td className="px-4 py-3">
                      <Link className="text-white hover:underline" href={`/contact/${board.slug}/${p.id}`}>
                        {isPrivateBoard ? "🔒 " : ""}
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-white/60">{formatKoreanDate(p.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-[12px] text-white/60">
        이 게시판은 MVP 단계로, 작성한 글은 현재 브라우저(localStorage)에 저장됩니다.
      </section>
    </div>
  );
}
