export type PriceCategoryKey =
  | "ram"
  | "cpu"
  | "ssd"
  | "motherboard"
  | "gpu"
  | "psu"
  | "case"
  | "hdd"
  | "cooler"
  | "halfpc"
  | "fullpc"
  | "bundle";

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
    key: "ssd",
    title: "SSD 가격현황",
    shortTitle: "SSD",
    description: "NVMe/SATA SSD 가격을 모아봅니다.",
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
    shortTitle: "쿨러·방열판",
    description: "CPU 공랭·수랭 쿨러, 시스템 팬, 방열판을 구분해 확인합니다.",
    unitHint: "원",
  },
  {
    key: "psu",
    title: "파워 상품·가격현황",
    shortTitle: "파워",
    description: "파워의 모델·출력 옵션과 판매 가격을 확인합니다.",
    unitHint: "원",
  },
  {
    key: "case",
    title: "케이스 상품·가격현황",
    shortTitle: "케이스",
    description: "케이스 제품군의 특징과 판매 가격을 확인합니다.",
    unitHint: "원",
  },
  {
    key: "hdd",
    title: "HDD 상품·가격현황",
    shortTitle: "HDD",
    description: "하드디스크의 상품 정보와 판매 가격을 확인합니다.",
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
    description: "완제품 PC의 판매 구성을 확인합니다. OS 포함 여부는 상품별로 다릅니다.",
    unitHint: "원",
  },
  {
    key: "bundle",
    title: "부품 패키지 상품·가격현황",
    shortTitle: "부품 패키지",
    description: "CPU·메인보드 등 묶음 판매 구성을 확인합니다. 완본체와 개별 부품 가격을 구분합니다.",
    unitHint: "원",
  },
];

export function getCategory(key: string): PriceCategory | undefined {
  return PRICE_CATEGORIES.find((c) => c.key === key);
}
