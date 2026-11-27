import type { MotherboardMedia as BoardMedia } from "../lib/motherboardExpansion";

export default function MotherboardMedia({ media, brand }: { media: BoardMedia; brand: string }) {
  const links = [
    { url: media.main, label: "대표 사진 원본" },
    { url: media.pcb, label: "PCB 배치 사진 원본" },
  ];
  return <section id="motherboard-photos" className="bd-surface-md scroll-mt-24 space-y-3 p-5 sm:p-6" aria-labelledby="motherboard-photos-title">
    <h2 id="motherboard-photos-title" className="text-xl font-semibold">메인보드 사진</h2>
    {media.white ? <p className="text-sm text-white/80">{media.white}</p> : null}
    {media.photoRevision ? <p className="text-xs text-white/70">{media.photoRevision}</p> : null}
    <div className="grid gap-2 sm:grid-cols-2">
      {links.map(({ url, label }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-cyan-100 hover:bg-white/10">
        {label}<span aria-hidden="true">↗</span><span className="sr-only"> (새 창)</span>
      </a>)}
    </div>
    <a href={media.gallery} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4">{brand} 공식 사진 갤러리<span className="sr-only"> (새 창)</span></a>
  </section>;
}
