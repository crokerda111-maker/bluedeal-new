"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  getInquiryBoard,
  inquiryVisibilityToBoardKey,
  POST_TYPE_OPTIONS,
  type FieldDef,
} from "../../../../lib/boardConfig";
import type { InquiryVisibility, PostExtra, PostType } from "../../../../lib/postTypes";
import { createLocalPost } from "../../../../lib/postStorage";

function Field({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const base =
    "mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50";

  return (
    <label className="block">
      <div className="text-sm text-white/80">
        {def.label}
        {def.required ? <span className="text-cyan-200"> *</span> : null}
      </div>
      {def.type === "textarea" ? (
        <textarea
          rows={4}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
        />
      ) : def.type === "select" ? (
        <select className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">선택</option>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
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

export default function InquiryWritePage({ params }: { params: { visibility: string } }) {
  const router = useRouter();
  const vis = params.visibility as InquiryVisibility;
  const board = getInquiryBoard(vis);

  const [type, setType] = useState<PostType>("general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [password, setPassword] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const requiredExtraKeys = useMemo(() => {
    return (board?.extraFields ?? []).filter((f) => f.required).map((f) => f.key);
  }, [board]);

  if (!board) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-lg font-semibold">없는 게시판</div>
        <Link className="mt-4 inline-block text-sm text-cyan-200 hover:underline" href="/contact">
          문의로 돌아가기
        </Link>
      </div>
    );
  }

  const isPrivateBoard = vis === "private";

  const onSubmit = async () => {
    setError(null);

    if (!title.trim()) return setError("제목을 입력해 주세요.");
    if (!content.trim()) return setError("내용을 입력해 주세요.");

    for (const k of requiredExtraKeys) {
      if (!String(extra[k] ?? "").trim()) {
        const label = board.extraFields?.find((f) => f.key === k)?.label ?? k;
        return setError(`${label} 항목이 필요합니다.`);
      }
    }

    if (isPrivateBoard && !password.trim()) {
      return setError("비공개 문의는 비밀번호가 필요합니다.");
    }

    setSaving(true);
    try {
      const post = await createLocalPost({
        boardKey: inquiryVisibilityToBoardKey(vis),
        type,
        title,
        content,
        authorName: authorName || undefined,
        isPrivate: isPrivateBoard,
        password: isPrivateBoard ? password : undefined,
        extra: extra as PostExtra,
      });

      router.push(`/contact/${board.slug}/${post.id}`);
    } catch (e: any) {
      setError(e?.message ?? "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] text-white/60">{board.title}</div>
            <h1 className="text-2xl font-semibold tracking-tight">글쓰기</h1>
          </div>
          <Link className="text-sm text-cyan-200 hover:underline" href={`/contact/${board.slug}`}>
            ← 목록
          </Link>
        </div>
        {board.writeHint ? <p className="mt-2 text-sm text-white/70">{board.writeHint}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="grid gap-4">
          <label className="block">
            <div className="text-sm text-white/80">말머리</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {POST_TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setType(o.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    type === o.value
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </label>

          <label className="block">
            <div className="text-sm text-white/80">작성자(선택)</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="닉네임"
            />
          </label>

          {isPrivateBoard ? (
            <label className="block">
              <div className="text-sm text-white/80">
                비밀번호 <span className="text-cyan-200">*</span>
              </div>
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비공개 글 열람용"
              />
              <div className="mt-2 text-[12px] text-white/50">비공개 글은 비밀번호를 아는 사람만 열람할 수 있습니다.</div>
            </label>
          ) : null}

          <label className="block">
            <div className="text-sm text-white/80">
              제목 <span className="text-cyan-200">*</span>
            </div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력"
            />
          </label>

          {board.extraFields?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {board.extraFields.map((f) => (
                <Field
                  key={f.key}
                  def={f}
                  value={String(extra[f.key] ?? "")}
                  onChange={(v) => setExtra((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
            </div>
          ) : null}

          <label className="block">
            <div className="text-sm text-white/80">
              내용 <span className="text-cyan-200">*</span>
            </div>
            <textarea
              rows={10}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="본문을 입력"
            />
            <div className="mt-2 text-[12px] text-white/50">
              개인정보(주민번호/계좌/카드 등)는 적지 마세요.
            </div>
          </label>

          {error ? (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {saving ? "저장 중..." : "등록"}
            </button>
            <Link
              href={`/contact/${board.slug}`}
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
