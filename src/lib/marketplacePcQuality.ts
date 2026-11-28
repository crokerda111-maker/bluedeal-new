import data from "../content/products/fullPcPartEvidence.json";
import { PC_PARTS, type PcSlot } from "./dailyPc";
import type { FullPcReview } from "./fullPcReview";

export const marketplacePartChecks = {
  cpu: ["게임용 CPU 코어 6개 이상 (인텔은 P코어)", "게임용 CPU 코어 8개 이상 (인텔은 P코어)", "독립 게임 실측 상위권", "화면 출력용 내장 그래픽", "판매 옵션의 CPU 단품 보증 확인"],
  gpu: ["정확한 제조사·카드 모델 명시", "VRAM 12GB 이상", "독립 다중 게임 실측의 4K 평균 60fps 이상", "기본 파워가 카드 제조사 권장 출력 충족", "동일 카드의 부하 소음 35dBA 이하 실측"],
  board: ["메모리 슬롯 4개 이상", "NVMe M.2 3개 이상", "2.5GbE 이상 유선랜", "그래픽 슬롯 대역폭 희생 없이 NVMe 2개 이상 사용", "장시간 CPU 부하에서 전원부 온도 85°C 이하 실측"],
  ram: ["총 32GB 이상", "메모리 모듈 2개 이상", "DDR5-6000 이상·CL36 이하", "출고 메모리 IC와 다이 리비전 고정·확인", "제조사 보증 5년 이상 또는 제한적 평생 보증"],
  storage: ["SSD 1TB 이상", "TLC 낸드 확인", "전용 DRAM 탑재", "같은 용량에서 순차 읽기 5,000MB/s 이상", "보증 5년 이상·1TB당 600TBW 이상"],
  psu: ["GPU 제조사 기준 권장 출력 충족", "ATX 3.0 이상", "80 PLUS Gold 또는 Cybenetics ETA Gold 이상", "풀모듈러 케이블", "동일 모델 부하 소음 35dBA 이하 실측 또는 Cybenetics LAMBDA A- 이상"],
  cooler: ["CPU 소켓 지원", "듀얼 타워 공랭 또는 240mm 이상 수랭", "제조사 보증 3년 이상", "정규화된 실측에서 해당 CPU 부하의 온도·소음 기준 충족", "완본체 기본 RAM·케이스와 장착 여유 확인"],
  case: ["기본 팬 3개 이상", "메시 등 막힘이 적은 흡기 구조", "그래픽카드 장착 길이 360mm 이상", "공랭 쿨러 높이 165mm 이상 지원", "동일 팬 구성으로 냉각·소음 실측 확인"],
} as const satisfies Record<PcSlot, readonly string[]>;

const officeChecks: Partial<Record<PcSlot, readonly string[]>> = {
  board: ["메모리 슬롯 2개 이상", "NVMe M.2 1개 이상", "1GbE 이상 유선랜", marketplacePartChecks.board[3], marketplacePartChecks.board[4]],
  ram: ["총 16GB 이상", "메모리 모듈 2개 이상", "DDR4-3200 또는 DDR5 제품 표기", marketplacePartChecks.ram[3], marketplacePartChecks.ram[4]],
  storage: ["SSD 500GB 이상", ...marketplacePartChecks.storage.slice(1)],
  psu: ["사무용 내장그래픽 기준 정격 300W 이상", marketplacePartChecks.psu[1], "80 PLUS 기본 등급 이상", ...marketplacePartChecks.psu.slice(3)],
  cooler: ["CPU 소켓 지원", "CPU 제조사 기본 쿨러 또는 상위 부품", ...marketplacePartChecks.cooler.slice(2)],
  case: ["기본 팬 1개 이상", ...marketplacePartChecks.case.slice(1)],
};

const factLabels: Record<PcSlot, readonly string[]> = {
  cpu: ["게이밍 등급", "코어·캐시", "이슈·구매 확인"],
  gpu: ["칩 성능급", "제조사 라인업", "냉각·전원", "이슈·구매 확인"],
  board: ["전원부", "PCIe·레인 공유", "BIOS·이슈"],
  ram: ["A/S", "IC·다이", "메모리 프로필", "이슈·구매 확인"],
  storage: ["DRAM·낸드", "낸드 구성 차이", "순차 읽기·쓰기", "내구성·보증", "펌웨어·이슈"],
  psu: ["모듈러", "캐패시터", "소음", "보증·이슈"],
  cooler: ["방열·팬", "장착·간섭", "보증·이슈"],
  case: ["흡기·팬", "장착 한도", "조립·이슈"],
};

export type MarketplacePartProfile = {
  slot: PcSlot;
  names: string[];
  facts: Record<string, readonly [text: string, source: string]>;
  verified?: Record<string, readonly [met: boolean, source: string]>;
  attention?: string;
};
export const marketplacePartProfiles = data.parts as unknown as readonly MarketplacePartProfile[];
const evidence = new Map<PcSlot, Map<string, MarketplacePartProfile>>();
for (const profile of marketplacePartProfiles) {
  let models = evidence.get(profile.slot);
  if (!models) { models = new Map(); evidence.set(profile.slot, models); }
  for (const model of profile.names) models.set(model, profile);
}

function previouslyVerified(review: FullPcReview, slot: PcSlot, index: number) {
  if (slot === "cpu") return null;
  if (slot === "gpu") {
    const met = review.tested.psu?.results[0];
    return index === 3 && !review.integratedOffice && typeof met === "boolean"
      ? { met, source: review.gpuSource ?? review.tested.psu.url } : null;
  }
  const recorded = review.tested[slot];
  if (!recorded?.url) return null;
  const positions = review.integratedOffice
    ? { board: [0, 1, 2], ram: [0, 1, 2], storage: [0], psu: [0, -1, 1], cooler: [0, 1], case: [0] }
    : { board: [0, 1, 2], ram: [0, 1, 2], storage: [0], psu: [0, 1, 2], cooler: [0, 1], case: [0] };
  const met = recorded.results[positions[slot][index]];
  if (typeof met !== "boolean" || (slot === "ram" && index === 2 && met && !review.integratedOffice)) return null;
  return { met, source: recorded.url };
}

export function assessMarketplaceFullPc(review: FullPcReview) {
  const slots = (Object.keys(PC_PARTS) as PcSlot[]).map(slot => {
    const profile = evidence.get(slot)?.get(review.parts[slot]);
    const labels = (review.integratedOffice && officeChecks[slot]) || marketplacePartChecks[slot];
    const criteria = labels.map((label, index) => {
      const verified = profile?.verified?.[index];
      const partEvidence = verified ? { met: verified[0], source: verified[1] } : previouslyVerified(review, slot, index);
      return { label, met: partEvidence?.met ?? null, source: partEvidence?.source };
    });
    const points = criteria.filter(item => item.met === true).length;
    const checked = criteria.filter(item => item.met !== null).length;
    const failed = criteria.filter(item => item.met === false);
    return {
      slot, points, checked, failed, criteria, attention: profile?.attention,
      facts: factLabels[slot].map(label => ({ label, evidence: profile?.facts[label] })),
    };
  });
  const confirmed = slots.reduce((total, slot) => total + slot.points, 0);
  const checked = slots.reduce((total, slot) => total + slot.checked, 0);
  const displayScore = checked > 0 && !review.configurationConflict ? confirmed : null;
  return { confirmed, checked, displayScore, score: checked === 40 && !review.configurationConflict ? confirmed : null, slots, checkedOn: data.checkedOn };
}
