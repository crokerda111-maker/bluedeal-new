export default function PostCreatedNotice({ href, writeHref }: { href: string | null; writeHref: string }) {
  if (!href) return null;
  // Document links remain usable when the client route transition is delayed or fails.
  return (
    <div role="status" className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-100">
      <p>글이 등록되었습니다. 이동이 늦어지면 아래 링크로 확인해 주세요.</p>
      <div className="mt-1 flex flex-wrap gap-x-5">
        <a href={href} className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
          작성한 글 보기 →
        </a>
        <a href={writeHref} className="inline-flex min-h-11 items-center text-white/80 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
          새 글 작성
        </a>
      </div>
    </div>
  );
}
