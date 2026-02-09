import type { PriceCategoryKey } from "./priceCategories";

export type PriceItem = {
  id: string;
  name: string;
  spec?: string;
  price: number; // KRW
  low7d?: number;
  low30d?: number;
  change24hPct?: number; // e.g. -1.2
  url?: string;
  goCode?: string;
  source?: string;
  updatedAt?: string;
};

export type PricesPayload = {
  category: PriceCategoryKey;
  updatedAt: string; // ISO
  items: PriceItem[];
};

export type MetaPayload = {
  updatedAt: string; // ISO
  schedule: string; // human-readable
  note?: string;
};

const nowIso = new Date().toISOString();

const baseItems = (prefix: string): PriceItem[] => [
  {
    id: `${prefix}-sample-1`,
    name: "샘플 상품 1",
    spec: "예시 스펙",
    price: 129000,
    low7d: 125000,
    low30d: 119000,
    change24hPct: -0.8,
    url: "https://example.com",
    source: "sample",
    updatedAt: nowIso,
  },
  {
    id: `${prefix}-sample-2`,
    name: "샘플 상품 2",
    spec: "예시 스펙",
    price: 89000,
    low7d: 88000,
    low30d: 85000,
    change24hPct: 0.6,
    url: "https://example.com",
    source: "sample",
    updatedAt: nowIso,
  },
];

const MOCK: Record<PriceCategoryKey, PricesPayload> = {
  ram: { category: "ram", updatedAt: nowIso, items: baseItems("ram") },
  cpu: { category: "cpu", updatedAt: nowIso, items: baseItems("cpu") },
  ssd: { category: "ssd", updatedAt: nowIso, items: baseItems("ssd") },
  motherboard: { category: "motherboard", updatedAt: nowIso, items: baseItems("motherboard") },
  gpu: { category: "gpu", updatedAt: nowIso, items: baseItems("gpu") },
  cooler: { category: "cooler", updatedAt: nowIso, items: baseItems("cooler") },
  halfpc: { category: "halfpc", updatedAt: nowIso, items: baseItems("halfpc") },
  fullpc: { category: "fullpc", updatedAt: nowIso, items: baseItems("fullpc") },
};

export function getMockPrices(category: PriceCategoryKey): PricesPayload {
  return MOCK[category];
}

export function getMockMeta(): MetaPayload {
  return {
    updatedAt: nowIso,
    schedule: "매일 09:00 / 17:00 갱신",
    note: "API가 준비되기 전까지는 샘플 데이터가 표시됩니다.",
  };
}
