"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import MemberWriteGate, { useWriterNickname, WriterNicknameEditor } from "./MemberWriteGate";
import PostLoadError from "./PostLoadError";
import { issuePostTitle, POST_LIMITS } from "../lib/postInput";
import { formatKoreanDate } from "../lib/postStorage";
import type { Post } from "../lib/postTypes";
import { apiCreatePost, apiListPosts, postErrorMessage } from "../lib/postsClient";

function IssueWriterIdentity() {
  const name = useWriterNickname();
  return <div className="mb-3 flex items-center justify-between gap-3">
    <input type="hidden" name="authorName" value={name} />
    <span className="min-w-0 text-sm text-white/80 [overflow-wrap:anywhere]">{name}</span>
    <WriterNicknameEditor />
  </div>;
}

const fieldClass = "min-w-0 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-base text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-cyan-300";

export default function IssueFeed({ title, description }: { title: string; description: string }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; status?: string }>({});
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    apiListPosts("issue")
      .then(rows => { if (active) setPosts(rows); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || submitting.current) return;

    submitting.current = true;
    setSaving(true);
    setFeedback({});
    try {
      const authorName = new FormData(event.currentTarget).get("authorName")?.toString();
      const post = await apiCreatePost({ boardKey: "issue", type: "general", content, authorName });
      setRecentPosts(current => [post, ...current]);
      setDraft("");
      setQuery("");
      setFeedback({ status: "이슈를 등록했습니다." });
      input.current?.focus();
    } catch (error) {
      setFeedback({ error: postErrorMessage(error) });
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  const recentIds = new Set(recentPosts.map(post => post.id));
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePosts = [...recentPosts, ...(posts ?? []).filter(post => !recentIds.has(post.id))]
    .filter(post => !normalizedQuery || [post.title, post.content, post.authorName ?? "",
      ...Object.values(post.extra ?? {}).map(value => String(value ?? "")),
    ].some(value => value.toLowerCase().includes(normalizedQuery)));

  return (
    <div className="space-y-4">
      <section className="bd-surface-md p-4 sm:p-6" aria-labelledby="issue-title">
        <h1 id="issue-title" className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-white/75">{description}</p>
        <div className="mt-4">
          <MemberWriteGate nextPath="/community/issue">
            <form aria-busy={saving} onSubmit={submit}>
              <IssueWriterIdentity />
              <label htmlFor="issue-line" className="sr-only">한 줄 이슈</label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input
                  ref={input}
                  id="issue-line"
                  className={fieldClass}
                  type="text"
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  maxLength={POST_LIMITS.issueLine}
                  required
                  readOnly={saving}
                  enterKeyHint="send"
                  placeholder="제품·버전, 증상 또는 해결 방법"
                  aria-describedby="issue-line-limit"
                />
                <button
                  type="submit"
                  disabled={saving || !draft.trim()}
                  className="min-h-11 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-60"
                >
                  {saving ? "등록 중" : "등록"}
                </button>
              </div>
              <div className="mt-2 flex items-start justify-between gap-2 text-xs">
                <div>
                  {feedback.error ? <p role="alert" className="text-red-200">{feedback.error}</p> : null}
                  <p role="status" className="text-cyan-200">{feedback.status}</p>
                </div>
                <p id="issue-line-limit" className="shrink-0 text-white/70">{draft.length}/{POST_LIMITS.issueLine}자</p>
              </div>
            </form>
          </MemberWriteGate>
        </div>
      </section>

      <section className="bd-surface-md" aria-labelledby="issue-list">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
          <h2 id="issue-list" className="font-semibold">최근 이슈</h2>
          <input
            type="search"
            aria-label="이슈 검색"
            className={`${fieldClass} w-full sm:w-64`}
            value={query}
            onChange={event => setQuery(event.target.value)}
            maxLength={100}
            placeholder="내용·닉네임 검색"
          />
        </div>

        {loadError ? <div className="p-4"><PostLoadError onRetry={() => {
          setLoadError(false);
          setAttempt(count => count + 1);
        }} /></div> : null}
        {!posts && !loadError ? <p role="status" className="p-5 text-sm text-white/70">이슈를 불러오는 중입니다.</p> : null}
        {posts && !visiblePosts.length ? (
          <p className="p-5 text-sm text-white/70">{normalizedQuery ? "검색 결과가 없습니다." : "아직 등록된 이슈가 없습니다."}</p>
        ) : null}
        {visiblePosts.length ? (
          <ul aria-label="이슈 목록" className="divide-y divide-white/10">
            {visiblePosts.map(post => {
              const isLine = !post.isPrivate && post.title === issuePostTitle(post.content);
              return (
                <li key={post.id} className="px-4 py-3.5 sm:px-6">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-white/65">
                    <span className="font-semibold text-white/85 [overflow-wrap:anywhere]">{post.authorName ?? "익명"}</span>
                    <time dateTime={post.createdAt}>{formatKoreanDate(post.createdAt)}</time>
                    <Link className="shrink-0 text-xs text-cyan-200 hover:underline focus-visible:outline-2 focus-visible:outline-cyan-300" href={`/community/issue/${encodeURIComponent(post.id)}`}>
                      상세<span className="sr-only"> 정보</span>
                    </Link>
                  </div>
                  {!isLine ? <p className="mt-1.5 font-semibold [overflow-wrap:anywhere]">{post.title}</p> : null}
                  {post.isPrivate ? <p className="mt-1 text-sm text-white/70">비공개 글</p> : (
                    <p className={`mt-1 text-sm leading-relaxed text-white/90 [overflow-wrap:anywhere]${isLine ? "" : " line-clamp-2"}`}>{post.content}</p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
