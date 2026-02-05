"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCommunityBoard, POST_TYPE_LABEL } from "../../../../lib/boardConfig";
import { MOCK_POSTS } from "../../../../lib/mockPosts";
import type { Post } from "../../../../lib/postTypes";
import { formatKoreanDate, getLocalPostById } from "../../../../lib/postStorage";

function ExtraRow({ label, value }: { label: string; value: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex gap-3 text-sm">
      <div className="w-28 shrink-0 text-white/55">{label}</div>
      <div className="text-white/80">{String(value)}</div>
    </div>
  );
}

export default function CommunityPostPage({ params }: { params: { board: string; id: string } }) {
  const board = getCommunityBoard(params.board);
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    const local = getLocalPostById(params.id);
    if (local) return setPost(local);
    const seed = MOCK_POSTS.find((p) => p.id === params.id);
    setPost(seed ?? null);
  }, [params.id]);

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of board?.extraFields ?? []) m.set(f.key, f.label);
    // 자주 보이는 키는 보정
    m.set("rating", "만족도");
    return m;
  }, [board]);

  const extraEntries = useMemo(() => {
    return Object.entries(post?.extra ?? {});
  }, [post]);

  if (!board) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">없는 게시판</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/community">
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">글을 찾을 수 없음</div>
        <div className="mt-2 text-sm text-white/70">삭제되었거나 존재하지 않는 글입니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href={`/community/${board.slug}`}>
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-white/60">
            {board.title} · {POST_TYPE_LABEL[post.type]}
          </div>
          <Link className="text-sm text-cyan-200 hover:underline" href={`/community/${board.slug}`}>
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
    </div>
  );
}
