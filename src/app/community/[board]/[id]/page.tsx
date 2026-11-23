"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { getCommunityBoard, POST_TYPE_LABEL } from "../../../../lib/boardConfig";
import type { Post } from "../../../../lib/postTypes";
import { ApiError, apiAdminStatus, apiGetPost } from "../../../../lib/postsClient";
import { issuePostTitle } from "../../../../lib/postInput";
import { formatKoreanDate } from "../../../../lib/postStorage";
import { isHttpUrl } from "../../../../components/SmartLink";
import PostContentLink from "../../../../components/PostContentLink";
import PostAffiliateNotice from "../../../../components/PostAffiliateNotice";
import LinkifiedText from "../../../../components/LinkifiedText";
import PostDetailError from "../../../../components/PostDetailError";
import HotdealTerms from "../../../../components/HotdealTerms";
import { HOTDEAL_CATEGORIES, hotdealCategory, isHotdealAuthor } from "../../../../lib/hotdeal";

function ExtraRow({ label, value, linkInfo }: { label: string; value: any; linkInfo: Post["linkInfo"] }) {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  const isLink = isHttpUrl(text) || text.startsWith("/go/");
  return (
    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
      <div className="[overflow-wrap:anywhere] sm:w-28 sm:shrink-0 text-white/70">{label}</div>
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere] text-white/80">
        {isLink ? (
          <PostContentLink href={text} info={linkInfo}>
            {text}
          </PostContentLink>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

export default function CommunityPostPage({ params }: { params: Promise<{ board: string; id: string }> }) {
  const { board: boardSlug, id: postId } = use(params);
  return <CommunityPost key={`${boardSlug}:${postId}`} boardSlug={boardSlug} postId={postId} />;
}

function CommunityPost({ boardSlug, postId }: { boardSlug: string; postId: string }) {
  const board = getCommunityBoard(boardSlug);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 관리자 로그인 상태 확인 (서버가 쿠키로 판별)
    apiAdminStatus()
      .then((admin) => {
        if (cancelled) return;
        setIsAdmin(admin);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
      });

    apiGetPost(postId)
      .then((p) => {
        if (cancelled) return;
        setPost(p);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setPost(null);
        setLoadError({ status: e instanceof ApiError ? e.status : undefined });
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId, attempt]);

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of board?.extraFields ?? []) m.set(f.key, f.label);
    // 자주 보이는 키는 보정
    m.set("rating", "만족도");
    m.set("notesSource", "후기·상품 출처");
    m.set("comparisonSource", "비교 가격 출처");
    return m;
  }, [board]);

  const extraEntries = useMemo(() => {
    return Object.entries(post?.extra ?? {}).flatMap(([key, value]) => {
      if (post?.hotdeal && key === "dealLink") return [];
      if (post?.boardKey === "hotdeal" && key === "category" && value) {
        return [[key, HOTDEAL_CATEGORIES.find(item => item.value === hotdealCategory(value))?.label] as const];
      }
      return [[key, value] as const];
    });
  }, [post]);

  if (!board) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">없는 게시판</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/community">
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  if (loading && !post) {
    return (
      <div className="bd-surface-md p-6" role="status" aria-live="polite">
        <div className="text-lg font-semibold">불러오는 중...</div>
        <div className="mt-2 text-sm text-white/70">게시글을 불러오고 있습니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href={`/community/${board.slug}`}>
          목록으로
        </Link>
      </div>
    );
  }

  if (!post || post.boardKey !== board.key) {
    return <PostDetailError missing={!loadError || loadError.status === 404} onRetry={() => { setLoadError(null); setLoading(true); setAttempt(value => value + 1); }} backHref={`/community/${board.slug}`} backLabel="목록으로" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="text-sm text-cyan-200 hover:underline" href={`/community/${board.slug}`}>
          ← 목록으로
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 [overflow-wrap:anywhere] text-[12px] text-white/70">
            {post.hotdeal ? "블루딜 검증 딜" : POST_TYPE_LABEL[post.type]} · {board.key === "hotdeal" && !post.hotdeal && isHotdealAuthor(post.authorName) ? "커뮤니티 회원" : post.authorName ?? "익명"} · {formatKoreanDate(post.createdAt)}
          </div>
          {isAdmin ? (
            <Link
              href={`/admin/edit/${post.id}`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              수정
            </Link>
          ) : null}
        </div>
      </div>

      <section className="bd-surface-md p-6">
        <h1 className="[overflow-wrap:anywhere] text-2xl font-semibold tracking-tight">{board.key === "issue" && post.title === issuePostTitle(post.content) ? "한 줄 이슈" : post.title}</h1>
        <PostAffiliateNotice info={post.linkInfo} />
        <HotdealTerms post={post} />
        <LinkifiedText text={post.content} linkInfo={post.linkInfo} className="mt-4 whitespace-pre-wrap text-sm text-white/85" />
      </section>

      {extraEntries.length ? (
        <section className="bd-surface-md p-6">
          <div className="text-sm font-semibold">추가 정보</div>
          <div className="mt-4 space-y-2">
            {extraEntries.map(([k, v]) => (
              <ExtraRow key={k} label={labelMap.get(k) ?? k} value={v} linkInfo={post.linkInfo} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
