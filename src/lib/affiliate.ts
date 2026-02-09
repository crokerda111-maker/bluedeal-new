import type { Merchant } from "./outbound";

/**
 * /go는 오픈리다이렉트 악용 위험이 있어서
 * 허용 도메인(whitelist) 기반으로만 외부로 내보냅니다.
 */
const ALLOWED_HOSTS: RegExp[] = [
  /(^|\.)coupang\.com$/i,
  /(^|\.)aliexpress\.com$/i,
  /(^|\.)11st\.co\.kr$/i,
  /(^|\.)gmarket\.co\.kr$/i,
  /(^|\.)naver\.com$/i,
  /(^|\.)smartstore\.naver\.com$/i,
];

export function isAllowedHost(hostname: string) {
  const h = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((re) => re.test(h));
}

/**
 * merchant별 제휴 링크 변환기 (MVP: 틀만 구성)
 * - 실제 운영에서는 각 제휴 프로그램 스펙에 맞게 구현/검증해야 합니다.
 */
export function convertToAffiliateUrl(opts: { merchant: Merchant; originalUrl: string; code: string }) {
  const { merchant, originalUrl, code } = opts;

  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!isAllowedHost(host)) return null;

  // ⚠️ 아래는 예시/틀입니다. 실제 파라미터는 네 제휴 설정값으로 교체하세요.
  if (merchant === "coupang") {
    const tag = process.env.COUPANG_LPTAG; // 예: "AF1234567"
    if (tag) {
      url.searchParams.set("lptag", tag);
      url.searchParams.set("subid", code);
    }
    return url.toString();
  }

  if (merchant === "aliexpress") {
    // TODO: 알리 제휴 링크 규칙 반영
    return url.toString();
  }

  if (merchant === "naver") {
    // TODO: 네이버/스마트스토어 제휴 링크 규칙 반영
    return url.toString();
  }

  if (merchant === "11st") {
    // TODO: 11번가 제휴 링크 규칙 반영
    return url.toString();
  }

  if (merchant === "gmarket") {
    // TODO: 지마켓 제휴 링크 규칙 반영
    return url.toString();
  }

  return url.toString();
}
