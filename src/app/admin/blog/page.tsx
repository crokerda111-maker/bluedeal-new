"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BlogAffiliateLink, BlogPost } from "../../../lib/blogTypes";
import { apiAdminLogout, apiAdminStatus } from "../../../lib/postsClient";

type EditorState = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string;
  body: string;
  affiliateLinkLines: string;
  affiliateLinks: BlogAffiliateLink[];
  publishedAt: string;
  published: boolean;
};

const EMPTY_EDITOR: EditorState = {
  slug: "",
  title: "",
  summary: "",
  category: "상품 설명",
  tags: "",
  body: "",
  affiliateLinkLines: "",
  affiliateLinks: [],
  publishedAt: "",
  published: false,
};

function localDateTime(value?: string): string {
  const date = value ? new Date(value) : new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toEditor(post: BlogPost): EditorState {
  return {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    category: post.category,
    tags: post.tags.join(", "),
    body: post.body,
    affiliateLinkLines: "",
    affiliateLinks: post.affiliateLinks,
    publishedAt: localDateTime(post.publishedAt),
    published: post.published,
  };
}

async function parseResponse(res: Response): Promise<any> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data;
}

export default function AdminBlogPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({ ...EMPTY_EDITOR, publishedAt: localDateTime() });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const selectedPost = useMemo(() => posts.find((post) => post.slug === selectedSlug) ?? null, [posts, selectedSlug]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/blog", { cache: "no-store" });
      const data = await parseResponse(res);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setStorageAvailable(data.onlineStorageAvailable !== false);
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message ?? "글 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiAdminStatus()
      .then((ok) => {
        if (cancelled) return;
        setIsAdmin(ok);
        if (ok) void refresh();
      })
      .catch(() => setIsAdmin(false))
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [refresh]);

  const startNew = () => {
    setSelectedSlug(null);
    setEditor({ ...EMPTY_EDITOR, publishedAt: localDateTime() });
    setMessage(null);
  };

  const selectPost = (post: BlogPost) => {
    setSelectedSlug(post.slug);
    setEditor(toEditor(post));
    setMessage(null);
  };

  const setField = <K extends keyof EditorState>(key: K, value: EditorState[K]) => {
    setEditor((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...editor,
        tags: editor.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        publishedAt: new Date(editor.publishedAt).toISOString(),
      };
      const path = selectedSlug ? `/api/blog/${encodeURIComponent(selectedSlug)}` : "/api/blog";
      const res = await fetch(path, {
        method: selectedSlug ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseResponse(res);
      setSelectedSlug(data.post.slug);
      setEditor(toEditor(data.post));
      setMessage({ type: "ok", text: "저장했습니다. 발행 상태라면 구매가이드에 바로 표시됩니다." });
      await refresh();
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message ?? "저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedPost || selectedPost.source !== "admin") return;
    if (!confirm("이 관리자 글을 삭제할까요? 정적 글을 덮어쓴 글이라면 원래 정적 글이 다시 표시됩니다.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/blog/${encodeURIComponent(selectedPost.slug)}`, { method: "DELETE" });
      await parseResponse(res);
      startNew();
      await refresh();
    } catch (error: any) {
      setMessage({ type: "error", text: error?.message ?? "삭제하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  if (checking) return <div className="bd-surface-md p-6 text-white/65">관리자 세션을 확인하고 있습니다.</div>;

  if (!isAdmin) {
    return (
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold">블로그 관리</h1>
        <p className="mt-3 text-sm text-white/60">먼저 관리자 페이지에서 로그인하세요.</p>
        <Link href="/admin" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">관리자 로그인</Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.18em] text-cyan-200/70">HYBRID BLOG</div>
            <h1 className="mt-2 text-2xl font-semibold">블로그 관리</h1>
            <p className="mt-2 text-sm text-white/60">Codex 정적 글과 관리자 작성 글을 한곳에서 확인합니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">게시판 관리</Link>
            <Link href="/blog" className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">블로그 보기</Link>
            <button type="button" onClick={async () => { await apiAdminLogout(); location.href = "/admin"; }} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">로그아웃</button>
          </div>
        </div>
      </section>

      {!storageAvailable ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
          KV 연결이 없어 정적 글만 표시됩니다. 관리자 저장 기능은 KV 환경변수를 연결한 뒤 사용할 수 있습니다.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="bd-surface-md self-start p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">글 목록</h2>
            <button type="button" onClick={startNew} className="rounded-lg bg-cyan-300 px-3 py-1.5 text-[12px] font-semibold text-slate-950">새 글</button>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? <div className="p-3 text-sm text-white/50">불러오는 중...</div> : null}
            {!loading && posts.length === 0 ? <div className="p-3 text-sm text-white/50">글이 없습니다.</div> : null}
            {posts.map((post) => (
              <button key={post.slug} type="button" onClick={() => selectPost(post)} className={`w-full rounded-xl border p-3 text-left ${selectedSlug === post.slug ? "border-cyan-300/40 bg-cyan-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                <div className="line-clamp-2 text-sm font-semibold text-white/85">{post.title}</div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
                  <span>{post.source === "static" ? "GitHub" : "관리자"}</span>
                  <span>{post.published ? "발행" : "초안"}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="bd-surface-md p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">{selectedPost ? "글 수정" : "새 글 작성"}</h2>
              {selectedPost?.source === "static" ? <p className="mt-1 text-[12px] text-amber-200/80">저장하면 이 정적 글을 덮어쓰는 관리자 버전이 생성됩니다.</p> : null}
            </div>
            <label className="flex items-center gap-2 text-sm text-white/75">
              <input type="checkbox" checked={editor.published} onChange={(event) => setField("published", event.target.checked)} />
              공개 발행
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="제목" value={editor.title} onChange={(value) => setField("title", value)} className="md:col-span-2" />
            <Field label="글 주소 (영문·숫자·하이픈)" value={editor.slug} onChange={(value) => setField("slug", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="example-product-guide" />
            <Field label="카테고리" value={editor.category} onChange={(value) => setField("category", value)} placeholder="상품 설명" />
            <Field label="태그 (쉼표 구분)" value={editor.tags} onChange={(value) => setField("tags", value)} placeholder="그래픽카드, 가격비교" />
            <Field label="발행일" value={editor.publishedAt} onChange={(value) => setField("publishedAt", value)} type="datetime-local" />
            <TextArea label="요약" value={editor.summary} onChange={(value) => setField("summary", value)} rows={3} className="md:col-span-2" placeholder="목록과 검색 결과에 표시할 짧은 설명" />
            <TextArea label="본문" value={editor.body} onChange={(value) => setField("body", value)} rows={18} className="md:col-span-2" placeholder={"## 큰 제목\n\n본문 문장\n\n- 목록 항목"} />
            <TextArea label="새 상품 링크 (한 줄에 상품명 | URL)" value={editor.affiliateLinkLines} onChange={(value) => setField("affiliateLinkLines", value)} rows={5} className="md:col-span-2" placeholder={"상품명 | https://판매처주소\n다른 상품 | https://판매처주소"} />
          </div>

          {editor.affiliateLinks.length > 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm font-semibold">현재 등록된 이동 링크</div>
              <div className="mt-2 space-y-1 text-[12px] text-white/55">
                {editor.affiliateLinks.map((link) => <div key={`${link.goCode}-${link.label}`}>{link.label} → /go/{link.goCode}</div>)}
              </div>
              <p className="mt-2 text-[11px] text-white/35">새 상품 링크를 입력하면 이 목록을 새 링크로 교체합니다.</p>
            </div>
          ) : null}

          {message ? <div className={`mt-4 rounded-xl border p-3 text-sm ${message.type === "ok" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-red-400/25 bg-red-400/10 text-red-100"}`}>{message.text}</div> : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <button type="button" onClick={remove} disabled={!selectedPost || selectedPost.source !== "admin" || saving} className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2 text-sm text-red-100 disabled:cursor-not-allowed disabled:opacity-35">삭제</button>
            <button type="button" onClick={save} disabled={saving || !storageAvailable} className="rounded-xl bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "저장 중..." : "저장"}</button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, className = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="text-sm text-white/75">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/45" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows, placeholder, className = "" }: { label: string; value: string; onChange: (value: string) => void; rows: number; placeholder?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="text-sm text-white/75">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-cyan-300/45" />
    </label>
  );
}

