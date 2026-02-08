export type Deal = {
  id: string;
  title: string;
  price: number; // 숫자로 관리(정렬/필터 쉬움)
  priceLabel: string;
  shippingLabel: string;
  store: string;
  /** 카테고리(핫딜 분류) */
  category: string;
  tag?: "HOT" | "쿠폰" | "역대가" | "한정" | "빠름";
  heat: number; // 0~100
  minutesAgo: number;
  source: "퀘" | "조드" | "기타";
  sourceUrl: string;
  goUrl: string; // /go/{id} 같은 내부 링크(제휴로 리다이렉트)
  bullets: string[]; // 템플릿 요약
};

export const DEALS: Deal[] = [
  {
    id: "d1",
    title: "NVMe SSD 2TB (PCIe 4.0) 역대가 근처 — TLC / DRAM 유무 확인",
    price: 129000,
    priceLabel: "₩129,000",
    shippingLabel: "무료배송",
    store: "쿠팡",
    category: "PC부품",
    tag: "HOT",
    heat: 96,
    minutesAgo: 3,
    source: "퀘",
    sourceUrl: "#",
    goUrl: "/go/d1",
    bullets: ["장점: 가격대 상위권", "주의: 컨트롤러/낸드 확인", "대체: 1TB×2 구성도 고려"],
  },
  {
    id: "d2",
    title: "게이밍 마우스 58g급 — 그립/클릭압 취향 갈림",
    price: 39900,
    priceLabel: "₩39,900",
    shippingLabel: "배송비 ₩2,500",
    store: "알리",
    category: "주변기기",
    tag: "쿠폰",
    heat: 82,
    minutesAgo: 12,
    source: "조드",
    sourceUrl: "#",
    goUrl: "/go/d2",
    bullets: ["장점: 무게/센서 스펙", "주의: QC 편차/AS", "팁: 쿠폰 중복 여부 체크"],
  },
  {
    id: "d3",
    title: "27인치 QHD 165Hz — 가성비 라인(불량정책/패널타입 확인)",
    price: 219000,
    priceLabel: "₩219,000",
    shippingLabel: "무료배송",
    store: "11번가",
    category: "모니터",
    tag: "역대가",
    heat: 74,
    minutesAgo: 25,
    source: "퀘",
    sourceUrl: "#",
    goUrl: "/go/d3",
    bullets: ["장점: 해상도/주사율 밸런스", "주의: 패널/스탠드 구성", "대체: 24FHD 고주사율"],
  },
  {
    id: "d4",
    title: "듀얼타워 공랭쿨러 — 간섭/램높이/케이스폭 체크",
    price: 29800,
    priceLabel: "₩29,800",
    shippingLabel: "무료배송",
    store: "지마켓",
    category: "PC부품",
    tag: "빠름",
    heat: 67,
    minutesAgo: 41,
    source: "기타",
    sourceUrl: "#",
    goUrl: "/go/d4",
    bullets: ["장점: 가격 대비 성능", "주의: 높이/간섭", "팁: 팬 추가 시 소음 확인"],
  },
];

export const CATEGORIES = [
  "PC부품",
  "주변기기",
  "노트북/태블릿",
  "모니터",
  "가전",
  "생활/식품",
  "게임",
  "소프트웨어",
];

export const KEYWORDS = ["DDR5 6000", "B850", "NVMe 2TB", "QHD 165", "58g 마우스", "쿨러 간섭", "쿠폰", "역대가"];
