"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IT_BOARD, POST_TYPE_OPTIONS, type FieldDef } from "../../../lib/boardConfig";
import type { PostExtra, PostType } from "../../../lib/postTypes";
import { apiCreatePost } from "../../../lib/postsClient";
import { getNickname, setNickname } from "../../../lib/profile";

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const base =
    "mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50";
  const id = `f_${def.key}`;

  return (
    <label className="block">
      <div className="text-sm text-white/80">
        {def.label}
        {def.required ? <span className="text-cyan-200"> *</span> : null}
      </div>

      {def.type === "textarea" ? (
        <textarea
          id={id}
          rows={4}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      ) : def.type === "select" ? (
        <select id={id} className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택</option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={def.type === "number" ? "number" : def.type === "url" ? "url" : "text"}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      )}

      {def.help ? <div className="mt-1 text-[12px] text-white/50">{def.help}</div> : null}
    </label>
  );
}

export default function ITWritePage() {
  const router = useRouter();

  const [type, setType] = useState<PostType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("게스트");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAuthorName(getNickname("게스트"));
  }, []);

  const requiredExtraKeys = useMemo(() => {
    return (IT_BOARD.extraFields ?? []).filter((f) => f.required).map((f) => f.key);
  }, []);

  const changeNick = () => {
    const next = prompt("닉네임을 입력하세요 (최대 20자)", authorName === "게스트" ? "" : authorName);
    if (!next) return;
    setNickname(next);
    setAuthorName(getNickname("게스트"));
  };

  const onSubmit = async () => {
    setError(null);
    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");

    for (const k of requiredExtraKeys) {
      if (!String(extra[k] ?? "").trim()) return setError(`'${k}' 항목을 입력/선택하세요.`);
    }

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

      router.push(`/it/${post.id}`);
    } catch {
      setError("저장 중 오류가 발생했습니다.");
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

      <section className="bd-surface-md p-6">
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
            <button
              onClick={changeNick}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
              type="button"
            >
              닉네임 변경
            </button>
          </div>

          {/* 말머리 */}
          <label className="block">
            <div className="text-sm text-white/80">말머리</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {POST_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setType(o.value)}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    type === o.value
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                  title={o.hint}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </label>

          {/* 제목/본문 */}
          <label className="block">
            <div className="text-sm text-white/80">제목</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              rows={10}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="본문을 입력하세요"
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

          {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

          <div className="flex items-center gap-2">
            <button
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "등록"}
            </button>

            <Link
              href="/it"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              취소
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
