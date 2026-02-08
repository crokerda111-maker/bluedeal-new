"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { INQUIRY_BOARD } from "../../../lib/boardConfig";
import { apiCreatePost } from "../../../lib/apiClient";
import { useAuth } from "../../_components/AuthProvider";

type FormState = {
  title: string;
  content: string;
  email: string;
  orderId: string;
};

export default function ContactWriteClient() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState<FormState>({
    title: "",
    content: "",
    email: "",
    orderId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!form.title.trim() && !!form.content.trim() && !!form.email.trim();
  }, [form.title, form.content, form.email]);

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      const extra: Record<string, any> = {
        email: form.email.trim(),
      };
      if (form.orderId.trim()) extra.order = form.orderId.trim();

      const res = await apiCreatePost(INQUIRY_BOARD.key, {
        type: "general",
        title: form.title.trim(),
        content: form.content.trim(),
        extra,
        is_private: false,
      });
      const id = res.post?.id;
      if (!id) throw new Error("서버가 글 ID를 반환하지 않았습니다.");
      router.push(`/contact/${id}`);
    } catch (e: any) {
      setError(e?.message || "문의 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
        로그인 상태 확인 중…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-white/90">문의 작성은 로그인이 필요합니다.</div>
        <div className="mt-2 text-sm text-white/60">로그인 후 다시 작성해 주세요.</div>
        <div className="mt-4">
          <Link
            href={`/account?tab=login&returnTo=${encodeURIComponent("/contact/write")}`}
            className="inline-flex items-center rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
          >
            로그인 하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="mb-3 text-sm text-white/70">
          작성자: <span className="text-white/90">{user.nickname}</span>
        </div>

        <label className="block text-sm text-white/80">제목</label>
        <input
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="문의 제목"
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/40"
        />

        <div className="mt-4">
          <label className="block text-sm text-white/80">이메일(답변 수신)</label>
          <input
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            placeholder="example@email.com"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/40"
          />
          <div className="mt-2 text-xs text-white/50">
            민감한 개인정보는 입력하지 마세요.
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm text-white/80">주문번호(있으면)</label>
          <input
            value={form.orderId}
            onChange={(e) => setForm((p) => ({ ...p, orderId: e.target.value }))}
            placeholder="선택"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/40"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm text-white/80">내용</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            placeholder="문의 내용을 적어주세요."
            rows={8}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white placeholder:text-white/40"
          />
        </div>

        {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Link
            href="/contact"
            className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
          >
            취소
          </Link>
          <button
            disabled={!canSubmit || saving}
            onClick={submit}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? "등록 중…" : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
