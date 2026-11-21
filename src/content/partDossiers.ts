import type { Evidence, PartDossier } from "../lib/valueAssessment";

const checkedAt = "2026-11-19T20:48:00+09:00";
const specification: Evidence = {
  label: "Intel 공식 i7-14700K 사양", kind: "manufacturer", checkedAt,
  url: "https://www.intel.com/content/www/us/en/products/sku/236783/intel-core-i7-processor-14700k-33m-cache-up-to-5-60-ghz/specifications.html",
};
const mitigation: Evidence = {
  label: "Intel 공식 Vmin Shift·0x12F 보완 업데이트 공지 (2025-05-01)", kind: "manufacturer", checkedAt,
  url: "https://community.intel.com/t/intel-core-13th-and-14th-gen-vmin-shift-instabilty-update-new-microcode-update-0x12f/132113/1",
};

/** Selected official sources only; no benchmark, retailer quote or quality rating is inferred. */
export const PART_DOSSIERS: PartDossier[] = [{
  skuId: "intel-core-i7-14700k", name: "Intel Core i7-14700K", slot: "cpu",
  reviewCoverage: "selected-sources-reviewed",
  strengths: [
    { title: "20코어·28스레드 구성", detail: "P코어 8개와 E코어 12개를 갖췄습니다.", conditions: "작업별 성능 우위는 별도 벤치마크 확인이 필요합니다. 코어 수만으로 게임 성능을 판단하지 않습니다.", sources: [specification] },
    { title: "내장그래픽과 Quick Sync 지원", detail: "공식 사양에 UHD Graphics 770과 Quick Sync 지원이 명시돼 있습니다.", conditions: "14700K 기준입니다. 메인보드의 영상 출력과 사용 앱의 지원 여부를 확인해야 합니다.", sources: [specification] },
  ],
  findings: [{
    id: "intel-14700k-vmin", title: "Vmin Shift 불안정성 관련 BIOS 확인",
    summary: "Intel은 13·14세대 데스크톱 시스템의 관련 위험을 줄이기 위해 0x12F 보완 업데이트를 공지했습니다.",
    affectedSkuIds: ["intel-core-i7-14700k"], conditions: "이 공지가 모든 개별 CPU의 불량을 뜻하지 않습니다. 실제 메인보드·BIOS·설정과 증상 이력을 함께 확인해야 합니다.",
    confidence: "manufacturer-confirmed", severity: "high", resolution: "mitigation-available",
    action: "보드·시스템 제조사의 최신 BIOS와 Intel Default Settings 적용 여부를 확인하세요. 적용 상태를 확인하기 전에는 해당 구성의 추천 판단을 보류합니다. 업데이트만으로 기존 증상이 해결됐다고 단정하지 않습니다.",
    sources: [mitigation],
  }],
  quality: { score: null, reasoning: "공식 사양과 대응 공지만 확인했습니다. 작업별 성능·발열·전력·실사용 신뢰성의 교차 검토 전에는 품질 점수를 부여하지 않습니다.", sources: [] },
}];
