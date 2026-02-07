"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCommunityBoard, POST_TYPE_LABEL } from "../../../../lib/boardConfig";
import {
  apiCreateComment,
  apiGetPost,
  apiListComments,
  mapApiCommentToComment,
  mapApiPostToPost,
} from "../../../../lib/apiClient";
import { useAuth } from "../../../_components/AuthProvider";
import type { Comment, Post } from "../../../../lib/postTypes";
import { formatKoreanDate } from "../../../../lib/postStorage";

export default function CommunityPostPage({
  params,
}: {
  params: { board: string; id: string };
}) {
  const board = getCommunityBoard(params.board);
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGetPost(params.id);
        if (ignore) return;
        const mapped = mapApiPostToPost(data.post);
        if (!board || mapped.boardKey !== board.key) {
          setPost(null);
          setError("게시글을 찾을 수 없습니다.");
          return;
        }
        setPost(mapped);
      } catch (e: any) {
        if (ignore) return;
        setPost(null);
        setError(e?.message || "게시글을 불러오지 못했습니다.");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [params.id, board?.key]);

  const refreshComments = async () => {
    setCommentsLoading(true);
    setCommentError(null);
    try {
      const data = await apiListComments(params.id);
      setComments(data.items.map(mapApiCommentToComment));
    } catch (e: any) {
      setCommentError(e?.message || "댓글을 불러오지 못했습니다.");
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (!post) return;
    refreshComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const typeLabel = useMemo(() => (post ? POST_TYPE_LABEL[post.type] ?? post.type : ""), [post]);

  if (!board) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-white">잘못된 게시판</h1>
        <p className="text-white/60">존재하지 않는 게시판입니다.</p>
        <Link className="text-sky-300 hover:underline" href="/community">
          커뮤니티로
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">불러오는 중…</div>;
  }

  if (error || !post) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-white">게시글을 찾을 수 없음</h1>
        <p className="text-white/60">{error || "존재하지 않는 게시글입니다."}</p>
        <div className="flex gap-3">
          <Link className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-white/80 hover:bg-white/10" href={`/community/${board.key}`}>
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="text-white/70 hover:underline" href={`/community/${board.key}`}>
              {board.title}
            </Link>
            <span className="text-white/40">/</span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80">{typeLabel}</span>
            {post.isPrivate ? (
              <span className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-100">
                비공개
              </span>
            ) : null}
          </div>
          <div className="text-sm text-white/60">{formatKoreanDate(post.createdAt)}</div>
        </div>

        <h1 className="mt-3 text-2xl font-semibold text-white">{post.title}</h1>
        <div className="mt-1 text-white/60">작성자: {post.authorName}</div>

        {post.extra && Object.keys(post.extra).length > 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-sm font-semibold text-white/80">추가 정보</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(post.extra).map(([k, v]) => (
                <div key={k} className="text-sm text-white/80">
                  <span className="text-white/60">{k}</span>
                  <span className="text-white/40">: </span>
                  <span>{String(v ?? "")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 whitespace-pre-wrap leading-relaxed text-white/85">{post.content}</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">댓글</h2>
          <button
            type="button"
            onClick={refreshComments}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            새로고침
          </button>
        </div>

        {commentError ? <div className="mt-3 text-sm text-rose-200">{commentError}</div> : null}

        <div className="mt-4 space-y-3">
          {commentsLoading ? (
            <div className="text-white/60">불러오는 중…</div>
          ) : comments.length === 0 ? (
            <div className="text-white/60">댓글이 없습니다.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-white/80">{c.authorName}</div>
                  <div className="text-xs text-white/50">{formatKoreanDate(c.createdAt)}</div>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-white/85">{c.content}</div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          {!authLoading && !user ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              댓글 작성은 로그인이 필요합니다.{' '}
              <Link className="text-sky-300 hover:underline" href={`/account?returnTo=/community/${board.key}/${post.id}`}>
                로그인 하러가기
              </Link>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setCommentError(null);
                const content = commentDraft.trim();
                if (!content) return;
                try {
                  setCommentBusy(true);
                  await apiCreateComment(post.id, { content });
                  setCommentDraft("");
                  await refreshComments();
                } catch (err: any) {
                  setCommentError(err?.message || "댓글 작성에 실패했습니다.");
                } finally {
                  setCommentBusy(false);
                }
              }}
              className="space-y-3"
            >
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none placeholder:text-white/40 focus:border-sky-400/40"
                placeholder="댓글을 입력하세요"
              />
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={commentBusy}
                  className="rounded-xl bg-sky-400/90 px-4 py-2 text-sm font-semibold text-black hover:bg-sky-400 disabled:opacity-50"
                >
                  {commentBusy ? "등록 중…" : "댓글 등록"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
