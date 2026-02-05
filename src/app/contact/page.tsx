"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { POST_TYPE_LABEL } from "../../lib/boardConfig";
import { MOCK_POSTS } from "../../lib/mockPosts";
import type { InquiryVisibility, Post } from "../../lib/postTypes";
import { formatKoreanDate, getLocalPostsByBoard } from "../../lib/postStorage";

function mergePosts(local: Post[], seed: Post[]): Post[] {
  const map = new Map<string, Post>();
  for (const p of [...seed, ...local]) map.set(p.id, p);
  return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export default function ContactPage() {
  const [filter, setFilter] = useState<"all" | InquiryVisibility>("all");
  const [localPosts, setLocalPosts] = useState<Post[]>([]);

  useEffect(() => {
    const refresh = () => setLocalPosts(getLocalPostsByBoard("inquiry"));
    refresh();

    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes("bluedeal_posts_v1")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const merged = useMemo(() => {
    const seed = MOCK_POSTS.filter((p) => p.boardKey === "inquiry");
    return mergePosts(localPosts, seed);
  }, [localPosts]);

  const filtered = useMemo(() => {
    if (filter === "all") return merged;
    return merged.filter((p) => (filter === "private" ? !!p.isPrivate : !p.isPrivate));
  }, [merged, filter]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">문의</h1>
            <p className="mt-2 text-sm text-white/70">
              글 작성 시 <b>공개/비공개</b>를 선택합니다. (MVP: 브라우저 localStorage 저장)
            </p>
          </div>

          <Link
            href="/contact/write"
            className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            문의 작성
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
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
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">구분</th>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-left">작성자</th>
              <th className="px-4 py-3 text-left">작성일</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-white/60">
                  아직 문의가 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">
                    {p.isPrivate ? (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>🔒</span> 비공개
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span aria-hidden>🌐</span> 공개
                      </span>
                    )}{" "}
                    · {POST_TYPE_LABEL[p.type]}
                  </td>
                  <td className="px-4 py-3">
                    <Link className="text-white/85 hover:underline" href={`/contact/${p.id}`}>
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

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        <div className="font-semibold text-white">운영 메모</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>비공개 문의는 비밀번호로 잠깁니다.</li>
          <li>개인정보(실명/연락처 등)는 가급적 적지 마세요.</li>
          <li>실제 운영 단계에서는 VPS/DB 연동으로 저장/관리 기능을 붙이면 됩니다.</li>
        </ul>
      </section>
    </div>
  );
}
