import { cpuModel, explicitOs } from "./pcModelNames";

export const FULL_PC_TIERS = {
  entry: { label: "실속형", description: "RTX 5060·RX 9060 XT 등 보급형 외장 그래픽" },
  balanced: { label: "균형형", description: "RTX 5070·RTX 5070 Ti·RX 9070 XT 등 중상급 그래픽" },
  high: { label: "상급형", description: "RTX 5080·RTX 5090 등 상급 그래픽" },
  office: { label: "사무·내장그래픽", description: "외장 그래픽 없이 사용하는 구성" },
  unknown: { label: "급수 확인 중", description: "CPU·그래픽카드 모델을 판매처에서 추가 확인할 상품" },
} as const;

export type FullPcTier = keyof typeof FULL_PC_TIERS;
export const GAMING_TIERS = ["entry", "balanced", "high"] as const;

const gpuTiers: Readonly<Record<string, FullPcTier>> = {
  "RTX 3050": "entry", "RTX 3060": "entry", "RTX 3060 TI": "entry",
  "RTX 4060": "entry", "RTX 4060 TI": "entry", "RTX 5060": "entry", "RTX 5060 TI": "entry",
  "RX 6600": "entry", "RX 7600": "entry", "RX 7600 XT": "entry",
  "RX 9060": "entry", "RX 9060 XT": "entry", "ARC B570": "entry", "ARC B580": "entry",
  "RTX 4070": "balanced", "RTX 4070 SUPER": "balanced", "RTX 4070 TI": "balanced",
  "RTX 4070 TI SUPER": "balanced", "RTX 5070": "balanced", "RTX 5070 TI": "balanced",
  "RX 7700 XT": "balanced", "RX 7800 XT": "balanced", "RX 7900 GRE": "balanced",
  "RX 9070 GRE": "balanced", "RX 9070": "balanced", "RX 9070 XT": "balanced",
  "RTX 4080": "high", "RTX 4080 SUPER": "high", "RTX 4090": "high",
  "RTX 5080": "high", "RTX 5090": "high", "RX 7900 XT": "high", "RX 7900 XTX": "high",
};

const chips = /(?<![A-Z\d])(RTX|RX|ARC)[ _-]*([AB]?\d{3,4})(?:[ _-]*(TI[ _-]*SUPER|TI|SUPER|XTX|XT|GRE))?(?![A-Z\d])/g;
const shortChip = /(?:^|[/_(])\s*(\d{4})\s*(TI|SUPER)?\s*(?=\/|\)|$)/g;

export function fullPcGpuChip(label: string, allowShort = false): string | null {
  const upper = label.toUpperCase();
  const matches = [...upper.matchAll(chips)].map(([, brand, model, variant]) =>
    [brand, model, variant?.replace(/[ _-]+/g, " ")].filter(Boolean).join(" "));
  if (allowShort && !matches.length) {
    for (const [, model, variant] of upper.matchAll(shortChip)) {
      const chip = ["RTX", model, variant].filter(Boolean).join(" ");
      if (Object.hasOwn(gpuTiers, chip)) matches.push(chip);
    }
  }
  const unique = [...new Set(matches)];
  if (unique.length) return unique.length === 1 ? unique[0] : null;
  if (/내장\s*(?:그래픽|VGA)|그래픽카드\s*(?:미포함|없음)|\bRADEON\s+(?:610M|680M|760M|780M|860M|880M|890M)\b/i.test(label)) return "내장그래픽";
  return null;
}

export function fullPcTier(chip: string | null): FullPcTier {
  if (chip === "내장그래픽") return "office";
  return chip && Object.hasOwn(gpuTiers, chip) ? gpuTiers[chip] : "unknown";
}

export function fullPcComparisonKey(cpuLabel: string, gpuLabel: string, osLabel: string) {
  const cpu = cpuModel(cpuLabel);
  const gpu = fullPcGpuChip(gpuLabel);
  const os = /\bFREE\s*DOS\b|WINDOWS\s*(?:미포함|미설치|미탑재)|윈도우\s*(?:미포함|미설치|미탑재)/i.test(osLabel)
    ? "OS 미포함" : explicitOs(osLabel);
  const memory = gpuLabel.match(/(?<!\d)(\d{1,2})\s*GB\b/i)?.[1];
  if (!cpu || !gpu || !os || (gpu !== "내장그래픽" && !memory)) return null;
  return [cpu, gpu === "내장그래픽" ? gpu : `${gpu} ${memory}GB`, os].join(" · ");
}

export function fullPcPricePoints(total: number, lowest: number) {
  return lowest / total * 40;
}

export function rankComparableFullPcs<T extends { id: string; score: number; total: number }>(
  candidates: readonly T[], lowest = Math.min(...candidates.map(candidate => candidate.total)),
) {
  if (candidates.length < 2) return [];
  return candidates.map(candidate => ({ candidate, points: candidate.score * 0.6 + fullPcPricePoints(candidate.total, lowest) }))
    .sort((a, b) => b.points - a.points || b.candidate.score - a.candidate.score ||
      a.candidate.total - b.candidate.total || a.candidate.id.localeCompare(b.candidate.id));
}
