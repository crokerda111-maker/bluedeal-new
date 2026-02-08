export type Merchant = "coupang" | "aliexpress" | "naver" | "11st" | "gmarket";

export type OutboundLink = {
  code: string;
  merchant: Merchant;
  originalUrl: string;
};

/**
 * MVP용 인메모리 매핑.
 * - 실제 운영에선 DB(outbound_links)로 교체
 * - originalUrl을 실제 상품 URL로 채워 넣으면 /go/{code}가 리다이렉트 됨
 */
export const OUTBOUND_LINKS: Record<string, OutboundLink> = {
  d1: {
    code: "d1",
    merchant: "coupang",
    originalUrl: "https://www.coupang.com/", // TODO 실제 상품 URL로 교체
  },
  d2: {
    code: "d2",
    merchant: "aliexpress",
    originalUrl: "https://www.aliexpress.com/",
  },
  d3: {
    code: "d3",
    merchant: "11st",
    originalUrl: "https://www.11st.co.kr/",
  },
  d4: {
    code: "d4",
    merchant: "gmarket",
    originalUrl: "https://www.gmarket.co.kr/",
  },
};
