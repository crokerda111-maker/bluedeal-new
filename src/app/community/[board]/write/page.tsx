"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  getCommunityBoard,
  POST_TYPE_OPTIONS,
  type ExtraField,
} from "../../../../lib/boardConfig";
import { apiCreatePost } from "../../../../lib/apiClient";
import { useAuth } from "../../../_components/AuthProvider";

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-white/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30 focus:border-white/20"
      />
    </label>
  );
}

export default function CommunityWritePage({
  params,
}: {
  params: { board: string };
}) {
  const board = getCommunityBoard(params.board);
  const router = useRouter();
  const { user, loading } = useAuth();

  const [type, setType] = useState(board?.defaultType ?? "general");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraFields: ExtraField[] = useMemo(() => board?.extraFields ?? [], [board]);

  if (!board) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white">
        존재하지 않는 게시판입니다.
      </div>
    );
  }

  if (!loading && !user) {
    const returnTo = `/community/${board.key}/write`;
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white">
        <div className="text-lg font-semibold">로그인이 필요합니다</div>
        <p className="mt-2 text-white/70">글쓰기는 로그인 후 사용할 수 있어요.</p>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/account?returnTo=${encodeURIComponent(returnTo)}`}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            로그인/회원가입
          </Link>
          <Link
            href={`/community/${board.key}`}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            게시판으로
          </Link>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");
    setError(null);
    setSubmitting(true);
    try {
      const extraPayload: Record<string, any> = {};
      for (const f of extraFields) {
        const raw = (extra[f.key] ?? "").trim();
        if (!raw) continue;
        extraPayload[f.key] = f.type === "number" ? Number(raw) : raw;
      }

      const resp = await apiCreatePost(board.key, {
        type,
        title: title.trim(),
        content: content.trim(),
        extra: extraPayload,
        is_private: false,
        password: null,
      });

      router.push(`/community/${board.key}/${resp.post.id}`);
    } catch (e: any) {
      setError(e?.message ?? "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">{board.title} 글쓰기</div>
          <div className="mt-1 text-sm text-white/60">작성자: {user?.nickname ?? ""}</div>
        </div>
        <Link
          href={`/community/${board.key}`}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          목록
        </Link>
      </div>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="text-sm text-white/70">말머리</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-[#0b1320] px-3 py-2 text-white outline-none focus:border-white/20"
          >
            {POST_TYPE_OPTIONS.filter((t) => board.allowTypes.includes(t)).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <Field label="제목" value={title} onChange={setTitle} placeholder="제목" />

        <label className="block">
          <span className="text-sm text-white/70">내용</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="본문을 입력하세요"
            rows={10}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white outline-none placeholder:text-white/30 focus:border-white/20"
          />
        </label>

        {extraFields.length > 0 ? (
          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white/80">추가 정보</div>
            {extraFields.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                value={extra[f.key] ?? ""}
                onChange={(v) => setExtra((prev) => ({ ...prev, [f.key]: v }))}
                placeholder={f.placeholder}
                type={f.type === "number" ? "number" : "text"}
              />
            ))}
          </div>
        ) : null}

        {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}

        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-60"
          >
            {submitting ? "저장 중…" : "등록"}
          </button>
          <Link
            href={`/community/${board.key}`}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            취소
          </Link>
        </div>
      </div>
    </div>
  );
}
