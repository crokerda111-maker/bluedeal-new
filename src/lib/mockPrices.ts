import type { PriceCategoryKey } from "./priceCategories";

export type PriceItem = {
  id: string;
  name: string;
  spec?: string;
  price: number; // KRW
  low7d?: number | null;
  low30d?: number | null;
  change24hPct?: number | null; // e.g. -1.2
  /** 수집 원주소. 화면의 구매 버튼에는 직접 사용하지 않고 /go 등록 입력으로만 사용합니다. */
  url?: string;
  /** 공개 구매 버튼에 사용하는 블루딜 내부 리다이렉트 코드 */
  goCode?: string;
  source?: string;
  seller?: string;
  shippingFee?: number | null;
  shippingNote?: string;
  priceNote?: string;
  instantPrice?: number;
  instantNote?: string;
  instantStartsOn?: string;
  instantEndsOn?: string;
  instantEndsAt?: string;
  couponPrice?: number;
  couponNote?: string;
  couponStartsOn?: string;
  couponEndsOn?: string;
  couponEndsAt?: string;
  cardPrice?: number;
  cardNote?: string;
  cardStartsOn?: string;
  cardEndsOn?: string;
  cardEndsAt?: string;
  cardRequiresCoupon?: boolean;
  officialUrl?: string | null;
  /** RAM 키트 총용량, SSD 판매 용량 또는 GPU의 그래픽 메모리 용량(GB). */
  capacityGB?: number;
  memoryType?: "DDR4" | "DDR5";
  moduleCapacityGB?: number;
  moduleCount?: number;
  ssdDram?: "present" | "absent" | "unknown";
  availability?: "in-stock" | "out-of-stock" | "unknown";
  checkedAt?: string;
  updatedAt?: string;
};

export type PricesPayload = {
  category: PriceCategoryKey;
  updatedAt: string; // ISO
  generatedAt?: string; // 파일 생성 시각. 실제 가격 확인 시각과 구분합니다.
  items: PriceItem[];
};

export type MetaPayload = {
  updatedAt: string; // ISO
  generatedAt?: string;
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
  psu: { category: "psu", updatedAt: "", items: [] },
  case: { category: "case", updatedAt: "", items: [] },
  hdd: { category: "hdd", updatedAt: "", items: [] },
};

export function getMockPrices(category: PriceCategoryKey): PricesPayload {
  return MOCK[category];
}

export function getMockMeta(): MetaPayload {
  return {
    updatedAt: nowIso,
    schedule: "매일 09:00 / 17:00 갱신",
    note: "데이터 수집/정리 중입니다. 곧 업데이트됩니다.",
  };
}
