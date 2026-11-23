import type { Metadata } from "next";

export const SITE_URL = "https://bluedeal.co.kr";
export const SITE_NAME = "BLUEDEAL";
export const SITE_DESCRIPTION = "오늘의 완본체 베스트와 오픈마켓 조립PC 가격을 비교하세요. CPU·그래픽카드, 메인보드·파워 구성, 배송비와 구매 조건을 확인합니다.";

export function pageMetadata(title: string, description: string, path?: string, noIndex = false): Metadata {
  return {
    title,
    description,
    // Clear a parent list's canonical on write/private pages with no public path.
    alternates: { canonical: path ?? null },
    openGraph: { title, description, siteName: SITE_NAME, locale: "ko_KR", type: "website", images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: "블루딜 완본체 추천과 가격비교" }], ...(path ? { url: path } : {}) },
    twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/opengraph-image`] },
    robots: { index: !noIndex && process.env.VERCEL_ENV !== "preview", follow: !noIndex },
  };
}
