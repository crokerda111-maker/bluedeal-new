import type { Metadata } from "next";

export const SITE_URL = "https://bluedeal.co.kr";
export const SITE_NAME = "BLUEDEAL";
export const SITE_DESCRIPTION = "PC 부품 가격과 배송 조건, 핫딜, IT 소식과 하드웨어 커뮤니티를 한곳에서 확인하세요.";

export function pageMetadata(title: string, description: string, path?: string, noIndex = false): Metadata {
  return {
    title,
    description,
    // Clear a parent list's canonical on write/private pages with no public path.
    alternates: { canonical: path ?? null },
    openGraph: { title, description, siteName: SITE_NAME, locale: "ko_KR", type: "website", images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: "BLUEDEAL · PC 부품 가격, IT 소식과 핫딜" }], ...(path ? { url: path } : {}) },
    twitter: { card: "summary_large_image", title, description, images: [`${SITE_URL}/opengraph-image`] },
    robots: { index: !noIndex && process.env.VERCEL_ENV !== "preview", follow: !noIndex },
  };
}
