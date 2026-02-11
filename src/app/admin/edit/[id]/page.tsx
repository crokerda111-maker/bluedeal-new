"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getBoardByKey, getTypeOptionsForBoard, POST_TYPE_LABEL, boardKeyToPath } from "../../../../lib/boardConfig";
import type { Post, PostExtra, PostType } from "../../../../lib/postTypes";
import {
  ApiError,
  apiAdminStatus,
  apiDeletePost,
  apiGetPost,
  apiUpdatePost,
} from "../../../../lib/postsClient";

function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function AdminEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // editable
  const [type, setType] = useState<PostType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [lockToAdmin, setLockToAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [extraJson, setExtraJson] = useState("{}");

  const board = post ? getBoardByKey(post.boardKey) : undefined;
  const typeOptions = useMemo(() => getTypeOptionsForBoard(board), [board]);

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

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGetPost(id)
      .then((p) => {
        if (cancelled) return;
        setPost(p);
        setType(p.type);
        setTitle(p.title);
        setContent(p.content);
        setAuthorName(p.authorName ?? "");
        setIsPrivate(Boolean(p.isPrivate));
        setExtraJson(safeJsonStringify(p.extra ?? {}));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(typeof e?.message === "string" ? e.message : "불러오기 실패");
        setPost(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, id]);

  const onSave = async () => {
    setError(null);
    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");

    let extra: PostExtra | null = null;
    try {
      const parsed = JSON.parse(extraJson || "{}");
      if (parsed && typeof parsed === "object") {
        extra = parsed as PostExtra;
      }
    } catch {
      return setError("추가정보 JSON 형식이 올바르지 않습니다.");
    }

    if (isPrivate && post?.boardKey === "inquiry" && !lockToAdmin && password.trim() === "" && post?.isPrivate !== true) {
      // Public -> Private로 바꾸는 경우 최소한의 비번 필요
      return setError("비공개로 변경할 때는 비밀번호 또는 '운영자 비밀번호로 잠금'을 선택하세요.");
    }

    try {
      const updated = await apiUpdatePost(id, {
        type,
        title,
        content,
        authorName: authorName.trim() ? authorName.trim() : null,
        isPrivate,
        lockToAdminPassword: lockToAdmin,
        password: lockToAdmin ? null : password.trim() ? password.trim() : undefined,
        extra,
      } as any);

      setPost(updated);
      alert("저장 완료");
    } catch (e: any) {
      setError(typeof e?.message === "string" ? e.message : "저장 실패");
    }
  };

  const onDelete = async () => {
    if (!confirm("삭제할까요?")) return;
    try {
      await apiDeletePost(id);
      router.push("/admin");
    } catch {
      alert("삭제 실패");
    }
  };

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
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">권한 없음</div>
        <div className="mt-2 text-sm text-white/70">관리자 로그인 후 접근할 수 있습니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/admin">
          관리자 로그인으로 이동
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">불러오는 중...</div>
        <div className="mt-2 text-sm text-white/70">게시글을 불러오고 있습니다.</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/admin">
          관리자 홈
        </Link>
      </div>
    );
  }

  if (!post) {
    const kvMissing = (error && error.includes("KV")) || false;
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">글을 찾을 수 없음</div>
        <div className="mt-2 text-sm text-white/70">
          {kvMissing ? "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다." : error ?? "삭제되었거나 존재하지 않는 글입니다."}
        </div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/admin">
          관리자 홈
        </Link>
      </div>
    );
  }

  const viewHref = `${boardKeyToPath(post.boardKey)}/${post.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link className="text-sm text-cyan-200 hover:underline" href="/admin">
          ← 관리자 홈
        </Link>
        <Link className="text-sm text-cyan-200 hover:underline" href={viewHref}>
          글 보기
        </Link>
      </div>

      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">게시글 수정</h1>
        <div className="mt-2 text-sm text-white/70">
          게시판: <b className="text-white">{board?.title ?? post.boardKey}</b> · 현재 말머리: {POST_TYPE_LABEL[post.type]}
        </div>

        <div className="mt-6 grid gap-4">
          {typeOptions.length > 1 ? (
            <label className="block">
              <div className="text-sm text-white/80">말머리</div>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PostType)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <div className="text-sm text-white/80">제목</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">작성자(닉네임)</div>
            <input
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              placeholder="빈 값이면 익명 처리"
            />
          </label>

          {post.boardKey === "inquiry" ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">비공개 설정(문의)</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    !isPrivate ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  🌐 공개
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    isPrivate ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  🔒 비공개
                </button>
              </div>

              {isPrivate ? (
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={lockToAdmin}
                      onChange={(e) => setLockToAdmin(e.target.checked)}
                    />
                    운영자 비밀번호로 잠금(가격현황 제보용)
                  </label>

                  {!lockToAdmin ? (
                    <label className="block">
                      <div className="text-sm text-white/80">새 비밀번호(선택)</div>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
                        placeholder="입력하면 비밀번호가 변경됩니다. 비워두면 기존 비밀번호 유지"
                      />
                    </label>
                  ) : null}

                  <div className="text-[12px] text-white/50">관리자는 비공개 글을 비밀번호 없이 열람할 수 있습니다.</div>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="block">
            <div className="text-sm text-white/80">추가정보(JSON)</div>
            <textarea
              rows={6}
              value={extraJson}
              onChange={(e) => setExtraJson(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
            />
            <div className="mt-1 text-[12px] text-white/50">예) {"{\n  \"email\": \"...\"\n}"}</div>
          </label>

          {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onSave}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
              type="button"
            >
              저장
            </button>

            <button
              onClick={onDelete}
              className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/15"
              type="button"
            >
              삭제
            </button>

            <Link
              href={viewHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              취소(글 보기)
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
