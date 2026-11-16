"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState, type CSSProperties } from "react";
import {
  getCommunityBoard,
  getTypeOptionsForBoard,
  type FieldDef,
} from "../../../../lib/boardConfig";
import type { PostExtra, PostType } from "../../../../lib/postTypes";
import { apiCreatePost } from "../../../../lib/postsClient";
import { setNickname } from "../../../../lib/profile";
import { useNickname } from "../../../../lib/useNickname";

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const base =
    "mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50";
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
          aria-describedby={def.help ? `${id}_help` : undefined}
          type={def.type === "number" ? "number" : def.type === "url" ? "url" : "text"}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      )}

      {def.help ? <div id={`${id}_help`} className="mt-1 text-[12px] text-white/50">{def.help}</div> : null}
    </label>
  );
}

export default function CommunityWritePage({ params }: { params: Promise<{ board: string }> }) {
  const { board: boardSlug } = use(params);
  return <CommunityWrite key={boardSlug} boardSlug={boardSlug} />;
}

function CommunityWrite({ boardSlug }: { boardSlug: string }) {
  const router = useRouter();
  const board = getCommunityBoard(boardSlug);
  const typeOptions = useMemo(() => getTypeOptionsForBoard(board), [board]);

  const [type, setType] = useState<PostType>(typeOptions[0]?.value ?? "general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const authorName = useNickname();
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requiredExtraKeys = useMemo(() => {
    return (board?.extraFields ?? []).filter((f) => f.required).map((f) => f.key);
  }, [board]);

  const changeNick = () => {
    const next = prompt("닉네임을 입력하세요 (최대 20자)", authorName === "게스트" ? "" : authorName);
    if (!next) return;
    setNickname(next);
  };

  if (!board) {
    return (
      <div className="bd-surface-md p-6">
        <div className="text-lg font-semibold">없는 게시판</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/community">
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  const onSubmit = async () => {
    if (saving) return;
    setError(null);
    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");

    for (const k of requiredExtraKeys) {
      if (!String(extra[k] ?? "").trim()) return setError(`${board.extraFields?.find((field) => field.key === k)?.label ?? "필수 항목"}을 입력하거나 선택하세요.`);
    }

    setSaving(true);
    try {
      const extraPayload: PostExtra = {};
      for (const [k, v] of Object.entries(extra)) {
        if (v === "") continue;
        extraPayload[k] = v;
      }

      const post = await apiCreatePost({
        boardKey: board.key,
        type,
        title,
        content,
        authorName: authorName || "게스트",
        extra: extraPayload,
        isPrivate: false,
        password: null,
      });

      router.push(`/community/${board.slug}/${post.id}`);
    } catch {
      setError("저장하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/60">{board.title}</div>
          <h1 className="text-2xl font-semibold tracking-tight">글쓰기</h1>
        </div>
        <Link className="text-sm text-cyan-200 hover:underline" href={`/community/${board.slug}`}>
          목록으로
        </Link>
      </div>

      <form className="bd-surface-md p-4 sm:p-6" aria-busy={saving} onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
        {board.writeHint ? <div className="mb-4 text-sm text-white/70">{board.writeHint}</div> : null}

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
          {typeOptions.length > 1 ? (
            <fieldset>
              <legend className="text-sm text-white/80">말머리</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {typeOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setType(o.value)}
                    type="button"
                    aria-pressed={type === o.value}
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
            </fieldset>
          ) : null}

          {/* 제목 */}
          <label className="block">
            <div className="text-sm text-white/80">제목</div>
            <input
              required
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
            />
          </label>

          {(board.extraFields ?? []).map((f) => (
            <Field
              key={f.key}
              def={f}
              value={extra[f.key] ?? ""}
              onChange={(v) => setExtra((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}

          {/* 본문은 게시판별 추가정보를 입력한 뒤 마지막에 작성 */}
          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              required
              rows={10}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="본문을 입력하세요"
            />
          </label>

          {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "등록"}
            </button>

            <Link
              href={`/community/${board.slug}`}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              취소
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
