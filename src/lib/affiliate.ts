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

export type AffiliateResolutionMode = "converted" | "already-affiliate" | "passthrough";

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
  let url: URL;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
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
 * - 검증된 변환 설정이 있는 판매처만 실제 제휴 파라미터를 적용합니다.
 * - 설정이 없는 판매처는 임의 파라미터를 붙이지 않고 원주소를 유지합니다.
 */
export function resolveAffiliateUrl(opts: {
  merchant: Merchant;
  originalUrl: string;
  code: string;
}): AffiliateResolution | null {
  const { merchant, originalUrl, code } = opts;
  const normalized = normalizeOutboundUrl(originalUrl);
  if (!normalized) return null;

  const url = new URL(normalized);
  const detected = detectMerchant(url.hostname);
  if (detected !== merchant) return null;

  if (isAffiliateHost(merchant, url.hostname)) {
    return { merchant, url: url.toString(), mode: "already-affiliate" };
  }

  if (merchant === "coupang") {
    const tag = process.env.COUPANG_LPTAG?.trim();
    if (tag) {
      url.searchParams.set("lptag", tag);
      url.searchParams.set("subid", code);
      return { merchant, url: url.toString(), mode: "converted" };
    }
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
