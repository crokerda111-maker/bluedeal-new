import generatedOutbound from "../content/outbound.generated.json";

export type Merchant = "coupang" | "aliexpress" | "naver" | "11st" | "gmarket" | "compuzone" | "seorinexpress" | "ssg";

export type OutboundLink = {
  code: string;
  merchant: Merchant;
  originalUrl: string;
};

/**
 * PC 수집기가 생성하고 GitHub/Vercel 배포에 포함하는 이동주소 표입니다.
 * KV 연결이 없어도 가격표의 /go 링크가 동작합니다.
 */
export const OUTBOUND_LINKS = generatedOutbound as Record<string, OutboundLink>;
