"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { IT_BOARD, type FieldDef } from "../../../lib/boardConfig";
import type { PostExtra, PostType } from "../../../lib/postTypes";
import { apiAdminStatus, apiCreatePost, postErrorMessage } from "../../../lib/postsClient";
import { POST_LIMITS } from "../../../lib/postInput";
import NicknameEditor from "../../../components/NicknameEditor";
import PostCreatedNotice from "../../../components/PostCreatedNotice";
import { useNickname } from "../../../lib/useNickname";

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const base =
    "mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50";
  const id = `f_${def.key}`;
  const optionStyle: CSSProperties = { color: "#000" };

  return (
    <label className="block">
      <div className="text-sm text-white/80">
        {def.label}
        {def.required ? <span className="text-cyan-200"> *</span> : null}
      </div>

      {def.type === "textarea" ? (
        <textarea
          id={id}
          required={def.required}
          maxLength={POST_LIMITS.extraValue}
          aria-describedby={def.help ? `${id}_help` : undefined}
          rows={4}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      ) : def.type === "select" ? (
        <select id={id} required={def.required} aria-describedby={def.help ? `${id}_help` : undefined} className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="" style={optionStyle}>
            선택
          </option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value} style={optionStyle}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          required={def.required}
          maxLength={def.type === "number" ? undefined : POST_LIMITS.extraValue}
          aria-describedby={def.help ? `${id}_help` : undefined}
          type={def.type === "number" ? "number" : def.type === "url" ? "url" : "text"}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      )}

      {def.help ? <div id={`${id}_help`} className="mt-1 text-[12px] text-white/70">{def.help}</div> : null}
    </label>
  );
}

export default function ITWritePage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const router = useRouter();
  const requestedType = use(searchParams).type;

  const [type, setType] = useState<PostType>("news");
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const authorName = useNickname();
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdHref, setCreatedHref] = useState<string | null>(null);
  const submissionState = useRef<"idle" | "saving" | "submitted">("idle");

  useEffect(() => {
    apiAdminStatus()
      .then((admin) => {
        setIsAdmin(admin);
        setType((current) => !admin ? "news" : requestedType === "pick" ? "pick" : current);
      })
      .catch(() => {
        setIsAdmin(false);
        setType("news");
      });
  }, [requestedType]);

  const requiredExtraKeys = useMemo(() => {
    return (IT_BOARD.extraFields ?? []).filter((f) => f.required).map((f) => f.key);
  }, []);

  const onSubmit = async () => {
    if (submissionState.current !== "idle") return;
    setError(null);
    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");

    for (const k of requiredExtraKeys) {
      if (!String(extra[k] ?? "").trim()) return setError(`${IT_BOARD.extraFields?.find((field) => field.key === k)?.label ?? "필수 항목"}을 입력하거나 선택하세요.`);
    }

    submissionState.current = "saving";
    setSaving(true);
    try {
      const extraPayload: PostExtra = {};
      for (const [k, v] of Object.entries(extra)) {
        if (v === "") continue;
        extraPayload[k] = v;
      }

      const post = await apiCreatePost({
        boardKey: "it",
        type,
        title,
        content,
        authorName: authorName || "게스트",
        extra: extraPayload,
        isPrivate: false,
        password: null,
      });

      const href = `/it/${post.id}`;
      submissionState.current = "submitted";
      setCreatedHref(href);
      router.push(href);
    } catch (error) {
      if (submissionState.current !== "submitted") {
        submissionState.current = "idle";
        setError(postErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/60">{IT_BOARD.title}</div>
          <h1 className="text-2xl font-semibold tracking-tight">글쓰기</h1>
        </div>
        <Link className="text-sm text-cyan-200 hover:underline" href="/it">
          목록으로
        </Link>
      </div>

      <form className="bd-surface-md p-4 sm:p-6" aria-busy={saving} onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
        {IT_BOARD.writeHint ? <div className="mb-4 text-sm text-white/70">{IT_BOARD.writeHint}</div> : null}

        <div className="grid gap-4">
          {/* 작성자 */}
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <label className="block w-full md:max-w-sm">
              <div className="text-sm text-white/80">작성자(닉네임)</div>
              <input
                value={authorName}
                readOnly
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 outline-none"
              />
            </label>
            <NicknameEditor />
          </div>

          <fieldset>
            <legend className="text-sm text-white/80">분류</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setType("news")}
                aria-pressed={type === "news"}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  type === "news"
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                뉴스
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setType("pick")}
                  aria-pressed={type === "pick"}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    type === "pick"
                      ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  곰선생 추천픽
                </button>
              ) : null}
            </div>
            {!isAdmin ? <div className="mt-1 text-[12px] text-white/70">곰선생 추천픽은 관리자 로그인 후 작성할 수 있습니다.</div> : null}
          </fieldset>

          {/* 제목 */}
          <label className="block">
            <div className="text-sm text-white/80">제목</div>
            <input
              required
              maxLength={POST_LIMITS.title}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
            />
          </label>

          {(IT_BOARD.extraFields ?? []).map((f) => (
            <Field
              key={f.key}
              def={f}
              value={extra[f.key] ?? ""}
              onChange={(v) => setExtra((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}

          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              required
              maxLength={POST_LIMITS.content}
              rows={10}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="본문을 입력하세요"
            />
          </label>

          {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
          <PostCreatedNotice href={createdHref} writeHref="/it/write" />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || createdHref !== null}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {createdHref ? "등록 완료" : saving ? "저장 중..." : "등록"}
            </button>

            <Link
              href="/it"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {createdHref ? "목록으로" : "취소"}
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
