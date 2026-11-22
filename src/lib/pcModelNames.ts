import type { PcKind } from "./dailyPc";

const gpuTokens = /(?:^|[^A-Z0-9])(RTX|GTX|RX|ARC)\s*([AB]?\d{3,4})\s*(TI\s*SUPER|TI|SUPER|XT|XTX)?(?![A-Z0-9])/g;

export function cpuModel(title: string) {
  const upper = title.toUpperCase().replace(gpuTokens, " ");
  const matches = [...upper.matchAll(/(?<![A-Z0-9])([3579]\d{3}(?:X3D2|X3D|X|G|F|GE|XT|GT)?|1[234]\d{3}(?:KS|KF|K|F|T)?|2[2456789]\d(?:K|KF|T|F)?(?:\s+PLUS)?)(?![A-Z0-9])/g)]
    .map(match => match[1]).filter(model => {
      if (/^1[234]/.test(model)) return /INTEL|인텔|CORE|[Ii][3579]|\d[KF]$/.test(upper + " " + model);
      if (/^2/.test(model)) return /ULTRA|울트라/.test(upper);
      return /RYZEN|라이젠|AMD/.test(upper) || /X3D$/.test(model);
    });
  const candidates = [...new Set(matches)];
  if (candidates.length !== 1) return null;
  const model = candidates[0];
  if (/^1[234]/.test(model)) return `Intel ${model}`;
  if (/^2/.test(model)) return `Core Ultra ${model}`;
  return `Ryzen ${model}`;
}

export function gpuModel(title: string, kind: PcKind) {
  const upper = title.toUpperCase();
  const matches = [...upper.matchAll(gpuTokens)];
  if (matches.length === 0 && /내장\s*(?:그래픽|VGA)|그래픽카드\s*(?:미포함|없음)|외장\s*그래픽\s*미탑재/.test(title)) {
    return kind === "halfpc" ? "외장 GPU 미포함" : "내장그래픽";
  }
  if (matches.length !== 1 || kind === "halfpc") return null;
  const [, brand, model, rawSuffix] = matches[0];
  const suffix = (rawSuffix ?? "").replace(/\s+/g, " ");
  const modelName = `${brand} ${model}${suffix ? " " + suffix : ""}`;
  const capacity = [...upper.slice(matches[0].index! + matches[0][0].length).matchAll(/\b(\d{1,2})\s*GB\b/g)];
  const memory = capacity.length === 1 ? capacity[0][1] : undefined;
  if (["RTX 5060 TI", "RTX 4060 TI", "RTX 3060", "RTX 3080", "RX 9060 XT", "RX 5600"].includes(modelName) && !memory) return null;
  return memory ? `${modelName} ${memory}GB` : modelName;
}

export function explicitOs(value: string) {
  if (/프리도스|OS\s*미포함|운영체제\s*미탑재/i.test(value)) return "OS 미포함";
  const windows = value.match(/윈도우\s*(11|10)|Windows\s*(11|10)/i);
  const edition = value.match(/\b(Home|Pro)\b|홈|프로/i)?.[0].toLowerCase();
  const license = value.match(/\b(FPP|DSP|OEM)\b/i)?.[0].toUpperCase();
  if (!windows || !edition || !license) return null;
  return `Windows ${windows[1] ?? windows[2]} ${edition === "홈" || edition === "home" ? "Home" : "Pro"} ${license}`;
}
