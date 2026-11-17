"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { POST_TYPE_LABEL } from "../../../lib/boardConfig";
import type { Post } from "../../../lib/postTypes";
import { ApiError, apiGetPost } from "../../../lib/postsClient";
import { formatKoreanDate } from "../../../lib/postStorage";
import { isHttpUrl } from "../../../components/SmartLink";
import PostContentLink from "../../../components/PostContentLink";
import PostAffiliateNotice from "../../../components/PostAffiliateNotice";
import LinkifiedText from "../../../components/LinkifiedText";
import PostDetailError from "../../../components/PostDetailError";

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

export default function ContactPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = use(params);
  return <ContactPost key={postId} postId={postId} />;
}

function ContactPost({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [loadError, setLoadError] = useState<{ status?: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    apiGetPost(postId)
      .then((p) => {
        if (cancelled) return;
        if (p.boardKey !== "inquiry") return setPost(null);
        setPost(p);
      })
      .catch((e: any) => {
        if (cancelled) return;

        const code = e instanceof ApiError ? e.code : e?.code;

        if (code === "POST_LOCKED") {
          setLocked(true);
          setPost(null);
          return;
        }

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

  const extraEntries = useMemo(() => Object.entries(post?.extra ?? {}), [post]);

  const onUnlock = async () => {
    if (unlocking) return;
    setPwError(null);
    const p = pw.trim();
    if (!p) return setPwError("비밀번호를 입력하세요.");
    setUnlocking(true);
    try {
      const unlocked = await apiGetPost(postId, { password: p });
      if (unlocked.boardKey !== "inquiry") throw new Error("Invalid board");
      setPost(unlocked);
      setLocked(false);
      setPw("");
    } catch (e: any) {
      const code = e instanceof ApiError ? e.code : e?.code;
      if (code === "PASSWORD_INVALID") {
        setPwError("비밀번호가 맞지 않습니다.");
      } else {
        setPwError("열람 중 오류가 발생했습니다.");
      }
    } finally { setUnlocking(false); }
  };

  if (loading && !post && !locked) {
    return (
      <div className="bd-surface-md p-6" role="status" aria-live="polite">
        <div className="text-lg font-semibold">불러오는 중...</div>
        <div className="mt-2 text-sm text-white/70">문의글을 불러오고 있습니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/contact">
          문의로 돌아가기
        </Link>
      </div>
    );
  }

  if (locked && !post) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link className="text-sm text-cyan-200 hover:underline" href="/contact">
            ← 문의 목록
          </Link>
        </div>

        <section className="bd-surface-md p-6">
          <div className="text-lg font-semibold">비공개 문의</div>
          <div className="mt-2 text-sm text-white/70">열람하려면 비밀번호를 입력하세요.</div>

          <form method="post" onSubmit={(event) => { event.preventDefault(); void onUnlock(); }} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="private-post-password">비공개 글 비밀번호</label>
            <input
              id="private-post-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type="password"
              autoComplete="off"
              aria-invalid={Boolean(pwError)}
              aria-describedby={pwError ? "private-post-error" : undefined}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50 sm:max-w-sm"
              placeholder="비밀번호"
            />
            <button
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              type="submit"
              disabled={unlocking}
            >
              {unlocking ? "확인 중..." : "열람"}
            </button>
          </form>

          {pwError ? <div id="private-post-error" role="alert" className="mt-3 text-sm text-red-200">{pwError}</div> : null}
        </section>
      </div>
    );
  }

  if (!post) {
    return <PostDetailError missing={!loadError || loadError.status === 404} onRetry={() => { setLoadError(null); setLocked(false); setLoading(true); setAttempt(value => value + 1); }} backHref="/contact" backLabel="문의로 돌아가기" />;
  }

  const unlocked = !post.isPrivate || !locked;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="text-sm text-cyan-200 hover:underline" href="/contact">
          ← 문의 목록
        </Link>

        <div className="min-w-0 [overflow-wrap:anywhere] text-[12px] text-white/70">
          {post.isPrivate ? "🔒 비공개" : "🌐 공개"} · {POST_TYPE_LABEL[post.type]} · {post.authorName ?? "익명"} · {formatKoreanDate(post.createdAt)}
        </div>
      </div>

      {!unlocked ? null : (
        <>
          <section className="bd-surface-md p-6">
            <h1 className="[overflow-wrap:anywhere] text-2xl font-semibold tracking-tight">{post.title}</h1>
            <PostAffiliateNotice info={post.linkInfo} />
            <LinkifiedText text={post.content} linkInfo={post.linkInfo} className="mt-4 whitespace-pre-wrap text-sm text-white/85" />
          </section>

          {extraEntries.length ? (
            <section className="bd-surface-md p-6">
              <div className="text-sm font-semibold">추가 정보</div>
              <div className="mt-4 space-y-2">
                {extraEntries.map(([k, v]) => (
                  <ExtraRow key={k} label={k} value={v} linkInfo={post.linkInfo} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
