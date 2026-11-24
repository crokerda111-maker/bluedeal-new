import type { Post } from "./postTypes";

export const HOTDEAL_AUTHOR = "블루딜 AI";

export const HOTDEAL_CATEGORIES = [
  { value: "food", label: "식품" },
  { value: "living", label: "생활용품" },
  { value: "game", label: "게임" },
  { value: "pc", label: "PC" },
  { value: "appliance", label: "가전" },
  { value: "fashion", label: "의류" },
  { value: "beauty", label: "뷰티" },
  { value: "sports", label: "스포츠·레저" },
  { value: "kids", label: "육아·완구" },
  { value: "etc", label: "기타" },
] as const;

export type HotdealCategory = (typeof HOTDEAL_CATEGORIES)[number]["value"];

export const HOTDEAL_MAX_PREMIUM = 3;
export type HotdealPriceEvidence = {
  low: number;
  count: number;
  basis: "history" | "market" | "both";
};

export type HotdealSourceReview = {
  name: string;
  url: string;
  publishedAt: string;
  basis: "price-comparison" | "published-discount";
};

export type VerifiedHotdeal = {
  checkedAt: string;
  validUntil: string;
  option: string;
  price: number;
  shipping: number;
  conditions: string;
  image?: string;
  sourceReview?: HotdealSourceReview;
  priceEvidence?: HotdealPriceEvidence;
  lowestIn30Days?: { observations: number };
};

export function hotdealCategory(value: unknown): HotdealCategory {
  if (["cpu", "gpu", "ssd", "ram", "monitor", "peripheral"].includes(String(value))) return "pc";
  return HOTDEAL_CATEGORIES.find(category => category.value === value)?.value ?? "etc";
}

export function isActiveHotdeal(deal: VerifiedHotdeal, now: number): boolean {
  return Date.parse(deal.checkedAt) <= now && now < Date.parse(deal.validUntil);
}

export function isRecommendedHotdeal(deal: VerifiedHotdeal | undefined, now: number): deal is VerifiedHotdeal & { priceEvidence: HotdealPriceEvidence } {
  if (!deal?.priceEvidence || !isActiveHotdeal(deal, now)) return false;
  const { low, count, basis } = deal.priceEvidence;
  return Number.isSafeInteger(low) && low > 0 && Number.isSafeInteger(count) &&
    (basis === "market" ? count >= 2 : basis === "history" ? count >= 3 : basis === "both" && count >= 5) &&
    (deal.price + deal.shipping) * 100 <= low * (100 + HOTDEAL_MAX_PREMIUM);
}

export function isFeaturedHotdeal(deal: VerifiedHotdeal | undefined, now: number): deal is VerifiedHotdeal {
  if (isRecommendedHotdeal(deal, now)) return true;
  if (!deal?.sourceReview || !isActiveHotdeal(deal, now)) return false;
  const published = Date.parse(deal.sourceReview.publishedAt);
  return published <= now && now - published < 86_400_000;
}

export function isHotdealAuthor(value: unknown): boolean {
  return typeof value === "string" && value.normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]/gu, "").toUpperCase() === "블루딜AI";
}

export function hotdealPrice(post: Post): string {
  if (post.hotdeal) return (post.hotdeal.price + post.hotdeal.shipping).toLocaleString("ko-KR") + "원";
  return typeof post.extra?.price === "string" ? post.extra.price : "";
}
