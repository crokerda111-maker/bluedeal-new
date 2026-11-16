import type { PriceItem } from "./mockPrices";
import type { PriceCategoryKey } from "./priceCategories";

export const PRICE_SORTS = {
  "total-asc": "배송비 포함 낮은순",
  "total-desc": "배송비 포함 높은순",
  "price-asc": "상품가 낮은순",
  "checked-desc": "최근 확인순",
} as const;

export type PriceFilters = {
  query: string;
  capacity: string;
  memory: string;
  dram: string;
  sort: keyof typeof PRICE_SORTS;
};

type Search = Record<string, string | string[] | undefined>;

export function readPriceFilters(search: Search): PriceFilters {
  const first = (key: string) => {
    const value = search[key];
    return typeof value === "string" ? value : value?.[0] ?? "";
  };
  const capacity = first("capacity");
  const sort = first("sort");
  return {
    query: first("q").trim().slice(0, 100),
    capacity: /^[1-9][0-9]{0,5}$/.test(capacity) ? capacity : "",
    memory: ["DDR4", "DDR5"].includes(first("memory")) ? first("memory") : "",
    dram: ["present", "absent", "unknown"].includes(first("dram")) ? first("dram") : "",
    sort: Object.hasOwn(PRICE_SORTS, sort) ? sort as PriceFilters["sort"] : "total-asc",
  };
}

export function filterPrices(items: PriceItem[], category: PriceCategoryKey, filters: PriceFilters): PriceItem[] {
  const query = filters.query.toLocaleLowerCase("ko-KR");
  return items.filter(item => {
    if (query && ![item.name, item.spec, item.source, item.seller].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(query)) return false;
    if (["ram", "ssd"].includes(category) && filters.capacity && item.capacityGB !== Number(filters.capacity)) return false;
    if (category === "ram" && filters.memory && item.memoryType !== filters.memory) return false;
    if (category === "ssd" && filters.dram && (item.ssdDram ?? "unknown") !== filters.dram) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === "checked-desc") {
      const timestamp = (item: PriceItem) => Date.parse(item.checkedAt || item.updatedAt || "") || 0;
      return timestamp(b) - timestamp(a) || a.id.localeCompare(b.id);
    }
    if (filters.sort === "price-asc") return a.price - b.price || a.id.localeCompare(b.id);
    const aKnown = typeof a.shippingFee === "number";
    const bKnown = typeof b.shippingFee === "number";
    // 배송비 미확인을 무료로 계산하지 않고, 금액을 아는 상품 다음에 표시합니다.
    if (aKnown !== bKnown) return aKnown ? -1 : 1;
    const delta = (a.price + (a.shippingFee ?? 0)) - (b.price + (b.shippingFee ?? 0));
    return (filters.sort === "total-desc" ? -delta : delta) || a.id.localeCompare(b.id);
  });
}

export function priceFreshness(item: PriceItem, now: number): "recent" | "stale" | "unknown" {
  const checked = Date.parse(item.checkedAt || item.updatedAt || "");
  if (!Number.isFinite(checked) || checked > now) return "unknown";
  return now - checked >= 24 * 60 * 60 * 1000 ? "stale" : "recent";
}
