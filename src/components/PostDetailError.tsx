import Link from "next/link";

export default function PostDetailError({ missing, onRetry, backHref, backLabel }: {
  missing: boolean; onRetry: () => void; backHref: string; backLabel: string;
}) {
  return <section className="bd-surface-md p-6" role="alert">
    <h1 className="text-lg font-semibold">{missing ? "글을 찾을 수 없습니다" : "게시글을 불러오지 못했습니다"}</h1>
    <p className="mt-2 text-sm leading-relaxed text-white/75">{missing ? "삭제되었거나 존재하지 않는 글입니다." : "연결 또는 서버 응답에 문제가 있습니다. 잠시 후 다시 불러와 주세요."}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      {!missing ? <button type="button" onClick={onRetry} className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white">다시 불러오기</button> : null}
      <Link className="inline-flex min-h-11 items-center text-sm text-cyan-200 hover:underline" href={backHref}>{backLabel}</Link>
    </div>
  </section>;
}
