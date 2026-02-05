"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD, POST_TYPE_LABEL } from "../../../lib/boardConfig";
import { MOCK_POSTS } from "../../../lib/mockPosts";
import type { Post } from "../../../lib/postTypes";
import { formatKoreanDate, getLocalPostById } from "../../../lib/postStorage";

function ExtraRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-3 text-sm">
      <div className="w-28 shrink-0 text-white/55">{label}</div>
      <div className="text-white/80 break-all">{String(value)}</div>
    </div>
  );
}

export default function ITPostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    const local = getLocalPostById(params.id);
    if (local && local.boardKey === "it") return setPost(local);

    const seed = MOCK_POSTS.find((p) => p.boardKey === "it" && p.id === params.id);
    setPost(seed ?? null);
  }, [params.id]);

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of IT_BOARD.extraFields ?? []) m.set(f.key, f.label);
    return m;
  }, []);

  const extraEntries = useMemo(() => Object.entries(post?.extra ?? {}), [post]);

  if (!post) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">글을 찾을 수 없음</div>
        <div className="mt-2 text-sm text-white/70">삭제되었거나 존재하지 않는 글입니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/it">
          IT 소식으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="text-sm text-cyan-200 hover:underline" href="/it">
          ← 목록으로
        </Link>

        <div className="text-[12px] text-white/55">
          {POST_TYPE_LABEL[post.type]} · {post.authorName ?? "익명"} · {formatKoreanDate(post.createdAt)}
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
        <div className="mt-4 whitespace-pre-wrap text-sm text-white/85">{post.content}</div>
      </section>

      {extraEntries.length ? (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">추가 정보</div>
          <div className="mt-4 space-y-2">
            {extraEntries.map(([k, v]) => (
              <ExtraRow key={k} label={labelMap.get(k) ?? k} value={v} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="text-[12px] text-white/50">
        * MVP 단계: 글 저장은 브라우저(localStorage) 기준입니다. (공유/동기화는 다음 단계에서 VPS/DB 연동)
      </div>
    </div>
  );
}
