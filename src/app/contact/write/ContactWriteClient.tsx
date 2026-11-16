"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import type { InquiryVisibility, PostType } from "../../../lib/postTypes";
import { apiCreatePost } from "../../../lib/postsClient";
import { setNickname } from "../../../lib/profile";
import { useNickname } from "../../../lib/useNickname";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

export default function ContactWritePage() {
  const sp = useSearchParams();
  const from = (sp.get("from") ?? "").toLowerCase();
  const fromPrices = from === "prices";
  const category = sp.get("cat") ?? "";
  const initialVis = (sp.get("vis") as InquiryVisibility | null) ?? "public";

  return <ContactForm key={`${fromPrices}:${category}:${initialVis}`} fromPrices={fromPrices} category={category} initialVis={initialVis} />;
}

function ContactForm({ fromPrices, category, initialVis }: { fromPrices: boolean; category: string; initialVis: InquiryVisibility }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState<InquiryVisibility>(fromPrices ? "private" : initialVis);

  const [type, setType] = useState<PostType>("general");
  const [title, setTitle] = useState(fromPrices ? category ? `[가격현황 제보] ${category}` : "[가격현황 제보]" : "");
  const [content, setContent] = useState(fromPrices ? "제보/추가요청 내용을 적어주세요.\n\n- 제품/모델명\n- 링크(가능하면)\n- 현재가/조건\n- 수정 요청 내용" : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const authorName = useNickname();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (submitted) receiptHeading.current?.focus();
  }, [submitted]);

  const changeNick = () => {
    const next = prompt("닉네임을 입력하세요 (최대 20자)", authorName === "게스트" ? "" : authorName);
    if (!next) return;
    setNickname(next);
  };

  const effectiveVis: InquiryVisibility = fromPrices ? "private" : visibility;

  const notice = useMemo(() => {
    if (!fromPrices) return null;
    return (
      <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
        <div className="font-semibold">가격현황 제보/추가요청</div>
        <div className="mt-1 text-[13px] text-white/80">
          이 글은 <b>운영자 확인용 비공개 문의</b>로 등록됩니다. 작성자용 열람 비밀번호는 제공되지 않습니다.
        </div>
      </div>
    );
  }, [fromPrices]);

  const onSubmit = async () => {
    if (saving) return;
    setError(null);

    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");

    if (effectiveVis === "private" && !fromPrices && !password.trim()) {
      return setError("비공개 문의는 비밀번호가 필요합니다.");
    }

    setSaving(true);
    try {
      const post = await apiCreatePost({
        boardKey: "inquiry",
        type,
        title,
        content,
        authorName: authorName || "게스트",
        isPrivate: effectiveVis === "private",
        password: effectiveVis === "private" && !fromPrices ? password : null,
        lockToAdminPassword: fromPrices,
        extra: { email },
      });

      if (fromPrices) {
        setSubmitted(true);
      } else {
        router.push(`/contact/${post.id}`);
      }
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <section className="bd-surface-md mx-auto max-w-2xl p-6" aria-labelledby="inquiry-received-title">
        <h1 ref={receiptHeading} tabIndex={-1} id="inquiry-received-title" className="text-2xl font-semibold focus:outline-none">제보가 접수되었습니다</h1>
        <p className="mt-4 text-sm leading-7 text-white/75">운영자 확인용 비공개 문의로 등록했습니다. 보내주신 가격 오류·상품 추가 요청을 검토하겠습니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/prices" className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">가격현황으로</Link>
          <Link href="/contact" className="rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">문의 목록</Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/60">문의</div>
          <h1 className="text-2xl font-semibold tracking-tight">문의 작성</h1>
        </div>
        <Link className="text-sm text-cyan-200 hover:underline" href="/contact">
          목록으로
        </Link>
      </div>

      {notice}

      <section className="bd-surface-md p-6">
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

          {/* 공개/비공개 */}
          <div>
            <div className="text-sm text-white/80">공개 설정</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => !fromPrices && setVisibility("public")}
                disabled={fromPrices}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm disabled:opacity-60",
                  effectiveVis === "public"
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                )}
              >
                🌐 공개
              </button>
              <button
                type="button"
                onClick={() => !fromPrices && setVisibility("private")}
                disabled={fromPrices}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm disabled:opacity-60",
                  effectiveVis === "private"
                    ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                )}
              >
                🔒 비공개
              </button>
            </div>
            <div className="mt-1 text-[12px] text-white/50">
              {fromPrices ? "가격현황 제보는 자동으로 비공개 처리됩니다." : "비공개 글은 비밀번호를 입력한 사람만 열람할 수 있습니다."}
            </div>
          </div>

          {/* 말머리 */}
          <label className="block">
            <div className="text-sm text-white/80">말머리</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {POST_TYPE_OPTIONS.filter((o) => ["general", "question", "tip"].includes(o.value)).map((o) => (
                <button
                  key={o.value}
                  onClick={() => setType(o.value as PostType)}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    type === o.value
                      ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                  title={o.hint}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </label>

          {/* 제목 */}
          <label className="block">
            <div className="text-sm text-white/80">제목</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              placeholder="제목"
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">연락 이메일(선택)</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              placeholder="reply@example.com"
            />
            {effectiveVis === "public" ? <p className="mt-2 text-xs leading-5 text-amber-200">공개 문의에 적은 이메일은 다른 방문자도 볼 수 있습니다. 공개를 원하지 않으면 비공개 문의를 선택해 주세요.</p> : null}
          </label>

          {effectiveVis === "private" && !fromPrices ? (
            <label className="block">
              <div className="text-sm text-white/80">비밀번호</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
                placeholder="비공개 글 열람용 비밀번호"
              />
            </label>
          ) : null}

          {/* 내용은 추가 설정을 마친 뒤 마지막에 작성 */}
          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/50"
              placeholder="내용"
            />
          </label>

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
              href="/contact"
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
