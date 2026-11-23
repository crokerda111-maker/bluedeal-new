import type { Merchant, OutboundLink } from "./outbound";

type MerchantRule = {
  merchant: Merchant;
  hosts: RegExp[];
  affiliateHosts?: RegExp[];
};

const MERCHANT_RULES: MerchantRule[] = [
  { merchant: "ohou", hosts: [/^store\.ohou\.se$/i] },
  { merchant: "redbitmall", hosts: [/^www\.redbitmall\.com$/i] },
  { merchant: "darkflash", hosts: [/(^|\.)darkflash\.co\.kr$/i] },
  { merchant: "lotteon", hosts: [/(^|\.)lotteon\.com$/i] },
  { merchant: "icoda", hosts: [/(^|\.)icoda\.co\.kr$/i] },
  { merchant: "ssg", hosts: [/(^|\.)ssg\.com$/i] },
  { merchant: "auction", hosts: [/^itempage3\.auction\.co\.kr$/i] },
  { merchant: "compuzone", hosts: [/(^|\.)compuzone\.co\.kr$/i] },
  { merchant: "seorinexpress", hosts: [/(^|\.)seorinexpress\.com$/i] },
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

export type AffiliateResolutionMode = "registered-affiliate" | "already-affiliate" | "passthrough";

export type AffiliateResolution = {
  merchant: Merchant;
  url: string;
  mode: AffiliateResolutionMode;
};

export type AffiliateMapping = {
  merchant: Merchant;
  originalUrl: string;
  provider: string;
  affiliateUrl: string;
  code?: string;
};

const LINKPRICE_ADVERTISERS: Partial<Record<Merchant, string>> = {
  gmarket: "gmarket",
  auction: "auction",
  "11st": "11st",
  lotteon: "lotteon",
  ssg: "emart",
};

export function supportsLinkPrice(merchant: Merchant | null): boolean {
  return merchant !== null && Object.hasOwn(LINKPRICE_ADVERTISERS, merchant);
}

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

function registeredEntries(): Record<string, unknown>[] {
  const raw = process.env.AFFILIATE_LINKS_JSON;
  if (!raw || raw.length > 60000) return [];
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(entries) || entries.length > 100) return [];
  return entries.filter((entry: unknown): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
}

/** 공식 발급 주소를 원본 상품/판매처와 별도로 연결합니다. */
function registeredAffiliateUrl(merchant: Merchant, originalUrl: string): string | null {
  const matches = registeredEntries().filter((row) => {
    return row.merchant === merchant && typeof row.originalUrl === "string"
      && normalizeOutboundUrl(row.originalUrl) === originalUrl;
  });
  // 중복·충돌한 설정은 선택하지 않고 원래 판매처 주소를 사용합니다.
  if (matches.length !== 1) return null;
  return parseAffiliateMapping(matches[0])?.affiliateUrl ?? null;
}

export function parseAffiliateMapping(value: unknown): AffiliateMapping | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.originalUrl !== "string" || typeof row.provider !== "string") return null;
  const originalUrl = normalizeOutboundUrl(row.originalUrl);
  if (!originalUrl) return null;
  const merchant = detectMerchant(new URL(originalUrl).hostname);
  if (!merchant || row.merchant !== merchant) return null;
  const code = row.code;
  if (code !== undefined && (typeof code !== "string" || !/^[a-zA-Z0-9_-]{2,64}$/.test(code))) return null;
  if (typeof row.affiliateUrl !== "string" || /[\u0000-\u0020\u007f]/.test(row.affiliateUrl)) return null;
  let target: URL;
  try { target = new URL(row.affiliateUrl); } catch { return null; }
  if (target.protocol !== "https:" || target.username || target.password || target.port || target.hash) return null;

  if (row.provider === "linkprice" && supportsLinkPrice(merchant)) {
    // 공유 단축 호스트를 일반 입력 허용 목록에 넣으면 판매처를 판별할 수 없습니다.
    // 정확한 원본 상품과 매칭한 서버 설정에서만 이 호스트를 허용합니다.
    const shortLink = (merchant === "gmarket" || merchant === "11st") && target.hostname === "app.ac" && !target.search
      && /^\/[a-zA-Z0-9_-]{6,64}$/.test(target.pathname);
    const keys = [...target.searchParams.keys()];
    const allowedKeys = new Set(["m", "a", "l", "l_cd1", "l_cd2", "tu"]);
    // The official 11st hotdeal feed issues links with this source marker.
    if (merchant === "11st" && target.searchParams.get("s") === "mpage") allowedKeys.add("s");
    // 공식 긴 주소도 등록한 원본 상품과 광고주가 정확히 일치할 때만 허용합니다.
    // 중복 매개변수는 제휴처와 URL 파서의 해석 차이를 막기 위해 거부합니다.
    const directLink = target.hostname === "click.linkprice.com" && target.pathname === "/click.php"
      && keys.length === new Set(keys).size && keys.every(key => allowedKeys.has(key))
      && target.searchParams.get("m") === LINKPRICE_ADVERTISERS[merchant]
      && /^[a-zA-Z0-9_-]{1,64}$/.test(target.searchParams.get("a") ?? "")
      && normalizeOutboundUrl(target.searchParams.get("tu") ?? "") === originalUrl;
    if (!shortLink && !directLink) return null;
  } else if (row.provider !== merchant || !isAffiliateHost(merchant, target.hostname)) {
    return null;
  }
  return { merchant, originalUrl, provider: row.provider, affiliateUrl: target.toString(), code };
}

export function legacyAffiliateMappings(): AffiliateMapping[] {
  return registeredEntries().flatMap(row => {
    const mapping = parseAffiliateMapping(row);
    if (!mapping || !registeredAffiliateUrl(mapping.merchant, mapping.originalUrl)) return [];
    if (mapping.code && !getRegisteredOutboundLink(mapping.code)) return [];
    return [mapping];
  });
}

/** 수동 발급 링크도 가격·상품 정보를 새로 만들지 않고 /go 주소로 등록합니다. */
export function getRegisteredOutboundLink(code: string): OutboundLink | null {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(code)) return null;
  const matches = registeredEntries().filter(row => row.code === code);
  if (matches.length !== 1) return null;
  const row = matches[0];
  if (typeof row.originalUrl !== "string") return null;
  const originalUrl = normalizeOutboundUrl(row.originalUrl);
  if (!originalUrl) return null;
  const merchant = detectMerchant(new URL(originalUrl).hostname);
  if (!merchant || row.merchant !== merchant || !registeredAffiliateUrl(merchant, originalUrl)) return null;
  return { code, merchant, originalUrl };
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
}, stored?: AffiliateMapping): AffiliateResolution | null {
  const { merchant, originalUrl } = opts;
  const normalized = normalizeOutboundUrl(originalUrl);
  if (!normalized) return null;

  const url = new URL(normalized);
  const detected = detectMerchant(url.hostname);
  if (detected !== merchant) return null;

  const registered = stored?.merchant === merchant && stored.originalUrl === normalized
    ? stored.affiliateUrl : registeredAffiliateUrl(merchant, normalized);
  if (registered) return { merchant, url: registered, mode: "registered-affiliate" };

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
