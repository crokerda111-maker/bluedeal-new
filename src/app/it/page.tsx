"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD, POST_TYPE_LABEL, POST_TYPE_OPTIONS } from "../../lib/boardConfig";
import type { Post, PostType } from "../../lib/postTypes";
import { formatKoreanDate } from "../../lib/postStorage";
import { apiListBoardPosts, mapApiPostToPost } from "../../lib/apiClient";

export default function ITNewsPage() {
  const [typeFilter, setTypeFilter] = useState<"all" | PostType>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiListBoardPosts("it", 1, 100);
        if (ignore) return;
        setPosts((data.items ?? []).map(mapApiPostToPost));
      } catch (e: any) {
        if (ignore) return;
        setError(e?.message ?? "게시글을 불러오지 못했습니다.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
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
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-white/60">
                  {error}
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
