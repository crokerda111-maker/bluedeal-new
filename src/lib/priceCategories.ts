export type PriceCategoryKey =
  | "ram"
  | "cpu"
  | "motherboard"
  | "gpu"
  | "cooler"
  | "halfpc"
  | "fullpc";

export type PriceCategory = {
  key: PriceCategoryKey;
  title: string;
  shortTitle: string;
  description: string;
  unitHint?: string;
};

export const PRICE_CATEGORIES: PriceCategory[] = [
  {
    key: "ram",
    title: "RAM 가격현황",
    shortTitle: "램",
    description: "DDR4/DDR5 메모리 가격을 모아봅니다.",
    unitHint: "원",
  },
  {
    key: "cpu",
    title: "CPU 가격현황",
    shortTitle: "CPU",
    description: "데스크탑 CPU 가격을 모아봅니다.",
    unitHint: "원",
  },
  {
    key: "motherboard",
    title: "메인보드 가격현황",
    shortTitle: "메인보드",
    description: "칩셋/폼팩터별 메인보드 가격을 모아봅니다.",
    unitHint: "원",
  },
  {
    key: "gpu",
    title: "그래픽카드 가격현황",
    shortTitle: "그래픽카드",
    description: "GPU 모델별 가격을 모아봅니다.",
    unitHint: "원",
  },
  {
    key: "cooler",
    title: "쿨러 가격현황",
    shortTitle: "쿨러",
    description: "공랭/수랭 쿨러 가격을 모아봅니다.",
    unitHint: "원",
  },
  {
    key: "halfpc",
    title: "반본체 가격현황",
    shortTitle: "반본체",
    description: "CPU/보드/램/SSD 등 구성형 반본체 가격을 모아봅니다.",
    unitHint: "원",
  },
  {
    key: "fullpc",
    title: "완본체 가격현황",
    shortTitle: "완본체",
    description: "OS 포함 완제품 PC(완본체) 가격을 모아봅니다.",
    unitHint: "원",
  },
];

export function getCategory(key: string): PriceCategory | undefined {
  return PRICE_CATEGORIES.find((c) => c.key === key);
}
