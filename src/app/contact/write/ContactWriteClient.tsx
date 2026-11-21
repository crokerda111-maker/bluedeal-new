"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import type { InquiryVisibility, PostType } from "../../../lib/postTypes";
import { apiCreatePost, postErrorMessage } from "../../../lib/postsClient";
import { POST_LIMITS } from "../../../lib/postInput";
import NicknameEditor from "../../../components/NicknameEditor";
import PostCreatedNotice from "../../../components/PostCreatedNotice";
import { useNickname } from "../../../lib/useNickname";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type ProductContext = { id: string; name: string; referenceCode: string };

export default function ContactWritePage({ productContext }: { productContext?: ProductContext }) {
  const sp = useSearchParams();
  const from = (sp.get("from") ?? "").toLowerCase();
  const fromPrices = from === "prices";
  const category = sp.get("cat") ?? "";
  const initialVis: InquiryVisibility = sp.get("vis") === "private" ? "private" : "public";

  const product = from === "products" ? productContext : undefined;
  return <ContactForm key={`${fromPrices}:${category}:${initialVis}:${product?.id ?? ""}`} fromPrices={fromPrices} product={product} category={category} initialVis={initialVis} />;
}

function ContactForm({ fromPrices, product, category, initialVis }: { fromPrices: boolean; product?: ProductContext; category: string; initialVis: InquiryVisibility }) {
  const adminOnly = fromPrices || Boolean(product);
  const router = useRouter();
  const [visibility, setVisibility] = useState<InquiryVisibility>(adminOnly ? "private" : initialVis);

  const [type, setType] = useState<PostType>("general");
  const [title, setTitle] = useState(product ? `[상품 정보 수정] ${product.name}`.slice(0, POST_LIMITS.title) : fromPrices ? category ? `[가격현황 제보] ${category}` : "[가격현황 제보]" : "");
  const [content, setContent] = useState(product ? `상품: ${product.name}\n상품 관리번호: ${product.referenceCode}\n상품 페이지: https://bluedeal.co.kr/products/${product.id}\n\n- 수정하거나 추가할 내용\n- 확인한 근거 링크\n- 모델·옵션·사용 조건` : fromPrices ? "제보/추가요청 내용을 적어주세요.\n\n- 제품/모델명\n- 링크(가능하면)\n- 현재가/조건\n- 수정 요청 내용" : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const authorName = useNickname();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createdHref, setCreatedHref] = useState<string | null>(null);
  const submissionState = useRef<"idle" | "saving" | "submitted">("idle");
  const [submitted, setSubmitted] = useState(false);
  const receiptHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (submitted) receiptHeading.current?.focus();
  }, [submitted]);

  const effectiveVis: InquiryVisibility = adminOnly ? "private" : visibility;

  const notice = useMemo(() => {
    if (!adminOnly) return null;
    return (
      <div className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
        <div className="font-semibold">{product ? "상품 정보 수정·추가 요청" : "가격현황 제보/추가요청"}</div>
        <div className="mt-1 text-[13px] text-white/80">
          이 글은 <b>운영자 확인용 비공개 문의</b>로 등록됩니다. 작성자용 열람 비밀번호는 제공되지 않습니다.
        </div>
      </div>
    );
  }, [adminOnly, product]);

  const onSubmit = async () => {
    if (submissionState.current !== "idle") return;
    setError(null);

    if (!title.trim()) return setError("제목을 입력하세요.");
    if (!content.trim()) return setError("내용을 입력하세요.");

    if (effectiveVis === "private" && !adminOnly && !password.trim()) {
      return setError("비공개 문의는 비밀번호가 필요합니다.");
    }

    submissionState.current = "saving";
    setSaving(true);
    try {
      const post = await apiCreatePost({
        boardKey: "inquiry",
        type,
        title,
        content,
        authorName: authorName || "게스트",
        isPrivate: effectiveVis === "private",
        password: effectiveVis === "private" && !adminOnly ? password : null,
        lockToAdminPassword: adminOnly,
        extra: { email, ...(product ? { productId: product.id, productReference: product.referenceCode } : {}) },
      });

      submissionState.current = "submitted";
      if (adminOnly) {
        setSubmitted(true);
      } else {
        const href = `/contact/${post.id}`;
        setCreatedHref(href);
        router.push(href);
      }
    } catch (error) {
      if (submissionState.current !== "submitted") {
        submissionState.current = "idle";
        setError(postErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <section className="bd-surface-md mx-auto max-w-2xl p-6" aria-labelledby="inquiry-received-title">
        <h1 ref={receiptHeading} tabIndex={-1} id="inquiry-received-title" className="text-2xl font-semibold focus:outline-none">제보가 접수되었습니다</h1>
        <p className="mt-4 text-sm leading-7 text-white/75">운영자 확인용 비공개 문의로 등록했습니다. 보내주신 {product ? "상품 정보 수정·추가" : "가격 오류·상품 추가"} 요청을 검토하겠습니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={product ? `/products/${product.id}` : "/prices"} className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">{product ? "상품 정보로" : "가격현황으로"}</Link>
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

      <form className="bd-surface-md p-4 sm:p-6" aria-label="문의 작성" aria-busy={saving}
        onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
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

          {/* 공개/비공개 */}
          <div>
            <div className="text-sm text-white/80">공개 설정</div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => !adminOnly && setVisibility("public")}
                disabled={adminOnly}
                aria-pressed={effectiveVis === "public"}
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
                onClick={() => !adminOnly && setVisibility("private")}
                disabled={adminOnly}
                aria-pressed={effectiveVis === "private"}
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
            <div className="mt-1 text-[12px] text-white/70">
              {adminOnly ? `${product ? "상품 정보 수정 요청" : "가격현황 제보"}은 자동으로 비공개 처리됩니다.` : "비공개 글은 비밀번호를 입력한 사람만 열람할 수 있습니다."}
            </div>
          </div>

          {/* 말머리 */}
          <fieldset>
            <legend className="text-sm text-white/80">말머리</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {POST_TYPE_OPTIONS.filter((o) => ["general", "question", "tip"].includes(o.value)).map((o) => (
                <button
                  key={o.value}
                  onClick={() => setType(o.value as PostType)}
                  type="button"
                  aria-pressed={type === o.value}
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
          </fieldset>

          {/* 제목 */}
          <label className="block">
            <div className="text-sm text-white/80">제목</div>
            <input
              value={title}
              maxLength={POST_LIMITS.title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
              placeholder="제목"
              required
            />
          </label>

          <label className="block">
            <div className="text-sm text-white/80">연락 이메일(선택)</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
              placeholder="reply@example.com"
              type="email"
              autoComplete="email"
            />
            {effectiveVis === "public" ? <p className="mt-2 text-xs leading-5 text-amber-200">공개 문의에 적은 이메일은 다른 방문자도 볼 수 있습니다. 공개를 원하지 않으면 비공개 문의를 선택해 주세요.</p> : null}
          </label>

          {effectiveVis === "private" && !adminOnly ? (
            <label className="block">
              <div className="text-sm text-white/80">비밀번호</div>
              <input
                value={password}
                maxLength={POST_LIMITS.password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
                placeholder="비공개 글 열람용 비밀번호"
                autoComplete="new-password"
                required
              />
            </label>
          ) : null}

          {/* 내용은 추가 설정을 마친 뒤 마지막에 작성 */}
          <label className="block">
            <div className="text-sm text-white/80">내용</div>
            <textarea
              rows={10}
              value={content}
              maxLength={POST_LIMITS.content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/65 focus:border-cyan-300/50"
              placeholder="내용"
              required
            />
          </label>

          {error ? <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
          <PostCreatedNotice href={createdHref} writeHref={`/contact/write?vis=${effectiveVis}`} />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving || createdHref !== null}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {createdHref ? "등록 완료" : saving ? "저장 중..." : "등록"}
            </button>
            <Link
              href="/contact"
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
