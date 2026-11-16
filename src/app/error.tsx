"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="bd-surface mx-auto max-w-2xl p-6 sm:p-10" aria-labelledby="error-title">
      <div role="alert">
        <h1 id="error-title" className="text-2xl font-semibold">페이지를 불러오지 못했습니다</h1>
        <p className="mt-4 text-sm leading-7 text-white/70">잠시 후 다시 시도해 주세요. 문제가 계속되면 홈에서 다른 메뉴를 이용할 수 있습니다.</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={reset} className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">다시 시도</button>
        <Link href="/" className="rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">홈으로</Link>
      </div>
    </section>
  );
}
