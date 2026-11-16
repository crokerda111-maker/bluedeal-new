import type { Merchant } from "./outbound";

type MerchantRule = {
  merchant: Merchant;
  hosts: RegExp[];
  affiliateHosts?: RegExp[];
};

const MERCHANT_RULES: MerchantRule[] = [
  {
    merchant: "coupang",
    hosts: [/(^|\.)coupang\.com$/i, /(^|\.)link\.coupang\.com$/i],
    affiliateHosts: [/(^|\.)link\.coupang\.com$/i],
  },
  {
    merchant: "aliexpress",
    hosts: [
      /(^|\.)aliexpress\.com$/i,
      /(^|\.)aliexpress\.us$/i,
      /(^|\.)a\.aliexpress\.com$/i,
      /(^|\.)s\.click\.aliexpress\.com$/i,
    ],
    affiliateHosts: [/(^|\.)a\.aliexpress\.com$/i, /(^|\.)s\.click\.aliexpress\.com$/i],
  },
  {
    merchant: "11st",
    hosts: [/(^|\.)11st\.co\.kr$/i],
  },
  {
    merchant: "gmarket",
    hosts: [/(^|\.)gmarket\.co\.kr$/i],
  },
  {
    merchant: "naver",
    hosts: [
      /(^|\.)smartstore\.naver\.com$/i,
      /(^|\.)brand\.naver\.com$/i,
      /(^|\.)shopping\.naver\.com$/i,
    ],
  },
];

export type AffiliateResolutionMode = "already-affiliate" | "passthrough";

export type AffiliateResolution = {
  merchant: Merchant;
  url: string;
  mode: AffiliateResolutionMode;
};

function matchesAny(hostname: string, patterns: RegExp[] | undefined): boolean {
  return Boolean(patterns?.some((pattern) => pattern.test(hostname)));
}

export function detectMerchant(hostname: string): Merchant | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return MERCHANT_RULES.find((rule) => matchesAny(host, rule.hosts))?.merchant ?? null;
}

export function isAllowedHost(hostname: string): boolean {
  return detectMerchant(hostname) !== null;
}

export function isAffiliateHost(merchant: Merchant, hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  const rule = MERCHANT_RULES.find((item) => item.merchant === merchant);
  return matchesAny(host, rule?.affiliateHosts);
}

/**
 * 판매처와 프로토콜만 검증하고 제휴 추적값은 그대로 보존합니다.
 * 제휴 시스템에 따라 쿼리 순서나 일반 추적값도 실적 귀속에 쓰일 수 있기 때문입니다.
 */
export function normalizeOutboundUrl(raw: string): string | null {
  const value = String(raw).trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.port) return null;
  if (!detectMerchant(url.hostname)) return null;

  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hash = "";

  return url.toString();
}

/**
 * 클릭 시점에 최종 목적지를 결정합니다.
 *
 * - 이미 판매처의 공식 제휴/단축 호스트라면 링크를 훼손하지 않습니다.
 * - 일반 상품 주소에 제휴 파라미터를 추측해서 붙이지 않습니다.
 * - 공식 발급 주소를 등록해 사용하고 실제 귀속은 제휴처 리포트에서 확인합니다.
 */
export function resolveAffiliateUrl(opts: {
  merchant: Merchant;
  originalUrl: string;
  code: string;
}): AffiliateResolution | null {
  const { merchant, originalUrl } = opts;
  const normalized = normalizeOutboundUrl(originalUrl);
  if (!normalized) return null;

  const url = new URL(normalized);
  const detected = detectMerchant(url.hostname);
  if (detected !== merchant) return null;

  if (isAffiliateHost(merchant, url.hostname)) {
    return { merchant, url: url.toString(), mode: "already-affiliate" };
  }

  return { merchant, url: url.toString(), mode: "passthrough" };
}

export function convertToAffiliateUrl(opts: {
  merchant: Merchant;
  originalUrl: string;
  code: string;
}): string | null {
  return resolveAffiliateUrl(opts)?.url ?? null;
}
