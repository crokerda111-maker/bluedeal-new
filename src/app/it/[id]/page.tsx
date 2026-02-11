"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD } from "../../../lib/boardConfig";
import { MOCK_POSTS } from "../../../lib/mockPosts";
import type { Post } from "../../../lib/postTypes";
import { ApiError, apiGetPost } from "../../../lib/postsClient";
import { formatKoreanDate } from "../../../lib/postStorage";
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

export default function ITPostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiGetPost(params.id)
      .then((p) => {
        if (cancelled) return;
        setPost(p.boardKey === "it" ? p : null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        const seed = MOCK_POSTS.find((p) => p.boardKey === "it" && p.id === params.id);
        setPost(seed ?? null);

        const msg = typeof e?.message === "string" ? e.message : "글을 불러오지 못했습니다.";
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
  }, [params.id]);

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of IT_BOARD.extraFields ?? []) m.set(f.key, f.label);
    return m;
  }, []);

  const extraEntries = useMemo(() => Object.entries(post?.extra ?? {}), [post]);
  const isKvMissing = loadError?.code === "KV_NOT_CONFIGURED";

  if (loading && !post) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">불러오는 중...</div>
        <div className="mt-2 text-sm text-white/70">게시글을 불러오고 있습니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/it">
          IT 소식으로 돌아가기
        </Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">글을 찾을 수 없음</div>
        <div className="mt-2 text-sm text-white/70">
          {isKvMissing ? "온라인 게시판이 아직 연결되지 않았습니다." : "삭제되었거나 존재하지 않는 글입니다."}
        </div>
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
          {post.authorName ?? "익명"} · {formatKoreanDate(post.createdAt)}
        </div>
      </div>

      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
        <div className="mt-4 whitespace-pre-wrap text-sm text-white/85">{post.content}</div>
      </section>

      {extraEntries.length ? (
        <section className="bd-surface-md p-6">
          <div className="text-sm font-semibold">추가 정보</div>
          <div className="mt-4 space-y-2">
            {extraEntries.map(([k, v]) => (
              <ExtraRow key={k} label={labelMap.get(k) ?? k} value={v} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
