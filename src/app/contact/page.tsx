"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { POST_TYPE_LABEL } from "../../lib/boardConfig";
import type { InquiryVisibility, Post } from "../../lib/postTypes";
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

export default function ContactPage() {
  const [filter, setFilter] = useState<"all" | InquiryVisibility>("all");
  const [q, setQ] = useState("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiListPosts("inquiry")
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
    let list = posts;
    if (filter !== "all") list = list.filter((p) => (filter === "private" ? !!p.isPrivate : !p.isPrivate));

    const query = q.trim();
    if (query) list = list.filter((p) => includesQuery(p, query));

    return list;
  }, [posts, filter, q]);

  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">문의</h1>
            <p className="mt-2 text-sm text-white/70">
              제보/오탈자/제휴 문의를 남겨주세요. <b>공개/비공개</b>를 선택할 수 있으며, 비공개 글은 비밀번호로 보호됩니다.
            </p>
          </div>

          <Link
            href="/contact/write"
            className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            문의 작성
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            aria-label="문의 검색"
            maxLength={100}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50 md:max-w-md"
            placeholder="검색: 제목/내용/작성자/이메일"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                filter === "all"
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              전체
            </button>
            <button
              type="button"
              aria-pressed={filter === "public"}
              onClick={() => setFilter("public")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                filter === "public"
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              공개
            </button>
            <button
              type="button"
              aria-pressed={filter === "private"}
              onClick={() => setFilter("private")}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                filter === "private"
                  ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              비공개
            </button>
          </div>
        </div>
      </section>

      {loadError ? <PostLoadError onRetry={() => { setLoadError(false); setLoading(true); setAttempt(value => value + 1); }} /> : null}

      <MobilePostList posts={filtered} hrefPrefix="/contact" loading={loading} showVisibility emptyText={loadError ? "게시글을 다시 불러와 주세요." : "조건에 맞는 문의가 없습니다."} />

      <section className="bd-surface-md hidden overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 md:block" aria-label="문의 게시글 목록" tabIndex={0}>
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
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">
                    <div className="flex flex-col gap-0.5 leading-tight">
                      <span className="block truncate">{POST_TYPE_LABEL[p.type]}</span>
                      <span className="text-xs text-white/70">{p.isPrivate ? "비공개" : "공개"}</span>
                    </div>
                  </td>
                  <td className="border-l border-white/10 px-4 py-3">
                    <Link className="block truncate text-white/85 hover:underline" href={`/contact/${p.id}`} title={p.title}>
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

      <section className="bd-surface-md p-6 text-sm text-white/70">
        <div className="font-semibold text-white">안내</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>비공개 문의는 비밀번호로 잠깁니다.</li>
          <li>개인정보(실명/연락처 등)는 가급적 적지 마세요.</li>
          <li>답변이 필요한 경우 연락 이메일을 남겨주세요.</li>
        </ul>
      </section>
    </div>
  );
}
