"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { POST_TYPE_LABEL } from "../../../lib/boardConfig";
import { MOCK_POSTS } from "../../../lib/mockPosts";
import type { Post } from "../../../lib/postTypes";
import { formatKoreanDate, getLocalPostById, verifyLocalPostPassword } from "../../../lib/postStorage";
import SmartLink, { isHttpUrl } from "../../../components/SmartLink";

function ExtraRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  const isLink = isHttpUrl(text) || text.startsWith("/go/");
  return (
    <div className="flex gap-3 text-sm">
      <div className="w-28 shrink-0 text-white/55">{label}</div>
      <div className="text-white/80 break-all">
        {isLink ? (
          <SmartLink href={text} className="text-cyan-200 hover:underline" title="새 창으로 열기">
            {text}
          </SmartLink>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

export default function ContactPostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    const local = getLocalPostById(params.id);
    if (local && local.boardKey === "inquiry") return setPost(local);

    const seed = MOCK_POSTS.find((p) => p.boardKey === "inquiry" && p.id === params.id);
    setPost(seed ?? null);
  }, [params.id]);

  useEffect(() => {
    if (!post) return;
    if (!post.isPrivate) setUnlocked(true);
  }, [post]);

  const extraEntries = useMemo(() => Object.entries(post?.extra ?? {}), [post]);

  if (!post) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">글을 찾을 수 없음</div>
        <div className="mt-2 text-sm text-white/70">삭제되었거나 존재하지 않는 글입니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/contact">
          문의로 돌아가기
        </Link>
      </div>
    );
  }

  const onUnlock = async () => {
    setPwError(null);
    const ok = await verifyLocalPostPassword(post, pw);
    if (!ok) return setPwError("비밀번호가 맞지 않습니다.");
    setUnlocked(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="text-sm text-cyan-200 hover:underline" href="/contact">
          ← 문의 목록
        </Link>

        <div className="text-[12px] text-white/55">
          {post.isPrivate ? "🔒 비공개" : "🌐 공개"} · {POST_TYPE_LABEL[post.type]} · {post.authorName ?? "익명"} ·{" "}
          {formatKoreanDate(post.createdAt)}
        </div>
      </div>

      {!unlocked ? (
        <section className="bd-surface-md p-6">
          <div className="text-lg font-semibold">비공개 문의</div>
          <div className="mt-2 text-sm text-white/70">열람하려면 비밀번호를 입력하세요.</div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type="password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50 sm:max-w-sm"
              placeholder="비밀번호"
            />
            <button
              onClick={onUnlock}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
              type="button"
            >
              열람
            </button>
          </div>

          {pwError ? <div className="mt-3 text-sm text-red-200">{pwError}</div> : null}
        </section>
      ) : (
        <>
          <section className="bd-surface-md p-6">
            <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
            <div className="mt-4 whitespace-pre-wrap text-sm text-white/85">{post.content}</div>
          </section>

          {extraEntries.length ? (
            <section className="bd-surface-md p-6">
              <div className="text-sm font-semibold">추가 정보</div>
              <div className="mt-4 space-y-2">
                {extraEntries.map(([k, v]) => (
                  <ExtraRow key={k} label={k} value={v} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
