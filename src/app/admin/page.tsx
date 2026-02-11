"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ALL_BOARDS, POST_TYPE_LABEL, boardKeyToPath } from "../../lib/boardConfig";
import type { BoardKey, Post } from "../../lib/postTypes";
import { ApiError, apiAdminLogin, apiAdminLogout, apiAdminStatus, apiDeletePost, apiListPosts } from "../../lib/postsClient";
import { formatKoreanDate } from "../../lib/postStorage";

function includesQuery(p: Post, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const hay = [p.title, p.content, p.authorName ?? "", ...Object.values(p.extra ?? {}).map((v) => String(v ?? ""))]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [pw, setPw] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const [boardKey, setBoardKey] = useState<BoardKey>("inquiry");
  const [q, setQ] = useState("");

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const boards = useMemo(() => ALL_BOARDS, []);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
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

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiListPosts(boardKey, 200);
      setPosts(list);
    } catch (e: any) {
      const msg = typeof e?.message === "string" ? e.message : "게시글을 불러오지 못했습니다.";
      const code = e instanceof ApiError ? e.code : e?.code;
      setError({ message: msg, code });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
  }, [isAdmin, boardKey]);

  const onLogin = async () => {
    setLoginError(null);
    const p = pw.trim();
    if (!p) return setLoginError("비밀번호를 입력하세요.");
    try {
      await apiAdminLogin(p);
      setIsAdmin(true);
      setPw("");
    } catch (e: any) {
      setLoginError(typeof e?.message === "string" ? e.message : "로그인 실패");
    }
  };

  const onLogout = async () => {
    try {
      await apiAdminLogout();
    } finally {
      setIsAdmin(false);
      setPosts([]);
    }
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

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              type="password"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50 sm:max-w-sm"
              placeholder="관리자 비밀번호"
            />
            <button
              onClick={onLogin}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
              type="button"
            >
              로그인
            </button>
          </div>

          {loginError ? <div className="mt-3 text-sm text-red-200">{loginError}</div> : null}

          <div className="mt-6 text-[12px] text-white/50">
            ※ 비밀번호는 서버 환경변수 <code className="text-white/70">ADMIN_PASSWORD</code>로 변경할 수 있습니다. (기본값: dkrdjek2)
          </div>
        </section>
      </div>
    );
  }

  const isKvMissing = error?.code === "KV_NOT_CONFIGURED";

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
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            type="button"
          >
            로그아웃
          </button>
        </div>

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
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              placeholder="제목/내용/작성자/추가정보"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[12px] text-white/50">총 {filtered.length}개</div>
          <button
            onClick={refresh}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            type="button"
          >
            새로고침
          </button>
        </div>
      </section>

      {error ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            isKvMissing ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          {isKvMissing ? "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다." : `불러오기 오류: ${error.message}`}
        </div>
      ) : null}

      <section className="bd-surface-md">
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
                  게시글이 없습니다.
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
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/edit/${p.id}`}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/10"
                      >
                        수정
                      </Link>
                      <button
                        type="button"
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-200 hover:bg-red-500/15"
                        onClick={async () => {
                          if (!confirm("삭제할까요?")) return;
                          try {
                            await apiDeletePost(p.id);
                            await refresh();
                          } catch {
                            alert("삭제 실패");
                          }
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="bd-surface-md p-6 text-sm text-white/70">
        <div className="font-semibold text-white">메모</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>이 페이지는 사이트 내 링크를 제공하지 않습니다. (URL로 직접 접근)</li>
          <li>비공개 문의는 관리자 세션이면 비밀번호 없이 열람됩니다.</li>
          <li>비밀번호 변경은 Vercel 환경변수 <code className="text-white/70">ADMIN_PASSWORD</code>로 관리합니다.</li>
        </ul>
      </section>
    </div>
  );
}
