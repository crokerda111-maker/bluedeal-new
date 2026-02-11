"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD } from "../../lib/boardConfig";
import { MOCK_POSTS } from "../../lib/mockPosts";
import type { Post } from "../../lib/postTypes";
import { ApiError, apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";

function includesQuery(p: Post, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const hay = [
    p.title,
    p.content,
    p.authorName ?? "",
    ...Object.values(p.extra ?? {}).map((v) => String(v ?? "")),
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

export default function ITNewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null);

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

        const msg = typeof e?.message === "string" ? e.message : "게시글을 불러오지 못했습니다.";
        const code = e instanceof ApiError ? e.code : e?.code;
        setLoadError({ message: msg, code });
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
    const query = q.trim();
    if (!query) return posts;
    return posts.filter((p) => includesQuery(p, query));
  }, [posts, q]);

  const isKvMissing = loadError?.code === "KV_NOT_CONFIGURED";

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

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50 md:max-w-md"
            placeholder="검색: 제목/내용/작성자/태그"
          />
        </div>
      </section>

      {loadError ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            isKvMissing
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {isKvMissing ? (
            <>
              온라인 게시판이 아직 연결되지 않아 <b>샘플 글</b>을 표시합니다.
              <div className="mt-1 text-[12px] text-white/50">Vercel KV/Upstash 환경변수 설정 후 재배포하면 정상 동작합니다.</div>
            </>
          ) : (
            <>
              게시글을 불러오지 못했습니다. ({loadError.message})
              <div className="mt-1 text-[12px] text-white/50">현재는 기본 글을 표시합니다. 잠시 후 다시 시도해 주세요.</div>
            </>
          )}
        </div>
      ) : null}

      <section className="bd-surface-md">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-left">작성자</th>
              <th className="px-4 py-3 text-left">작성일</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-white/60">
                  불러오는 중...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-white/60">
                  조건에 맞는 글이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
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
