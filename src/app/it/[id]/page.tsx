"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD, POST_TYPE_LABEL } from "../../../lib/boardConfig";
import {
  apiCreateComment,
  apiGetPost,
  apiListComments,
  mapApiCommentToComment,
  mapApiPostToPost,
} from "../../../lib/apiClient";
import { useAuth } from "../../_components/AuthProvider";
import type { Post } from "../../../lib/postTypes";
import { formatKoreanDate } from "../../../lib/postStorage";

type Comment = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export default function ItPostPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetPost(params.id);
        if (cancelled) return;
        setPost(mapApiPostToPost(data.post));
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "글을 불러오지 못했습니다.");
        setPost(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const refreshComments = async () => {
    setCommentsLoading(true);
    setCommentError(null);
    try {
      const data = await apiListComments(params.id);
      const mapped = (data.items ?? []).map(mapApiCommentToComment).map((c) => ({
        id: c.id,
        authorName: c.authorName,
        content: c.content,
        createdAt: c.createdAt,
      }));
      setComments(mapped);
    } catch (e: any) {
      setCommentError(e?.message ?? "댓글을 불러오지 못했습니다.");
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    // 댓글은 글이 정상 로드된 뒤에만
    if (!post) return;
    void refreshComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const meta = useMemo(() => {
    if (!post) return null;
    return {
      typeLabel: POST_TYPE_LABEL[post.type] ?? post.type,
      created: formatKoreanDate(post.createdAt),
    };
  }, [post]);

  const submitComment = async () => {
    if (!post) return;
    if (!commentText.trim()) return;
    if (!user) {
      setCommentError("댓글 작성은 로그인 후 가능합니다.");
      return;
    }
    setCommentSubmitting(true);
    setCommentError(null);
    try {
      await apiCreateComment(post.id, commentText.trim());
      setCommentText("");
      await refreshComments();
    } catch (e: any) {
      setCommentError(e?.message ?? "댓글 작성에 실패했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">로딩중…</div>
    );
  }

  if (!post) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-white/90">글을 찾을 수 없습니다.</div>
        {error && <div className="mt-2 text-sm text-rose-200">{error}</div>}
        <div className="mt-4">
          <Link href="/it" className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-white/60">{IT_BOARD.title}</div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">{post.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{meta?.typeLabel}</span>
              <span>·</span>
              <span>{post.authorName}</span>
              <span>·</span>
              <span>{meta?.created}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/it"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              목록
            </Link>
          </div>
        </div>

        <div className="mt-5 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-white/90">
          {post.content}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-sm font-medium text-white">댓글</div>

        <div className="mt-3 space-y-2">
          {commentsLoading ? (
            <div className="text-sm text-white/60">불러오는 중…</div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-white/60">아직 댓글이 없습니다.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-white/70">
                    <span className="font-medium text-white/85">{c.authorName}</span>
                    <span className="mx-2 text-white/30">·</span>
                    <span>{formatKoreanDate(c.createdAt)}</span>
                  </div>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/90">{c.content}</div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/60">
              {authLoading ? "" : user ? `로그인: ${user.nickname}` : "댓글 작성은 로그인 필요"}
            </div>
            {!authLoading && !user && (
              <Link href="/account?returnTo=/it" className="text-xs text-cyan-200 hover:underline">
                로그인
              </Link>
            )}
          </div>

          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={user ? "댓글을 입력하세요" : "로그인 후 댓글을 작성할 수 있어요"}
            className="mt-2 h-24 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
            disabled={!user}
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-xs text-rose-200">{commentError ?? ""}</div>
            <button
              type="button"
              onClick={submitComment}
              disabled={!user || commentSubmitting || !commentText.trim()}
              className="rounded-lg bg-cyan-300/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {commentSubmitting ? "등록중…" : "댓글 등록"}
            </button>
          </div>
        </div>
      </div>

      <div className="text-xs text-white/40">
        {IT_BOARD.title} — API 연동 버전
      </div>
    </div>
  );
}
