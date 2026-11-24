import Image from "next/image";
import type { ProductPhoto as Photo } from "../lib/productEditorial";

export default function ProductPhoto({ photo, compact = false, credit = true }: { photo: Photo; compact?: boolean; credit?: boolean }) {
  const crop = photo.crop;
  const preview = crop ? <div data-fullpc-photo-frame className="relative aspect-square overflow-hidden rounded-xl bg-slate-100"
    style={{ backgroundColor: crop.background }}>
    <Image data-fullpc-photo src={photo.src} alt={photo.alt} width={480} height={480} unoptimized
      className="absolute h-auto max-w-none"
      style={{ width: `${10000 / crop.size}%`, left: `${-100 * crop.x / crop.size}%`, top: `${-100 * crop.y / crop.size}%`, clipPath: crop.mask }} />
  </div> : <div className={`${compact ? "h-40" : "h-64 sm:h-80"} overflow-hidden rounded-xl bg-slate-100`}>
    <Image src={photo.src} alt={photo.alt} width={600} height={600} unoptimized referrerPolicy="no-referrer" className="h-full w-full object-contain" />
  </div>;
  return <figure className="min-w-0">
    {credit ? <a href={photo.src} target="_blank" rel="noopener noreferrer" aria-label={`${photo.alt} 크게 보기 (새 창)`} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{preview}</a> : preview}
    {credit ? <figcaption className="mt-2 text-xs leading-5 text-white/70">
      <a href={photo.source} className="text-cyan-200 underline underline-offset-4" target="_blank" rel="noopener noreferrer">사진 출처 · {photo.sourceLabel}<span className="sr-only"> (새 창)</span></a>
      {" · 사진 속 부품의 포함 여부는 판매 옵션 확인"}
    </figcaption> : null}
  </figure>;
}
