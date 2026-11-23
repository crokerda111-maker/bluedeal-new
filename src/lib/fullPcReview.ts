import { PC_SCORE_RULES, type PcObservation, type PcSlot } from "./dailyPc";

const checks = {
  board: ["메모리 슬롯 4개 이상", "NVMe M.2 3개 이상", "2.5GbE 이상 유선랜"],
  ram: ["총 32GB 이상", "메모리 모듈 2개 이상", "DDR5-6000 이상 제품 표기"],
  storage: ["SSD 1TB 이상", "PCIe 4.0 이상 NVMe"],
  psu: ["GPU 제조사 기준 권장 출력 충족", "ATX 3.0 이상", "80 PLUS Gold 또는 Cybenetics ETA Gold 이상"],
  cooler: ["CPU 소켓 지원", "듀얼 타워 공랭 또는 240mm 이상 수랭"],
  case: ["기본 팬 3개 이상", "전면 메시 흡기"],
} as const;

type RatedSlot = keyof typeof checks;
type ComponentCheck = { results: (boolean | null)[]; fact: string; url: string };

export type FullPcReview = {
  productId: string;
  condition: string;
  checkedOn: string;
  sellerUrl: string;
  partsUrl: string;
  gpuSource: string;
  parts: Record<PcSlot, string>;
  tested: Record<RatedSlot, ComponentCheck>;
  notes: string[];
  configuration?: string;
  detailDigest?: string;
};

export function scoreFullPcParts(review: FullPcReview) {
  let points = 0;
  let unknownPoints = 0;
  const slots = (Object.keys(checks) as RatedSlot[]).map(slot => {
    const reviewSlot = review.tested[slot];
    const weight = PC_SCORE_RULES[slot].weight;
    const perCheck = weight / checks[slot].length;
    const criteria = checks[slot].map((label, index) => ({ label, met: reviewSlot?.results[index] ?? null }));
    const earned = criteria.filter(item => item.met === true).length * perCheck;
    const pending = criteria.filter(item => item.met === null).length * perCheck;
    points += earned;
    unknownPoints += pending;
    return { slot, criteria, weight, earned, pending, fact: reviewSlot?.fact, url: reviewSlot?.url };
  });
  return { score: unknownPoints === 0 ? Math.round(points) : null, slots };
}

export function matchFullPcObservation(row: PcObservation, reviews: readonly FullPcReview[]) {
  if (row.kind !== "fullpc" || row.state !== "observed" || !row.configuration || !row.detailDigest) return undefined;
  return reviews.find(review => review.productId === row.productId && review.configuration === row.configuration && review.detailDigest === row.detailDigest);
}
