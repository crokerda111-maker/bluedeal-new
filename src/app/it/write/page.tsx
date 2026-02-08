"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { IT_BOARD, POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import { apiCreatePost } from "../../../lib/apiClient";
import { useAuth } from "../../_components/AuthProvider";

export default function ITWritePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [type, setType] = useState(POST_TYPE_OPTIONS[0].value);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => title.trim().length >= 2 && content.trim().length >= 10, [title, content]);

  const onSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const extra: Record<string, any> = {
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        model: model.trim() || undefined,
        link: link.trim() || undefined,
      };
      if (price.trim()) {
        const n = Number(price);
        extra.price = Number.isFinite(n) ? n : price.trim();
      }

      const res = await apiCreatePost(IT_BOARD.key, {
        type,
        title: title.trim(),
        content: content.trim(),
        extra,
      });
      router.push(`/it/${res.post.id}`);
    } catch (e: any) {
      setError(e?.message || "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !user) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <h1 className="text-lg font-semibold">IT 게시글 작성</h1>
          <p className="mt-2 text-sm text-white/70">글 작성은 로그인 후 가능합니다.</p>
          <div className="mt-4 flex gap-2">
            <Link
              href={`/account?tab=login&returnTo=${encodeURIComponent("/it/write")}`}
              className="rounded-lg bg-sky-500/80 px-4 py-2 text-sm font-medium hover:bg-sky-500"
            >
              로그인
            </Link>
            <Link href="/it" className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
              돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{IT_BOARD.title} 글쓰기</h1>
          <p className="mt-1 text-sm text-white/60">작성자: {user?.nickname ?? ""}</p>
        </div>
        <Link href="/it" className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5">
          목록
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-white/70">유형</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            >
              {POST_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-white/70">태그 (쉼표로 구분)</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="예: cpu, gpu, 드라이버"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-sm text-white/70">제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
          />
        </label>

        <label className="mt-4 block space-y-1">
          <span className="text-sm text-white/70">내용</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요 (10자 이상)"
            rows={10}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
          />
        </label>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-white/70">모델(선택)</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="예: RTX 4090"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-white/70">가격(선택)</span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 1990000"
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-white/70">링크(선택)</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </label>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">{error}</div>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/50">제목 2자, 내용 10자 이상</p>
          <button
            onClick={onSubmit}
            disabled={!canSubmit || saving}
            className="rounded-lg bg-sky-500/80 px-4 py-2 text-sm font-medium hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "저장 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
