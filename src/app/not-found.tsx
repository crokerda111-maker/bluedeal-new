import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bd-surface mx-auto max-w-2xl p-6 sm:p-10" aria-labelledby="not-found-title">
      <p className="text-sm font-semibold tracking-widest text-cyan-200">404</p>
      <h1 id="not-found-title" className="mt-3 text-2xl font-semibold sm:text-3xl">페이지를 찾을 수 없습니다</h1>
      <p className="mt-4 text-sm leading-7 text-white/70">주소가 바뀌었거나 페이지가 삭제되었을 수 있습니다. 아래 메뉴에서 원하는 내용을 다시 찾아보세요.</p>
      <nav aria-label="다른 페이지 찾기" className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="rounded-xl bg-cyan-200 px-4 py-3 text-sm font-semibold text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">홈으로</Link>
        <Link href="/prices" className="rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">가격현황</Link>
        <Link href="/community" className="rounded-xl border border-white/20 px-4 py-3 text-sm hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">커뮤니티</Link>
      </nav>
    </section>
  );
}
