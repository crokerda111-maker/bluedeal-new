/** Evidence-first PC valuation. Affiliate revenue is deliberately not an input. */
export type PartSlot = "cpu" | "motherboard" | "ram" | "storage" | "gpu" | "psu" | "case" | "cooler";
export type EvidenceKind = "manufacturer" | "regulator" | "review-lab" | "retailer" | "community";
export type Evidence = { label: string; url: string; checkedAt: string; kind: EvidenceKind };
export type PartFinding = {
  id: string;
  title: string;
  summary: string;
  affectedSkuIds: string[];
  conditions: string;
  confidence: "manufacturer-confirmed" | "independently-reproduced" | "community-report";
  severity: "critical" | "high" | "medium" | "low";
  resolution: "unresolved" | "mitigation-available" | "resolved" | "unknown";
  action: string;
  sources: Evidence[];
};
export type PartDossier = {
  skuId: string;
  name: string;
  slot: PartSlot;
  strengths: Array<{ title: string; detail: string; conditions: string; sources: Evidence[] }>;
  findings: PartFinding[];
  reviewCoverage: "not-reviewed" | "selected-sources-reviewed";
  quality: { score: number | null; reasoning: string; sources: Evidence[] };
};
export type PriceEvidence = {
  amountKRW: number | null;
  stock: "in-stock" | "out-of-stock" | "unknown";
  basis: "retailer-confirmed" | "community-reported" | "user-input";
  source: Evidence | null;
};
export type BuildLine = {
  id: string;
  slot: PartSlot;
  skuId: string | null;
  referenceSkuId: string | null;
  variantMatched: boolean;
  quantity: number;
  orderId: string;
  referencePrice: PriceEvidence | null;
  dossier: PartDossier | null;
  issueApplicability: Record<string, "affected" | "not-affected" | "unknown">;
  issueEvidence: Record<string, Evidence[]>;
  mitigationVerified: string[];
};
export type PcBuild = {
  kind: "fullpc" | "halfpc";
  gpuMode: "dedicated" | "integrated" | "excluded";
  gpuScopeEvidence: Evidence[];
  lines: BuildLine[];
  referenceOrders: Array<{ id: string; shipping: PriceEvidence | null }>;
  /** Complete delivered PC price, including the selected option and shipping. */
  deliveredPcPrice: PriceEvidence | null;
  /** Explicit adjustments for assembly/OS/service on the DIY side. Zero is allowed. */
  referenceServiceCosts: PriceEvidence[];
  conditions: { sameOsAndWarranty: boolean; compatibilityChecked: boolean; evidence: Evidence[] };
  serviceAssessment: { score: number | null; sources: Evidence[] };
};

export const DRAFT_SCORE_POLICY = {
  version: "bluedeal-pc-0.1-draft",
  status: "draft" as "draft" | "reviewed",
  weights: { price: 45, quality: 35, service: 20 },
  partWeights: { cpu: 15, motherboard: 15, ram: 10, storage: 10, gpu: 25, psu: 15, case: 5, cooler: 5 },
  maxPriceAgeHours: 24,
  maxReviewAgeDays: 30,
};
export type ScorePolicy = typeof DRAFT_SCORE_POLICY;
const REQUIRED_SLOTS: PartSlot[] = ["cpu", "motherboard", "ram", "storage", "psu", "case", "cooler"];
const HOUR = 3_600_000;
const MAX_KRW = 100_000_000;

function amount(value: number | null, allowZero = true): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1) && value <= MAX_KRW;
}
function sourceValid(source: Evidence | null, now: number, maxAgeHours: number): boolean {
  if (!source || !source.label.trim()) return false;
  try {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  } catch { return false; }
  const at = Date.parse(source.checkedAt);
  return /(?:Z|[+-]\d\d:\d\d)$/.test(source.checkedAt) && Number.isFinite(at) && at <= now && now - at <= maxAgeHours * HOUR;
}
function priceValid(quote: PriceEvidence | null, now: number, policy: ScorePolicy, allowZero: boolean): quote is PriceEvidence & { amountKRW: number } {
  return !!quote && amount(quote.amountKRW, allowZero) && quote.basis === "retailer-confirmed" && quote.stock === "in-stock" && quote.source?.kind === "retailer" && sourceValid(quote.source, now, policy.maxPriceAgeHours);
}
function scoreValid(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
}
function reviewSourcesValid(sources: Evidence[], now: number, policy: ScorePolicy): boolean {
  return sources.length > 0 && sources.every(source => source.kind !== "community" && sourceValid(source, now, policy.maxReviewAgeDays * 24));
}
function round(value: number, digits = 2): number { return Number(value.toFixed(digits)); }

/** Arithmetic for explicitly user-entered scenarios; this does not verify a deal. */
export function calculateSavings(referenceTotalKRW: number, deliveredPcTotalKRW: number) {
  if (!amount(referenceTotalKRW, false) || !amount(deliveredPcTotalKRW, false)) return null;
  const savingsKRW = referenceTotalKRW - deliveredPcTotalKRW;
  return { referenceTotalKRW, deliveredPcTotalKRW, savingsKRW, savingsPct: round(savingsKRW / referenceTotalKRW * 100) };
}

/** Proposed price axis: -10% = 0, 0% = 50, 20% = 100. Review before public scoring. */
export function draftPriceScore(savingsPct: number): number | null {
  if (!Number.isFinite(savingsPct)) return null;
  return round(Math.max(0, Math.min(100, savingsPct < 0 ? 50 + savingsPct * 5 : 50 + savingsPct * 2.5)));
}
export function qualityTier(score: number | null): "S" | "A" | "B" | "C" | "D" | null {
  if (!scoreValid(score)) return null;
  return score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";
}

export const SCENARIO_FIELDS = [
  { key: "cpu", label: "CPU", zero: false }, { key: "motherboard", label: "메인보드", zero: false },
  { key: "ram", label: "RAM 전체 구성", zero: false }, { key: "storage", label: "SSD·HDD 전체 구성", zero: false },
  { key: "gpu", label: "그래픽카드", zero: true }, { key: "psu", label: "파워", zero: false },
  { key: "case", label: "케이스", zero: false }, { key: "cooler", label: "쿨러 추가 비용", zero: true },
  { key: "shipping", label: "부품 주문 배송비 합계", zero: true },
  { key: "services", label: "조립·OS·서비스 조건 보정 비용", zero: true },
  { key: "pc", label: "비교할 본체 최종 결제금액", zero: false },
] as const;

export const PC_UPGRADE_FIELDS = [
  { key: "ramUpgrade", label: "램 추가·교체비" },
  { key: "ssdUpgrade", label: "SSD 추가·교체비" },
  { key: "otherUpgrade", label: "파워·기타 보완비" },
] as const;

/** Strict manual arithmetic only. These inputs never become merchant evidence. */
export function readCostScenario(search: Record<string, string | string[] | undefined>) {
  const submitted = search.calculate !== undefined;
  const mode = search.mode === "fullpc-integrated" || search.mode === "halfpc" ? search.mode : "fullpc-dedicated";
  const errors: string[] = [];
  const values: Record<string, string> = {};
  const numbers: Record<string, number> = {};
  const estimateProvided = search.referenceTotal !== undefined && search.referenceTotal !== "";
  for (const field of SCENARIO_FIELDS) {
    const raw = search[field.key];
    const text = typeof raw === "string" && raw.length <= 12 ? raw.trim() : "";
    values[field.key] = /^\d{1,9}$/.test(text) ? text : "";
    const parsed = /^\d{1,9}$/.test(text) ? Number(text) : null;
    if (!amount(parsed, field.zero)) { if (submitted && (!estimateProvided || field.key === "pc")) errors.push(`${field.label}에 ${field.zero ? "0 이상" : "1 이상"}의 원 단위 금액을 입력해 주세요.`); }
    else numbers[field.key] = parsed;
  }
  const optionalFields = [{ key: "referenceTotal", label: "직접 구매 견적의 최종 총액" }, ...PC_UPGRADE_FIELDS];
  for (const { key, label } of optionalFields) {
    const raw = search[key];
    const text = typeof raw === "string" && /^\d{1,9}$/.test(raw) ? raw : "";
    values[key] = text;
    if (raw === undefined || raw === "") continue;
    const parsed = text ? Number(text) : null;
    if (!amount(parsed, key !== "referenceTotal")) { if (submitted) errors.push(`${label}의 원 단위 금액을 확인해 주세요.`); }
    else numbers[key] = parsed;
  }
  if (submitted && !estimateProvided && mode === "fullpc-dedicated" && !numbers.gpu) errors.push("그래픽카드 포함 완본체는 그래픽카드 금액이 필요합니다.");
  if (submitted && !estimateProvided && mode !== "fullpc-dedicated" && numbers.gpu !== 0) errors.push("내장그래픽 완본체·반본체 비교에서는 그래픽카드 금액에 0을 입력해 주세요.");
  if (submitted && search.matched !== "yes") errors.push("비교할 목표 구성과 OS·조립·보증 조건을 확인해 주세요.");
  const parts = SCENARIO_FIELDS.slice(0, 8).reduce((sum, field) => sum + (numbers[field.key] ?? 0), 0);
  const upgradeKRW = PC_UPGRADE_FIELDS.reduce((sum, field) => sum + (numbers[field.key] ?? 0), 0);
  const referenceKRW = estimateProvided ? numbers.referenceTotal : parts + numbers.shipping + numbers.services;
  const result = submitted && !errors.length ? calculateSavings(referenceKRW, numbers.pc + upgradeKRW) : null;
  if (submitted && !errors.length && !result) errors.push("합계가 계산 허용 범위를 넘었습니다. 금액을 다시 확인해 주세요.");
  return { submitted, mode, values, matched: search.matched === "yes", errors, result, estimateProvided,
    basePcKRW: numbers.pc ?? 0, upgradeKRW, partsKRW: parts, shippingKRW: numbers.shipping ?? 0, servicesKRW: numbers.services ?? 0 };
}

export function assessPcBuild(build: PcBuild, now = Date.now(), policy: ScorePolicy = DRAFT_SCORE_POLICY) {
  const missing: string[] = [];
  const issueHolds: string[] = [];
  const caveats: string[] = [];
  let scopeComplete = true;
  const scopeMissing = (message: string) => { missing.push(message); scopeComplete = false; };
  if (!Number.isFinite(now)) throw new Error("평가 시각을 확인해 주세요.");
  for (const slot of REQUIRED_SLOTS) if (!build.lines.some(line => line.slot === slot)) scopeMissing(`${slot}: 구성 확인 필요`);
  if (build.kind === "halfpc" && build.gpuMode === "dedicated") scopeMissing("반본체의 GPU 포함 범위 확인 필요");
  if (build.kind === "fullpc" && build.gpuMode === "excluded") scopeMissing("완본체의 그래픽 출력 구성 확인 필요");
  if (build.gpuMode === "dedicated" && !build.lines.some(line => line.slot === "gpu")) scopeMissing("GPU 모델 확인 필요");
  if (build.gpuMode !== "dedicated" && build.lines.some(line => line.slot === "gpu")) scopeMissing("GPU 비교 범위가 실제 구성과 다릅니다.");
  if (build.gpuMode !== "dedicated" && !reviewSourcesValid(build.gpuScopeEvidence, now, policy)) scopeMissing("GPU 제외/내장그래픽 구성 근거 확인 필요");
  if (!build.conditions.sameOsAndWarranty || !build.conditions.compatibilityChecked || !reviewSourcesValid(build.conditions.evidence, now, policy)) scopeMissing("OS·보증·호환성의 동일 비교 조건 확인 필요");
  if (new Set(build.lines.map(line => line.id)).size !== build.lines.length) scopeMissing("중복 구성 행 확인 필요");
  if (!build.lines.length) scopeMissing("부품 구성표가 없습니다.");

  const usedOrders = new Set<string>();
  let partsTotal = 0;
  let pricesComplete = true;
  const qualityBySlot = new Map<PartSlot, number[]>();
  let qualityComplete = true;
  for (const line of build.lines) {
    if (!line.skuId || !line.referenceSkuId || line.skuId !== line.referenceSkuId || !line.variantMatched) {
      missing.push(`${line.slot}: 동일 모델·옵션 대조 필요`); pricesComplete = false;
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) { missing.push(`${line.slot}: 수량 확인 필요`); pricesComplete = false; }
    if (!priceValid(line.referencePrice, now, policy, false)) { missing.push(`${line.slot}: 최근 판매처 가격·재고 확인 필요`); pricesComplete = false; }
    else if (Number.isSafeInteger(line.quantity) && line.quantity > 0 && line.quantity <= 100) partsTotal += line.referencePrice.amountKRW * line.quantity;
    if (!line.orderId) { missing.push(`${line.slot}: 배송 주문 묶음 확인 필요`); pricesComplete = false; }
    else usedOrders.add(line.orderId);
    const dossier = line.dossier?.skuId === line.skuId && line.dossier.slot === line.slot ? line.dossier : null;
    if (!dossier || !scoreValid(dossier.quality.score) || !reviewSourcesValid(dossier.quality.sources, now, policy)) qualityComplete = false;
    else qualityBySlot.set(line.slot, [...(qualityBySlot.get(line.slot) ?? []), dossier.quality.score]);
    if (!dossier || dossier.reviewCoverage === "not-reviewed") missing.push(`${line.slot}: 장점·이슈 조사 필요`);
    for (const finding of dossier?.findings ?? []) {
      if (!line.skuId || !finding.affectedSkuIds.includes(line.skuId)) continue;
      if (finding.confidence === "community-report") { caveats.push(`${finding.title}: 사용자 제보로 별도 표시`); continue; }
      if (!reviewSourcesValid(finding.sources, now, policy)) { missing.push(`${finding.title}: 근거 최신 확인 필요`); continue; }
      if (finding.resolution === "resolved") { caveats.push(`${finding.title}: 해결 공지와 적용 범위 확인`); continue; }
      const applicability = line.issueApplicability[finding.id] ?? "unknown";
      const checked = reviewSourcesValid(line.issueEvidence[finding.id] ?? [], now, policy);
      if (applicability === "not-affected" && checked) continue;
      if (applicability === "not-affected") { missing.push(`${finding.title}: 영향 제외 근거 확인 필요`); continue; }
      if (applicability === "unknown") { missing.push(`${finding.title}: 해당 구성의 영향 여부 확인 필요`); continue; }
      if (finding.resolution === "mitigation-available" && line.mitigationVerified.includes(finding.id) && checked) { caveats.push(`${finding.title}: 대응 적용 확인, 조건과 이력 표시`); continue; }
      if (finding.severity === "critical" || finding.severity === "high") issueHolds.push(`${finding.title}: 해결/대응 적용 확인 전 추천 보류`);
      else caveats.push(`${finding.title}: 구매 전 조건 확인`);
    }
  }
  let shippingTotal = 0;
  for (const orderId of usedOrders) {
    const orders = build.referenceOrders.filter(order => order.id === orderId);
    if (orders.length !== 1 || !priceValid(orders[0].shipping, now, policy, true)) { missing.push("주문별 배송비 확인 필요"); pricesComplete = false; }
    else shippingTotal += orders[0].shipping.amountKRW;
  }
  let serviceTotal = 0;
  if (!build.referenceServiceCosts.length) { missing.push("조립·OS·서비스 비용의 포함 범위 확인 필요"); pricesComplete = false; }
  for (const quote of build.referenceServiceCosts) {
    if (!priceValid(quote, now, policy, true)) { missing.push("조립·OS·서비스 비용 확인 필요"); pricesComplete = false; }
    else serviceTotal += quote.amountKRW;
  }
  if (!priceValid(build.deliveredPcPrice, now, policy, false)) { missing.push("본체 최종 결제금액·재고 확인 필요"); pricesComplete = false; }
  const referenceTotal = partsTotal + shippingTotal + serviceTotal;
  const comparison = pricesComplete && scopeComplete && build.deliveredPcPrice && amount(build.deliveredPcPrice.amountKRW, false)
    ? calculateSavings(referenceTotal, build.deliveredPcPrice.amountKRW) : null;
  if (pricesComplete && scopeComplete && !comparison) missing.push("비교 금액의 허용 범위 확인 필요");
  let quality: number | null = null;
  if (qualityComplete && qualityBySlot.size) {
    let numerator = 0; let denominator = 0;
    for (const [slot, scores] of qualityBySlot) { const weight = policy.partWeights[slot]; numerator += scores.reduce((a, b) => a + b, 0) / scores.length * weight; denominator += weight; }
    if (denominator) quality = round(numerator / denominator);
  } else missing.push("부품별 품질 평가 근거 확인 필요");
  const service = scoreValid(build.serviceAssessment.score) && reviewSourcesValid(build.serviceAssessment.sources, now, policy) ? build.serviceAssessment.score : null;
  if (service === null) missing.push("판매자·보증·AS 평가 근거 확인 필요");
  const price = comparison ? draftPriceScore(comparison.savingsPct) : null;
  const weightTotal = Object.values(policy.weights).reduce((a, b) => a + b, 0);
  const validWeights = weightTotal === 100 && [...Object.values(policy.weights), ...Object.values(policy.partWeights)].every(value => Number.isFinite(value) && value > 0);
  if (!validWeights) missing.push("평가 비중 설정 확인 필요");
  const ready = !missing.length && !issueHolds.length && price !== null && quality !== null && service !== null;
  const score = ready && policy.status === "reviewed"
    ? round((price! * policy.weights.price + quality! * policy.weights.quality + service! * policy.weights.service) / 100) : null;
  return { policyVersion: policy.version, policyStatus: policy.status, comparison, breakdown: comparison ? { partsKRW: partsTotal, shippingKRW: shippingTotal, servicesKRW: serviceTotal } : null,
    axes: { price, quality, service }, componentGrades: build.lines.map(line => ({ id: line.id, slot: line.slot, skuId: line.skuId, tier: line.dossier?.skuId === line.skuId && line.dossier.slot === line.slot && reviewSourcesValid(line.dossier.quality.sources, now, policy) ? qualityTier(line.dossier.quality.score) : null })),
    overallScore: score, status: issueHolds.length ? "issue-hold" : !ready ? "needs-evidence" : policy.status === "draft" ? "methodology-review" : "ready",
    missing: [...new Set(missing)], issueHolds: [...new Set(issueHolds)], caveats: [...new Set(caveats)] };
}
