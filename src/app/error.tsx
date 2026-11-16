"use client";

import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";

export default function RouteError({ retry }: { error: unknown; retry: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { heading.current?.focus(); }, []);

  return <section className="bd-surface mx-auto max-w-2xl p-6 sm:p-10" role="alert" aria-labelledby="error-title" aria-busy={pending}>
    <h1 id="error-title" ref={heading} tabIndex={-1} className="text-2xl font-semibold">페이지를 불러오지 못했습니다</h1>
    <p className="mt-4 text-sm leading-7 text-white/75">일시적인 연결 또는 서버 오류가 발생했습니다. 잠시 후 다시 불러오거나 다른 메뉴로 이동해 주세요.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <button type="button" disabled={pending} onClick={() => startTransition(retry)} className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">{pending ? "다시 불러오는 중…" : "다시 불러오기"}</button>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10">홈으로</Link>
    </div>
  </section>;
}
