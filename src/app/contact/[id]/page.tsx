"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INQUIRY_BOARD } from "../../../lib/boardConfig";
import {
  apiCreateComment,
  apiGetPost,
  apiListComments,
  mapApiCommentToComment,
  mapApiPostToPost,
} from "../../../lib/apiClient";
import type { Post } from "../../../lib/postTypes";
import { formatKoreanDate } from "../../../lib/postStorage";
import { useAuth } from "../../_components/AuthProvider";

type UiComment = {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
};

export default function ContactPostPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<UiComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetPost(params.id);
        const mapped = mapApiPostToPost(data.post);
        if (!ignore) setPost(mapped);
      } catch (e: any) {
        if (!ignore) {
          setError(e?.message ?? "글을 불러오지 못했습니다.");
          setPost(null);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [params.id]);

  const extraLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of INQUIRY_BOARD.extraFields) map.set(f.key, f.label);
    return map;
  }, []);

  const visibleExtraEntries = useMemo(() => {
    if (!post) return [] as Array<[string, any]>;
    const entries = Object.entries(post.extra ?? {});
    return entries.filter(([k, v]) => v !== null && v !== undefined && String(v).trim() !== "");
  }, [post]);

  const loadComments = async () => {
    if (!post) return;
    setCommentsLoading(true);
    try {
      const data = await apiListComments(Number(post.id));
      const mapped = data.items.map((c) => mapApiCommentToComment(c));
      setComments(
        mapped.map((c) => ({
          id: c.id,
          authorName: c.authorName,
          content: c.content,
          createdAt: c.createdAt,
        }))
      );
    } catch (e) {
      // ignore
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (!post) return;
    void loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  const onSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);
    if (!post) return;
    if (!user) {
      setCommentError("댓글은 로그인 후 작성할 수 있습니다.");
      return;
    }
    const content = commentText.trim();
    if (!content) return;
    try {
      await apiCreateComment(Number(post.id), { content });
      setCommentText("");
      await loadComments();
    } catch (e: any) {
      setCommentError(e?.message ?? "댓글 작성에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-white/70">
        불러오는 중…
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-white/70">
          {error ?? "글을 찾을 수 없습니다."}
        </div>
        <Link href="/contact" className="text-white/80 underline">
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-white/60">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5">
            {INQUIRY_BOARD.title}
          </span>
          <span>·</span>
          <span>{formatKoreanDate(post.createdAt)}</span>
          <span>·</span>
          <span>작성자: {post.authorName}</span>
        </div>

        <h1 className="text-2xl font-semibold text-white">{post.title}</h1>

        {visibleExtraEntries.length > 0 && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 text-sm font-medium text-white/80">추가 정보</div>
            <div className="grid gap-2 md:grid-cols-2">
              {visibleExtraEntries.map(([k, v]) => (
                <div key={k} className="text-sm text-white/70">
                  <span className="text-white/60">{extraLabelMap.get(k) ?? k}</span>
                  <span className="mx-2 text-white/20">·</span>
                  <span className="text-white/80">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="prose prose-invert mt-6 max-w-none">
          {post.content.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 text-lg font-semibold text-white">댓글</div>

        {commentsLoading ? (
          <div className="text-sm text-white/60">불러오는 중…</div>
        ) : comments.length === 0 ? (
          <div className="text-sm text-white/60">아직 댓글이 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                  <span>{c.authorName}</span>
                  <span>{formatKoreanDate(c.createdAt)}</span>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">{c.content}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-white/10 pt-4">
          {!user && !authLoading ? (
            <div className="text-sm text-white/60">
              댓글 작성은 <Link href="/account" className="underline text-white/80">로그인</Link> 후 가능합니다.
            </div>
          ) : (
            <form onSubmit={onSubmitComment} className="space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요"
                rows={3}
                className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
              />
              {commentError && <div className="text-sm text-rose-300">{commentError}</div>}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500/90 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
                >
                  댓글 등록
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Link href="/contact" className="text-white/80 underline">
          목록으로
        </Link>
        <Link
          href="/contact/write"
          className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
        >
          새 문의
        </Link>
      </div>
    </div>
  );
}
