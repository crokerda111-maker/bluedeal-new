"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { getBoardByKey, getTypeOptionsForBoard, POST_TYPE_LABEL, boardKeyToPath } from "../../../../lib/boardConfig";
import type { Post, PostExtra, PostType } from "../../../../lib/postTypes";
import {
  ApiError,
  apiAdminStatus,
  apiDeletePost,
  apiGetPost,
  apiUpdatePost,
  postErrorMessage,
  type UpdatePostPayload,
} from "../../../../lib/postsClient";
import { POST_LIMITS, PostValidationError, validatePostFields } from "../../../../lib/postInput";

function safeJsonStringify(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export default function AdminEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AdminEdit key={id} id={id} />;
}

function AdminEdit({ id }: { id: string }) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const actionInFlight = useRef(false);

  // editable
  const [type, setType] = useState<PostType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicConfirmed, setPublicConfirmed] = useState(false);
  const [lockToAdmin, setLockToAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [extraJson, setExtraJson] = useState("{}");

  const board = post ? getBoardByKey(post.boardKey) : undefined;
  const typeOptions = useMemo(() => getTypeOptionsForBoard(board), [board]);

  useEffect(() => {
    let cancelled = false;
    apiAdminStatus()
      .then((ok) => {
        if (cancelled) return;
        setIsAdmin(ok);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthError(true);
      })
      .finally(() => {
        if (cancelled) return;
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authAttempt]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

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
      .catch((e: unknown) => {
        if (cancelled) return;
        setMissing(e instanceof ApiError && e.status === 404);
        setError("게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setPost(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, id, loadAttempt]);

  const onSave = async () => {
    if (actionInFlight.current || !post) return;
    setError(null);
    setNotice(null);
    setSessionExpired(false);

    let extra: PostExtra | null = null;
    try {
      const parsed = JSON.parse(extraJson || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return setError("추가정보는 중괄호로 감싼 항목과 값으로 입력하세요.");
      extra = parsed as PostExtra;
    } catch {
      return setError("추가정보 JSON 형식이 올바르지 않습니다.");
    }

    if (isPrivate && post?.boardKey === "inquiry" && !lockToAdmin && password.trim() === "" && post?.isPrivate !== true) {
      // Public -> Private로 바꾸는 경우 최소한의 비번 필요
      return setError("비공개로 변경할 때는 비밀번호 또는 '운영자 비밀번호로 잠금'을 선택하세요.");
    }

    const patch: UpdatePostPayload = {};
    if (type !== post.type) patch.type = type;
    if (title !== post.title) patch.title = title;
    if (content !== post.content) patch.content = content;
    if (authorName.trim() !== (post.authorName ?? "")) patch.authorName = authorName.trim() || null;
    if (isPrivate !== Boolean(post.isPrivate)) patch.isPrivate = isPrivate;
    if (JSON.stringify(extra) !== JSON.stringify(post.extra ?? {})) patch.extra = extra;
    if (isPrivate && lockToAdmin) patch.lockToAdminPassword = true;
    else if (isPrivate && password.trim()) patch.password = password.trim();
    try { validatePostFields(patch, { partial: true, current: post }); }
    catch (error) { return setError(error instanceof PostValidationError ? error.message : "입력한 내용을 확인해 주세요."); }
    if (!Object.keys(patch).length) return setNotice("변경한 내용이 없습니다.");
    if (post.isPrivate && !isPrivate && !publicConfirmed) return setError("공개되는 정보를 확인한 뒤 공개 동의 항목을 선택해 주세요.");

    actionInFlight.current = true;
    setPending("save");
    try {
      const updated = await apiUpdatePost(id, patch);

      setPost(updated);
      setTitle(updated.title);
      setContent(updated.content);
      setAuthorName(updated.authorName ?? "");
      setIsPrivate(Boolean(updated.isPrivate));
      setPublicConfirmed(false);
      setExtraJson(safeJsonStringify(updated.extra ?? {}));
      setPassword("");
      setLockToAdmin(false);
      setNotice("저장했습니다. 수정한 내용이 반영되었습니다.");
    } catch (error) {
      const expired = error instanceof ApiError && [401, 403].includes(error.status ?? 0);
      setSessionExpired(expired);
      setError(expired
        ? "관리자 로그인이 필요합니다. 새 탭에서 로그인한 뒤 다시 저장해 주세요. 입력한 내용은 유지됩니다."
        : postErrorMessage(error, "수정하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요."));
    } finally { actionInFlight.current = false; setPending(null); }
  };

  const onDelete = async () => {
    if (actionInFlight.current || !post || !confirm(`‘${post.title}’ 글을 영구 삭제할까요? 삭제 후에는 복구할 수 없습니다.`)) return;
    actionInFlight.current = true;
    setPending("delete");
    setError(null);
    setNotice(null);
    setSessionExpired(false);
    try {
      await apiDeletePost(id);
      router.push("/admin");
    } catch (error) {
      setSessionExpired(error instanceof ApiError && [401, 403].includes(error.status ?? 0));
      setError("삭제하지 못했습니다. 글은 화면에 유지됩니다. 로그인 상태와 연결을 확인한 뒤 다시 시도해 주세요.");
    }
    finally { actionInFlight.current = false; setPending(null); }
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
    if (authError) return (
      <section className="bd-surface-md p-6" role="alert">
        <h1 className="text-lg font-semibold">관리자 상태를 확인하지 못했습니다</h1>
        <p className="mt-2 text-sm text-white/75">연결을 확인한 뒤 다시 시도해 주세요.</p>
        <button type="button" className="mt-4 rounded-xl border border-white/20 px-4 py-2" onClick={() => { setAuthError(false); setChecking(true); setAuthAttempt(value => value + 1); }}>다시 확인</button>
      </section>
    );
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
    return (
      <div className="bd-surface-md p-6" role="alert">
        <h1 className="text-lg font-semibold">{missing ? "글을 찾을 수 없습니다" : "게시글을 불러오지 못했습니다"}</h1>
        <p className="mt-2 text-sm text-white/75">{missing ? "삭제되었거나 존재하지 않는 글입니다." : error}</p>
        {!missing ? <button type="button" className="mt-4 mr-4 rounded-xl border border-white/20 px-4 py-2" onClick={() => { setLoading(true); setError(null); setLoadAttempt(value => value + 1); }}>다시 불러오기</button> : null}
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

      <form className="bd-surface-md p-4 sm:p-6" aria-busy={pending !== null} onSubmit={(event) => { event.preventDefault(); void onSave(); }}>
        <h1 className="text-2xl font-semibold tracking-tight">게시글 수정</h1>
        <div className="mt-2 text-sm text-white/70">
          게시판: <b className="text-white">{board?.title ?? post.boardKey}</b> · 현재 말머리: {POST_TYPE_LABEL[post.type]}
        </div>

        <fieldset disabled={pending !== null} className="mt-6 grid gap-4 min-w-0">
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
              required
              maxLength={Math.max(POST_LIMITS.title, post.title.length)}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              rows={12}
              required
              maxLength={Math.max(POST_LIMITS.content, post.content.length)}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">작성자(닉네임)</div>
            <input
              value={authorName}
              maxLength={Math.max(POST_LIMITS.authorName, (post.authorName ?? "").length)}
              onChange={(e) => setAuthorName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
              placeholder="빈 값이면 익명 처리"
            />
          </label>

          {post.boardKey === "inquiry" ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">비공개 설정(문의)</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setIsPrivate(false); setPublicConfirmed(false); }}
                  aria-pressed={!isPrivate}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    !isPrivate ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  🌐 공개
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPrivate(true); setPublicConfirmed(false); }}
                  aria-pressed={isPrivate}
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
                        autoComplete="new-password"
                        maxLength={POST_LIMITS.password}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
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
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-[12px] text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
            />
            <div className="mt-1 text-[12px] text-white/50">예) {"{\n  \"email\": \"...\"\n}"}</div>
          </label>

          {post.isPrivate && !isPrivate ? <div className="space-y-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            <p id="public-change-warning">공개로 변경하면 본문과 추가정보(이메일 등)가 누구에게나 공개됩니다.</p>
            <label className="flex items-start gap-2">
              <input type="checkbox" required checked={publicConfirmed} onChange={event => setPublicConfirmed(event.target.checked)} aria-describedby="public-change-warning" className="mt-1" />
              본문과 추가정보가 공개됨을 확인했습니다
            </label>
            <button type="button" className="min-h-11 rounded-lg border border-amber-300/30 px-3 py-2" onClick={() => { setIsPrivate(true); setPublicConfirmed(false); setError(null); }}>공개 전환 취소</button>
          </div> : null}
          {notice ? <p role="status" className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">{notice}</p> : null}
          {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}{sessionExpired ? <Link href="/admin" target="_blank" rel="noopener" className="mt-2 block underline">새 탭에서 관리자 로그인 확인</Link> : null}</div> : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              type="submit"
            >
              {pending === "save" ? "저장 중…" : "저장"}
            </button>

            <button
              onClick={onDelete}
              className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/15"
              type="button"
            >
              {pending === "delete" ? "삭제 중…" : "삭제"}
            </button>

            <Link
              href={viewHref}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              취소(글 보기)
            </Link>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
