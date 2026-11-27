import "server-only";

import { createHash } from "node:crypto";
import { detectMerchant, normalizeOutboundUrl } from "./affiliate";
import { reviewedDealPhoto } from "./hotdealImages";
import { GMARKET_BLACK_FRIDAY } from "./gmarketBlackFriday";
import { HOTDEAL_AUTHOR, HOTDEAL_CATEGORIES, HOTDEAL_MAX_PREMIUM, type CoupangTrackedLow, type HotdealSourceReview, type VerifiedHotdeal } from "./hotdeal";
import { createOnlinePost } from "./onlinePosts";
import { createOrReuseOutboundCode, getOutboundRow } from "./onlineOutbound";
import { PostValidationError } from "./postInput";
import type { Merchant } from "./outbound";

const STORE_LABELS: Partial<Record<Merchant, string>> = {
  coupang: "쿠팡", aliexpress: "알리익스프레스", "11st": "11번가", gmarket: "G마켓",
  auction: "옥션", ssg: "SSG", lotteon: "롯데온", ohou: "오늘의집", naver: "네이버쇼핑", compuzone: "컴퓨존",
};
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new PostValidationError(label + " 항목을 확인해 주세요.");
  }
  return value.trim();
}

function verifiedPrice(value: unknown, min: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > 100_000_000) {
    throw new PostValidationError("가격과 배송비는 원화 정수로 입력해 주세요.");
  }
  return value;
}

function verifiedDate(value: unknown): number {
  const iso = requiredText(value, "확인 시각", 35);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(iso) || !Number.isFinite(Date.parse(iso))) {
    throw new PostValidationError("확인 시각과 만료 시각에는 시간대를 지정해 주세요.");
  }
  return Date.parse(iso);
}

function sourceLink(value: unknown): string {
  const href = requiredText(value, "참고 출처", 1200);
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && !/\s/.test(href)) return href;
  } catch { /* Invalid URLs are rejected below. */ }
  throw new PostValidationError("공개 HTTPS 출처를 입력해 주세요.");
}

function reviewedSource(input: unknown, checked: number, until: number, merchant: Merchant): HotdealSourceReview {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PostValidationError("외부 핫딜의 출처와 조건을 확인해 주세요.");
  const record = input as Record<string, unknown>;
  const url = new URL(sourceLink(record.url));
  const { basis } = record;
  const published = verifiedDate(record.publishedAt);
  if (record.status !== "listed" || (basis !== "price-comparison" && basis !== "published-discount") ||
      published > checked || until > published + DAY) {
    throw new PostValidationError("종료되지 않은 최근 24시간 내 원글에 가격 비교 또는 할인 근거가 필요합니다.");
  }
  const path = url.pathname;
  let name: string | undefined;
  if (url.hostname === "hotdeal.zip" && /^\/[^/]+-[a-z\d]{4,8}\/?$/i.test(path)) name = "핫딜모음";
  if (url.hostname === "quasarzone.com" && /^\/bbs\/qb_saleinfo\/views\/\d+\/?$/.test(path)) name = "퀘이사존";
  if (url.hostname === "www.ppomppu.co.kr" && path === "/zboard/view.php" &&
      url.searchParams.get("id") === "ppomppu" && /^\d+$/.test(url.searchParams.get("no") ?? "")) name = "뽐뿌";
  if (url.hostname === "gall.dcinside.com" && path === "/mgallery/board/view/" &&
      ["desktopcomputer", "hotdeal1"].includes(url.searchParams.get("id") ?? "") &&
      /^\d+$/.test(url.searchParams.get("no") ?? "")) name = "디시인사이드";
  if (merchant === "gmarket" && url.href === GMARKET_BLACK_FRIDAY.officialUrl && basis === "published-discount" &&
      published >= GMARKET_BLACK_FRIDAY.startsAt && until <= GMARKET_BLACK_FRIDAY.endsAt) name = "G마켓 공식 행사관";
  if (!name) throw new PostValidationError("지원하는 공개 핫딜 원글의 상세 주소를 입력해 주세요.");
  url.hash = "";
  return { name, url: url.href, publishedAt: new Date(published).toISOString(), basis };
}

function directListing(url: URL, merchant: Merchant) {
  const path = url.pathname;
  const query = url.searchParams;
  switch (merchant) {
    case "coupang": return url.hostname === "www.coupang.com" && /^\/vp\/products\/\d+$/.test(path) &&
      /^\d+$/.test(query.get("itemId") ?? "") && /^\d+$/.test(query.get("vendorItemId") ?? "");
    case "11st": return /^\/products\/\d+\/?$/.test(path) || /^\d+$/.test(query.get("prdNo") ?? "");
    case "gmarket": return /^\/Item\/?$/i.test(path) &&
      [...query].some(([key, value]) => key.toLowerCase() === "goodscode" && /^\d+$/.test(value));
    case "auction": return /^\/DetailView\.aspx$/i.test(path) && /^[a-z]?\d+$/i.test(query.get("itemno") ?? "");
    case "aliexpress": return /^\/item\/\d+\.html$/.test(path);
    case "ssg": return /^\d+$/.test(query.get("itemId") ?? "");
    case "lotteon": return /^\/p\/product\/\w+\/?$/.test(path);
    case "ohou": return /^\/goods\/\d+\/?$/.test(path);
    case "naver": return /^\/[^/]+\/products\/\d+\/?$/.test(path);
    case "compuzone": return ["www.compuzone.co.kr", "m.compuzone.co.kr"].includes(url.hostname) &&
      path.toLowerCase() === "/product/product_detail.htm" &&
      query.getAll("ProductNo").length === 1 && /^\d+$/.test(query.get("ProductNo") ?? "");
    default: return false;
  }
}

function reviewedCoupangTracker(value: unknown, product: URL, price: number, checked: number, until: number): CoupangTrackedLow {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PostValidationError("쿠팡 가격 관측 근거를 확인해 주세요.");
  const input = value as Record<string, unknown>;
  const url = new URL(sourceLink(input.url));
  const trackedAt = verifiedDate(input.checkedAt);
  const productId = product.pathname.split("/").at(-1);
  if (product.searchParams.getAll("itemId").length !== 1 || product.searchParams.getAll("vendorItemId").length !== 1 ||
      url.hostname !== "www.lowchart.com" || url.pathname !== `/${productId}-${product.searchParams.get("itemId")}` ||
      url.search || url.hash || input.observedLow !== price || trackedAt > checked || checked - trackedAt > 2 * HOUR || until - checked > 6 * HOUR) {
    throw new PostValidationError("같은 쿠팡 상품·옵션의 관측 최저가와 실제 상품가가 일치해야 합니다.");
  }
  return { url: url.href, checkedAt: new Date(trackedAt).toISOString() };
}

function comparePrices(input: Record<string, unknown>, deal: VerifiedHotdeal, originalUrl: string, merchant: Merchant, checked: number, now: number) {
  const comparableDays = new Map<string, { total: number; url: string }>();
  const otherStores = new Map<Merchant, { total: number; url: string }>();
  const checkedDay = new Date(checked + 9 * HOUR).toISOString().slice(0, 10);
  const observations: unknown[] = Array.isArray(input.priceHistory) ? input.priceHistory.slice(0, 45) : [];
  for (const observation of observations) {
    if (!observation || typeof observation !== "object") continue;
    const above = observation as Record<string, unknown>;
    if (above.option !== deal.option || above.conditions !== deal.conditions || above.availability !== "in-stock") continue;
    const at = verifiedDate(above.at);
    if (at > now || at < checked - 30 * DAY) continue;
    const url = normalizeOutboundUrl(sourceLink(above.productUrl));
    if (!url) continue;
    const observedUrl = new URL(url);
    const store = detectMerchant(observedUrl.hostname);
    if (!store || !directListing(observedUrl, store)) continue;
    const total = verifiedPrice(above.price, 1) + verifiedPrice(above.shipping, 0);
    const day = new Date(at + 9 * HOUR).toISOString().slice(0, 10);
    if (url === originalUrl && at < checked && day !== checkedDay) {
      if (total < (comparableDays.get(day)?.total ?? Infinity)) comparableDays.set(day, { total, url });
    } else if (store !== merchant && input.publicPrice === true && above.publicPrice === true && now - at <= 6 * HOUR) {
      if (total < (otherStores.get(store)?.total ?? Infinity)) otherStores.set(store, { total, url });
    }
  }

  const history = comparableDays.size >= 3;
  const market = otherStores.size >= 2;
  if (!history && !market) {
    throw new PostValidationError("같은 모델·옵션·구매 조건의 최근 30일 가격 기록 3일 또는 6시간 이내 다른 판매처 2곳의 공개 가격이 필요합니다.");
  }
  const historyOffers = [...comparableDays.values()];
  const marketOffers = [...otherStores.values()];
  const total = deal.price + deal.shipping;
  const strictLow = Math.min(...[...historyOffers, ...marketOffers].map(row => row.total));
  if (total * 100 > strictLow * (100 + HOTDEAL_MAX_PREMIUM)) {
    throw new PostValidationError(`배송비를 포함하면 확인한 최저가보다 ${HOTDEAL_MAX_PREMIUM}% 넘게 높습니다.`);
  }
  const eligible = [...(history ? historyOffers : []), ...(market ? marketOffers : [])];
  const low = eligible.reduce((best, row) => row.total < best.total ? row : best);
  deal.priceEvidence = {
    low: low.total,
    count: eligible.length,
    basis: history && market ? "both" : history ? "history" : "market",
  };
  if (merchant === "coupang" && history && total <= Math.min(...historyOffers.map(row => row.total))) {
    deal.lowestIn30Days = { observations: comparableDays.size + 1 };
  }
  return low.url;
}

export async function publishVerifiedHotdeal(input: Record<string, unknown>) {
  const now = Date.now();
  const checked = verifiedDate(input.checkedAt);
  const until = verifiedDate(input.validUntil);
  const curated = input.sourceReview !== undefined;
  const tracked = input.coupangTrackedLow !== undefined;
  if (input.availability !== (curated ? "source-listed" : "in-stock") || now - checked > 6 * HOUR || checked > now ||
      until <= now || until > checked + DAY) {
    throw new PostValidationError("최근 6시간 이내 판매 확인과 최대 24시간의 유효 기간이 필요합니다.");
  }
  const title = requiredText(input.title, "상품명", 140);
  const option = requiredText(input.option, "상품 옵션", 150);
  const conditions = requiredText(input.conditions, "할인 조건", 600);
  const review = requiredText(input.review, curated ? "구성·행사 요약" : "후기 또는 확인된 장점", 600);
  const issue = requiredText(input.issue, "구매 전 확인 사항", 600);
  const category = HOTDEAL_CATEGORIES.find(item => item.value === input.category)?.value;
  if (!category) throw new PostValidationError("상품 분류를 선택해 주세요.");

  const price = verifiedPrice(input.price, 1);
  const shipping = verifiedPrice(input.shipping, 0);
  const originalUrl = normalizeOutboundUrl(sourceLink(input.productUrl));
  const merchant = originalUrl && detectMerchant(new URL(originalUrl).hostname);
  if (!originalUrl || !merchant || !STORE_LABELS[merchant]) {
    throw new PostValidationError("연결 가능한 공식 판매처의 상품 주소를 입력해 주세요.");
  }
  const sourceReview = curated ? reviewedSource(input.sourceReview, checked, until, merchant) : undefined;
  if (merchant === "coupang") {
    if (!directListing(new URL(originalUrl), merchant)) {
      throw new PostValidationError("쿠팡 상품은 실제 확인한 옵션과 판매자 식별자가 포함된 주소가 필요합니다.");
    }
  } else if (!directListing(new URL(originalUrl), merchant)) {
    throw new PostValidationError("검색 결과나 스토어 홈 대신 개별 상품 페이지 주소가 필요합니다.");
  }
  if (tracked && (curated || merchant !== "coupang" || input.publicPrice !== true)) {
    throw new PostValidationError("쿠팡 가격 관측 근거는 일반 판매가와 직접 대조한 경우에만 등록할 수 있습니다.");
  }
  const coupangTrackedLow = tracked ? reviewedCoupangTracker(input.coupangTrackedLow, new URL(originalUrl), price, checked, until) : undefined;
  const notesSource = sourceReview?.url ?? coupangTrackedLow?.url ?? sourceLink(input.notesSource);
  const image = reviewedDealPhoto(input.image, merchant, new URL(originalUrl));
  if (image === null) throw new PostValidationError("판매 주소와 일치하는 검증 상품 사진을 확인해 주세요.");
  const hotdeal: VerifiedHotdeal = {
    checkedAt: new Date(checked).toISOString(), validUntil: new Date(until).toISOString(),
    option, price, shipping, conditions, image, sourceReview, coupangTrackedLow,
  };
  const comparisonSource = sourceReview || coupangTrackedLow ? undefined : comparePrices(input, hotdeal, originalUrl, merchant, checked, now);
  const code = await createOrReuseOutboundCode(originalUrl);
  const row = code ? await getOutboundRow(code) : null;
  if (!code || row?.originalUrl !== originalUrl || row.merchant !== merchant) {
    throw new Error("Outbound product could not be verified");
  }

  const dealIdentity = createHash("sha256").update(JSON.stringify([
    originalUrl, option.toLowerCase().replace(/\s+/g, ""), price, shipping,
    new Date(checked + 9 * HOUR).toISOString().slice(0, 10),
  ])).digest("hex").slice(0, 32);
  const { post, created } = await createOnlinePost({
    boardKey: "hotdeal",
    type: "general",
    title,
    authorName: HOTDEAL_AUTHOR,
    content: (sourceReview ? "구성·행사 요약\n" : "후기·확인된 장점\n") + review + "\n\n구매 전 확인사항\n" + issue,
    extra: {
      category,
      store: STORE_LABELS[merchant],
      dealLink: "/go/" + code,
      notesSource,
      comparisonSource,
    },
  }, { id: "deal-" + dealIdentity, hotdeal });
  return { id: post.id, created };
}
