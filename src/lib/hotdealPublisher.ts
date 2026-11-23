import "server-only";

import { createHash } from "node:crypto";
import { detectMerchant, normalizeOutboundUrl, resolveAffiliateUrl } from "./affiliate";
import { getStoredAffiliateMappings } from "./affiliateStore";
import { HOTDEAL_AUTHOR, HOTDEAL_CATEGORIES, type VerifiedHotdeal } from "./hotdeal";
import { createOnlinePost } from "./onlinePosts";
import { createOrReuseOutboundCode, getOutboundRow } from "./onlineOutbound";
import { PostValidationError } from "./postInput";
import type { Merchant } from "./outbound";

const STORE_LABELS: Partial<Record<Merchant, string>> = {
  coupang: "쿠팡", aliexpress: "알리익스프레스", "11st": "11번가", gmarket: "G마켓",
  auction: "옥션", ssg: "SSG", lotteon: "롯데온", ohou: "오늘의집", naver: "네이버쇼핑",
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

export async function publishVerifiedHotdeal(input: Record<string, unknown>) {
  const now = Date.now();
  const checked = verifiedDate(input.checkedAt);
  const until = verifiedDate(input.validUntil);
  if (input.availability !== "in-stock" || now - checked > 6 * HOUR || checked > now ||
      until <= now || until > checked + DAY) {
    throw new PostValidationError("최근 6시간 이내 판매 확인과 최대 24시간의 유효 기간이 필요합니다.");
  }
  const title = requiredText(input.title, "상품명", 140);
  const option = requiredText(input.option, "상품 옵션", 150);
  const conditions = requiredText(input.conditions, "할인 조건", 600);
  const review = requiredText(input.review, "후기 또는 확인된 장점", 600);
  const issue = requiredText(input.issue, "구매 전 확인 사항", 600);
  const notesSource = sourceLink(input.notesSource);
  const category = HOTDEAL_CATEGORIES.find(item => item.value === input.category)?.value;
  if (!category) throw new PostValidationError("상품 분류를 선택해 주세요.");

  const price = verifiedPrice(input.price, 1);
  const shipping = verifiedPrice(input.shipping, 0);
  const originalUrl = normalizeOutboundUrl(sourceLink(input.productUrl));
  const merchant = originalUrl && detectMerchant(new URL(originalUrl).hostname);
  if (!originalUrl || !merchant || !STORE_LABELS[merchant]) {
    throw new PostValidationError("연결 가능한 공식 판매처의 상품 주소를 입력해 주세요.");
  }
  if (merchant === "coupang") {
    const url = new URL(originalUrl);
    if (url.hostname !== "www.coupang.com" || !/^\/vp\/products\/\d+$/.test(url.pathname) ||
        !/^\d+$/.test(url.searchParams.get("itemId") ?? "") || !/^\d+$/.test(url.searchParams.get("vendorItemId") ?? "")) {
      throw new PostValidationError("쿠팡 상품은 실제 확인한 옵션과 판매자 식별자가 포함된 주소가 필요합니다.");
    }
  }
  const mapping = (await getStoredAffiliateMappings([originalUrl])).get(originalUrl);
  const target = resolveAffiliateUrl({ merchant, originalUrl, code: "" }, mapping);
  if (target?.mode !== "registered-affiliate") {
    throw new PostValidationError("동일 상품·옵션에 등록된 블루딜 공식 제휴 링크가 필요합니다.");
  }
  const code = await createOrReuseOutboundCode(originalUrl, true);
  const row = code ? await getOutboundRow(code) : null;
  if (!code || row?.originalUrl !== originalUrl || row.merchant !== merchant) {
    throw new Error("Outbound product could not be verified");
  }

  const hotdeal: VerifiedHotdeal = {
    checkedAt: new Date(checked).toISOString(), validUntil: new Date(until).toISOString(),
    option, price, shipping, conditions,
  };

  // Compare only earlier public prices for this exact option and purchase basis.
  if (merchant === "coupang" && input.comparisonSource !== undefined && Array.isArray(input.priceHistory)) {
    const comparisonSource = sourceLink(input.comparisonSource);
    const history = input.priceHistory.slice(0, 31);
    const comparableDays = new Map<string, number>();
    for (const observation of history) {
      if (!observation || typeof observation !== "object" || observation.option !== option || observation.conditions !== conditions) continue;
      const at = verifiedDate(observation.at);
      if (at >= checked || at < checked - 30 * DAY) continue;
      const day = new Date(at + 9 * HOUR).toISOString().slice(0, 10);
      const total = verifiedPrice(observation.price, 1) + verifiedPrice(observation.shipping, 0);
      comparableDays.set(day, Math.min(comparableDays.get(day) ?? total, total));
    }
    if (comparableDays.size >= 3 && price + shipping <= Math.min(...comparableDays.values())) {
      hotdeal.lowestIn30Days = { observations: comparableDays.size + 1 };
      input = { ...input, comparisonSource };
    }
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
    content: "후기·확인된 장점\n" + review + "\n\n구매 전 확인사항\n" + issue,
    extra: {
      category,
      store: STORE_LABELS[merchant],
      dealLink: "/go/" + code,
      notesSource,
      comparisonSource: hotdeal.lowestIn30Days ? String(input.comparisonSource) : undefined,
    },
  }, { id: "deal-" + dealIdentity, hotdeal });
  return { id: post.id, created };
}
