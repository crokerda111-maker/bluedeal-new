"use client";

import Image from "next/image";
import { useState } from "react";

export default function HotdealPhoto({
  src,
  alt,
  detail = false,
}: {
  src: string | null;
  alt: string;
  detail?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const available = !!src && src !== failedSrc;
  return (
    <div className={
      "relative flex items-center justify-center overflow-hidden rounded-lg " +
      (detail ? "aspect-square w-full sm:aspect-[4/3]" : "aspect-square w-full sm:aspect-[16/10]") +
      (available ? " bg-white" : " border border-white/10 bg-slate-900/75")
    }>
      {available ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={detail ? "(max-width: 639px) calc(100vw - 64px), 512px" : "(max-width: 639px) 96px, (max-width: 1023px) 45vw, 350px"}
          className="object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : <span className="px-1 text-center text-xs text-slate-300">상품 사진 없음</span>}
    </div>
  );
}
