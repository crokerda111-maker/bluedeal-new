"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_BOARDS, POST_TYPE_LABEL, boardKeyToPath } from "../../lib/boardConfig";
import type { BoardKey, Post } from "../../lib/postTypes";
import { ApiError, apiAdminLogin, apiAdminLogout, apiAdminStatus, apiDeletePost, apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";
import MobilePostList from "../../components/MobilePostList";

function PostActions({ post, deletingId, onDelete }: { post: Post; deletingId: string | null; onDelete: (post: Post) => void }) {
  return <div className="flex flex-wrap gap-2">
    <Link href={`/admin/edit/${post.id}`} aria-label={`${post.title} 수정`} className="inline-flex min-h-11 items-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 hover:bg-white/10">수정</Link>
    <button type="button" aria-label={`${post.title} 삭제`} disabled={deletingId !== null} onClick={() => onDelete(post)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/15 disabled:opacity-60">{deletingId === post.id ? "삭제 중…" : "삭제"}</button>
  </div>;
}

function includesQuery(p: Post, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const hay = [p.title, p.content, p.authorName ?? "", ...Object.values(p.extra ?? {}).map((v) => String(v ?? ""))]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

type BoardResult = {
  boardKey: BoardKey;
  posts: Post[];
  error: { message: string; code?: string } | null;
};

const EMPTY_POSTS: Post[] = [];

async function readBoard(boardKey: BoardKey): Promise<BoardResult> {
  try {
    return { boardKey, posts: await apiListPosts(boardKey, 200), error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "게시글을 불러오지 못했습니다.";
    const code = e instanceof ApiError ? e.code : undefined;
    return { boardKey, posts: [], error: { message, code } };
  }
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState<"login" | "logout" | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const operationInFlight = useRef(false);

  const [boardKey, setBoardKey] = useState<BoardKey>("inquiry");
  const [q, setQ] = useState("");

  const [result, setResult] = useState<BoardResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const activeResult = isAdmin && result?.boardKey === boardKey ? result : null;
  const posts = activeResult?.posts ?? EMPTY_POSTS;
  const loading = isAdmin && (!activeResult || refreshing);
  const error = activeResult?.error ?? null;

  const boards = useMemo(() => ALL_BOARDS, []);

  useEffect(() => {
    let cancelled = false;
    apiAdminStatus()
      .then((ok) => {
        if (cancelled) return;
        setIsAdmin(ok);
      })
      .catch(() => {
        if (cancelled) return;
        setIsAdmin(false);
      })
      .finally(() => {
        if (cancelled) return;
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setReloadAttempt(value => value + 1);
  };

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    readBoard(boardKey).then((next) => {
      if (!cancelled) { setResult(next); setRefreshing(false); }
    });
    return () => { cancelled = true; };
  }, [isAdmin, boardKey, reloadAttempt]);

  const onLogin = async () => {
    if (operationInFlight.current) return;
    setLoginError(null);
    const p = pw.trim();
    if (!p) return setLoginError("비밀번호를 입력하세요.");
    operationInFlight.current = true;
    setAuthBusy("login");
    try {
      await apiAdminLogin(p);
      setIsAdmin(true);
      setPw("");
    } catch (e: any) {
      setLoginError(typeof e?.message === "string" ? e.message : "로그인 실패");
    } finally { operationInFlight.current = false; setAuthBusy(null); }
  };

  const onLogout = async () => {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setAuthBusy("logout");
    setSessionError(null);
    try {
      await apiAdminLogout();
      setIsAdmin(false);
      setResult(null);
      setRefreshing(false);
    } catch { setSessionError("로그아웃하지 못했습니다. 로그인 상태는 유지됩니다. 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { operationInFlight.current = false; setAuthBusy(null); }
  };

  const onDelete = async (post: Post) => {
    if (operationInFlight.current || !confirm(`‘${post.title}’ 글을 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
    operationInFlight.current = true;
    setDeletingId(post.id);
    setSessionError(null);
    try {
      await apiDeletePost(post.id);
      setResult(current => current ? { ...current, posts: current.posts.filter(item => item.id !== post.id) } : current);
      setReloadAttempt(value => value + 1);
    } catch { setSessionError("삭제하지 못했습니다. 글은 목록에 유지됩니다. 로그인 상태와 연결을 확인한 뒤 다시 시도해 주세요."); }
    finally { operationInFlight.current = false; setDeletingId(null); }
  };

  const filtered = useMemo(() => {
    const query = q.trim();
    if (!query) return posts;
    return posts.filter((p) => includesQuery(p, query));
  }, [posts, q]);

  if (checking) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">관리자 확인 중...</div>
        <div className="mt-2 text-sm text-white/70">세션을 확인하고 있습니다.</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <section className="bd-surface-md p-6">
          <h1 className="text-2xl font-semibold tracking-tight">관리자</h1>
          <p className="mt-2 text-sm text-white/70">관리자 비밀번호로 로그인하면 게시글 수정/삭제가 가능합니다.</p>

          <form className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center" aria-busy={authBusy === "login"} onSubmit={(event) => { event.preventDefault(); void onLogin(); }}>
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type="password"
              aria-label="관리자 비밀번호"
              autoComplete="current-password"
              required
              disabled={authBusy !== null}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50 sm:max-w-sm"
              placeholder="관리자 비밀번호"
            />
            <button
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              type="submit"
              disabled={authBusy !== null}
            >
              {authBusy === "login" ? "로그인 중…" : "로그인"}
            </button>
          </form>

          {loginError ? <div role="alert" className="mt-3 text-sm text-red-200">{loginError}</div> : null}

          <div className="mt-6 text-[12px] text-white/50">
            ※ 관리자 비밀번호는 배포 환경변수 <code className="text-white/70">ADMIN_PASSWORD</code>에만 저장됩니다.
          </div>
        </section>
      </div>
    );
  }

  const isKvMissing = error?.code === "KV_NOT_CONFIGURED";
  const emptyText = error ? "게시글을 불러오지 못했습니다. 새로고침을 눌러 다시 시도해 주세요." : q.trim() ? "검색 결과가 없습니다." : "게시글이 없습니다.";

  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">관리자 대시보드</h1>
            <p className="mt-2 text-sm text-white/70">게시글 수정/삭제, 비공개 문의 열람(비번 없이) 등을 할 수 있습니다.</p>
          </div>

          <button
            onClick={onLogout}
            disabled={authBusy !== null || deletingId !== null}
            aria-busy={authBusy === "logout"}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            type="button"
          >
            {authBusy === "logout" ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
        {sessionError ? <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{sessionError}</p> : null}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="text-sm text-white/80">게시판</div>
            <select
              value={boardKey}
              onChange={(e) => setBoardKey(e.target.value as BoardKey)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
            >
              {boards.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-2">
            <div className="text-sm text-white/80">검색</div>
            <input
              value={q}
              maxLength={100}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              placeholder="제목/내용/작성자/추가정보"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/it/write?type=pick"
            className="rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-300/15"
          >
            곰선생 추천픽 작성
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div role="status" className="text-xs text-white/65">총 {posts.length}개 중 {filtered.length}개 표시</div>
          <button
            onClick={refresh}
            disabled={loading || authBusy !== null}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            type="button"
          >
            {refreshing ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className={`rounded-xl border p-3 text-sm ${
            isKvMissing ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {isKvMissing ? "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다." : `불러오기 오류: ${error.message}`}
        </div>
      ) : null}

      <MobilePostList posts={filtered} hrefPrefix={boardKeyToPath(boardKey)} loading={loading} emptyText={emptyText} showVisibility renderActions={post => <PostActions post={post} deletingId={deletingId} onDelete={onDelete} />} />
      <section className="bd-surface-md hidden overflow-x-auto md:block" aria-label="관리자 게시글 목록" aria-busy={loading}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left">상태</th>
              <th className="px-4 py-3 text-left">제목</th>
              <th className="px-4 py-3 text-left">작성자</th>
              <th className="px-4 py-3 text-left">작성일</th>
              <th className="px-4 py-3 text-left">동작</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/60">
                  불러오는 중...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/60">
                  {emptyText}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white/70">
                    {p.isPrivate ? "🔒" : "🌐"} · {POST_TYPE_LABEL[p.type]}
                  </td>
                  <td className="px-4 py-3">
                    <Link className="text-white/85 hover:underline" href={`${boardKeyToPath(p.boardKey)}/${p.id}`}>
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70">{p.authorName ?? "익명"}</td>
                  <td className="px-4 py-3 text-white/70">{formatKoreanDate(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <PostActions post={p} deletingId={deletingId} onDelete={onDelete} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

    </div>
  );
}
