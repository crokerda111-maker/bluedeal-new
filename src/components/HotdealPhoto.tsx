"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { trimHotdealBackdrop } from "../lib/hotdealBackdrop";

function drawCutout(image: HTMLImageElement, canvas: HTMLCanvasElement, maxSide: number) {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) return false;

  // Sample the already downloaded thumbnail at a bounded resolution.
  const scale = Math.min(1, maxSide / longestSide);
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !canvas.width || !canvas.height) return false;

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const bounds = trimHotdealBackdrop(pixels);
    if (bounds) {
      canvas.width = bounds.width;
      canvas.height = bounds.height;
      context.putImageData(pixels, -bounds.left, -bounds.top);
      return true;
    }
  } catch {
    // An unreadable image still renders via the original image element.
  }
  canvas.width = 0;
  canvas.height = 0;
  return false;
}

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
  const [loadedPhoto, setLoadedPhoto] = useState<{ src: string; cutout: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const available = !!src && src !== failedSrc;
  const photo = loadedPhoto?.src === src ? loadedPhoto : null;

  return (
    <div className={
      "relative flex items-center justify-center overflow-hidden rounded-lg " +
      (detail ? "aspect-square w-full sm:aspect-[4/3]" : "aspect-square w-full sm:aspect-[16/10]") +
      (available ? "" : " border border-white/10 bg-slate-900/75")
    }>
      {available ? (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            loading={detail ? "eager" : "lazy"}
            sizes={detail ? "(max-width: 639px) calc(100vw - 64px), 512px" : "(max-width: 639px) 96px, (max-width: 1023px) 45vw, 350px"}
            className={photo && !photo.cutout ? "object-contain" : "object-contain opacity-0"}
            onLoad={event => {
              const canvas = canvasRef.current;
              const cutout = canvas ? drawCutout(event.currentTarget, canvas, detail ? 560 : 360) : false;
              setLoadedPhoto({ src, cutout });
            }}
            onError={() => setFailedSrc(src)}
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            hidden={!photo?.cutout}
            className="pointer-events-none h-[90%] w-[90%] object-contain"
          />
        </>
      ) : <span className="px-1 text-center text-xs text-slate-300">상품 사진 없음</span>}
    </div>
  );
}
