"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD, POST_TYPE_LABEL, POST_TYPE_OPTIONS } from "../../lib/boardConfig";
import { MOCK_POSTS } from "../../lib/mockPosts";
import type { Post, PostType } from "../../lib/postTypes";
import { apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";

export default function ITNewsPage() {
  const [typeFilter, setTypeFilter] = useState<"all" | PostType>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiListPosts("it")
      .then((data) => {
        if (cancelled) return;
        setPosts(data);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const seed = MOCK_POSTS.filter((p) => p.boardKey === "it");
        setPosts(seed);
        setLoadError(typeof e?.message === "string" ? e.message : "게시글을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return posts;
    return posts.filter((p) => p.type === typeFilter);
  }, [posts, typeFilter]);

  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{IT_BOARD.title}</h1>
            <p className="mt-2 text-sm text-white/70">{IT_BOARD.description}</p>
            {IT_BOARD.writeHint ? <p className="mt-2 text-[12px] text-white/50">{IT_BOARD.writeHint}</p> : null}
          </div>

          <Link
            href="/it/write"
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
            title={o.hint}
          >
            {o.label}
          </button>
        ))}
      </section>

      {loadError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          온라인 게시판 로딩에 실패했습니다. ({loadError})
          <div className="mt-1 text-[12px] text-white/50">
            KV(Upstash/Vercel KV) 설정이 안 되어 있으면 샘플 글만 보일 수 있습니다.
          </div>
        </div>
      ) : null}

      <section className="bd-surface-md">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">말머리</th>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-left">작성자</th>
              <th className="px-4 py-3 text-left">작성일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-white/60">
                  불러오는 중...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-white/60">
                  아직 글이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">{POST_TYPE_LABEL[p.type]}</td>
                  <td className="px-4 py-3">
                    <Link className="text-white/85 hover:underline" href={`/it/${p.id}`}>
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70">{p.authorName ?? "익명"}</td>
                  <td className="px-4 py-3 text-white/70">{formatKoreanDate(p.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
