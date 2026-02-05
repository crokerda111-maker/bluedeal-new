"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getInquiryBoard,
  inquiryVisibilityToBoardKey,
  POST_TYPE_LABEL,
} from "../../../../lib/boardConfig";
import { MOCK_POSTS } from "../../../../lib/mockPosts";
import type { InquiryVisibility, Post } from "../../../../lib/postTypes";
import { formatKoreanDate, getLocalPostById, verifyLocalPostPassword } from "../../../../lib/postStorage";

function ExtraRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-3 text-sm">
      <div className="w-28 shrink-0 text-white/55">{label}</div>
      <div className="text-white/80">{String(value)}</div>
    </div>
  );
}

export default function InquiryPostPage({ params }: { params: { visibility: string; id: string } }) {
  const vis = params.visibility as InquiryVisibility;
  const board = getInquiryBoard(vis);
  const [post, setPost] = useState<Post | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    const local = getLocalPostById(params.id);
    if (local) return setPost(local);
    const key = inquiryVisibilityToBoardKey(vis);
    const seed = MOCK_POSTS.find((p) => p.boardKey === key && p.id === params.id);
    setPost(seed ?? null);
  }, [params.id, vis]);

  useEffect(() => {
    // 공개 문의는 바로 열람
    if (!post) return;
    if (!post.isPrivate) setUnlocked(true);
  }, [post]);

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of board?.extraFields ?? []) m.set(f.key, f.label);
    return m;
  }, [board]);

  const extraEntries = useMemo(() => {
    return Object.entries(post?.extra ?? {});
  }, [post]);

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

  if (!post) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">글을 찾을 수 없음</div>
        <div className="mt-2 text-sm text-white/70">삭제되었거나 존재하지 않는 글입니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href={`/contact/${board.slug}`}>
          목록으로
        </Link>
      </div>
    );
  }

  const isPrivateBoard = vis === "private";

  const tryUnlock = async () => {
    setPwError(null);
    const ok = await verifyLocalPostPassword(post, pw);
    if (!ok) return setPwError("비밀번호가 일치하지 않습니다.");
    setUnlocked(true);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-white/60">
            {board.title} · {POST_TYPE_LABEL[post.type]} {isPrivateBoard ? "· 🔒" : ""}
          </div>
          <Link className="text-sm text-cyan-200 hover:underline" href={`/contact/${board.slug}`}>
            ← 목록
          </Link>
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{post.title}</h1>

        <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-white/60">
          <div>작성일: {formatKoreanDate(post.createdAt)}</div>
          {post.authorName ? <div>작성자: {post.authorName}</div> : null}
          <div className="text-white/40">(MVP: localStorage 저장)</div>
        </div>
      </section>

      {post.isPrivate && !unlocked ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">비공개 글입니다</div>
          <div className="mt-2 text-sm text-white/70">비밀번호를 입력하면 내용을 볼 수 있습니다.</div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="비밀번호"
            />
            <button
              type="button"
              onClick={tryUnlock}
              className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 sm:w-auto"
            >
              열람
            </button>
          </div>
          {pwError ? <div className="mt-3 text-sm text-red-200">{pwError}</div> : null}
        </section>
      ) : null}

      {unlocked ? (
        <>
          {extraEntries.length ? (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm font-semibold">추가 정보</div>
              <div className="mt-3 grid gap-2">
                {extraEntries.map(([k, v]) => (
                  <ExtraRow key={k} label={labelMap.get(k) ?? k} value={v} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="whitespace-pre-wrap text-sm leading-6 text-white/80">{post.content}</div>
          </section>
        </>
      ) : null}
    </div>
  );
}
