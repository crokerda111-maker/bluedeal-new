"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IT_BOARD, labelByType } from "../../lib/boardConfig";
import type { Post } from "../../lib/postTypes";
import { apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";
import MobilePostList from "../../components/MobilePostList";
import PostLoadError from "../../components/PostLoadError";

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

function ITNewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const section = searchParams.get("section") === "pick" ? "pick" : "news";
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiListPosts("it")
      .then((data) => {
        if (cancelled) return;
        setPosts(data);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setLoadError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const filtered = useMemo(() => {
    const query = q.trim();
    return posts.filter((p) => {
      const sectionMatch = section === "pick" ? p.type === "pick" : p.type !== "pick";
      return sectionMatch && includesQuery(p, query);
    });
  }, [posts, q, section]);

  const selectSection = (next: "news" | "pick") => {
    router.replace(next === "pick" ? "/it?section=pick" : "/it?section=news", { scroll: false });
  };

  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{IT_BOARD.title}</h1>
            <p className="mt-2 text-sm text-white/70">{IT_BOARD.description}</p>
            {IT_BOARD.writeHint ? <p className="mt-2 text-[12px] text-white/70">{IT_BOARD.writeHint}</p> : null}
          </div>

          <Link
            href="/it/write"
            className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            글쓰기
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={section === "news"}
            onClick={() => selectSection("news")}
            className={`rounded-xl border px-4 py-2 text-sm ${
              section === "news"
                ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            뉴스
          </button>
          <button
            type="button"
            aria-pressed={section === "pick"}
            onClick={() => selectSection("pick")}
            className={`rounded-xl border px-4 py-2 text-sm ${
              section === "pick"
                ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            곰선생 추천픽
          </button>
        </div>

        <div className="mt-4">
          <input
            type="search"
            aria-label="IT 소식 검색"
            maxLength={100}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50 md:max-w-md"
            placeholder="검색: 제목/내용/작성자/태그"
          />
        </div>
      </section>

      {loadError ? <PostLoadError onRetry={() => { setLoadError(false); setLoading(true); setAttempt(value => value + 1); }} /> : null}

      <MobilePostList posts={filtered} hrefPrefix="/it" loading={loading} emptyText={loadError ? "게시글을 다시 불러와 주세요." : "조건에 맞는 글이 없습니다."} />

      <section className="bd-surface-md hidden overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 md:block" aria-label="IT 소식 게시글 목록" tabIndex={0}>
        <table className="w-full min-w-[40rem] table-fixed border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-white/70">
            <tr>
              <th className="w-[5ch] px-4 py-3 text-left font-semibold text-white/80">분류</th>
              <th className="w-[20ch] border-l border-white/10 px-4 py-3 text-left font-semibold text-white/80">제목</th>
              <th className="w-[8ch] border-l border-white/10 px-4 py-3 text-left font-semibold text-white/80">작성자</th>
              <th className="w-[16ch] border-l border-white/10 px-4 py-3 text-left font-semibold text-white/80">작성일 (KST)</th>
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
                  조건에 맞는 글이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">
                    <span className={`block truncate ${p.type === "pick" ? "text-amber-200" : ""}`}>
                      {p.type === "general" ? "뉴스" : labelByType(p.type)}
                    </span>
                  </td>
                  <td className="border-l border-white/10 px-4 py-3">
                    <Link className="block truncate text-white/85 hover:underline" href={`/it/${p.id}`} title={p.title}>
                      {p.title}
                    </Link>
                  </td>
                  <td className="border-l border-white/10 px-4 py-3 text-white/70">
                    <span className="block truncate">{p.authorName ?? "익명"}</span>
                  </td>
                  <td className="border-l border-white/10 px-4 py-3 text-white/70">
                    <span className="block whitespace-nowrap">{formatKoreanDate(p.createdAt)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default function ITNewsPage() {
  return (
    <Suspense fallback={<div className="bd-surface-md p-6 text-sm text-white/60">IT 소식을 불러오는 중...</div>}>
      <ITNewsContent />
    </Suspense>
  );
}
