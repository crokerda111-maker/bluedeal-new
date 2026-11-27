import { isPcToday } from "./dailyPc";
import { fullPcBestCpu, fullPcGpuChip } from "./fullPcTiers";
import type { FullPcBoardRow } from "./marketFullPc";
import { cpuModel } from "./pcModelNames";

export const desktopGpuBenchmarks = "https://gamersnexus.net/megacharts/gpus";

// Keep close models together because QHD raster results vary by game and VRAM.
const qhdBands = [
  ["RTX 5090"],
  ["RTX 4090", "RTX 5080"],
  ["RTX 4080", "RTX 4080 SUPER", "RTX 5070 TI", "RX 7900 XTX", "RX 9070 XT"],
  ["RTX 4070 TI", "RTX 4070 TI SUPER", "RTX 5070", "RX 7900 XT", "RX 9070"],
  ["RTX 4070", "RTX 4070 SUPER", "RX 7800 XT", "RX 7900 GRE", "RX 9070 GRE"],
  ["RTX 4060 TI", "RTX 5060 TI", "RX 7700 XT", "RX 9060 XT"],
  ["RTX 3060 TI", "RTX 4060", "RTX 5060", "RX 7600 XT", "ARC B580"],
  ["RTX 3060", "RX 7600", "ARC B570"],
] as const;

export function pcMarketGroup(row: FullPcBoardRow) {
  const cpu = (row.cpu ? cpuModel(row.cpu) : null) ?? cpuModel(row.product.name);
  const half = row.product.category === "halfpc";
  const gpu = half ? null : fullPcGpuChip(row.gpu ?? row.product.name, !row.review);
  if (!cpu || (!half && !gpu)) return { key: "unverified", label: "CPU·GPU 모델 확인 중", gpu: null };
  const graphics = gpu ? gpu.replace(/\bTI\b/g, "Ti") : "외장 GPU 미포함";
  const slug = [cpu, half ? "no-gpu" : gpu === "내장그래픽" ? "integrated" : gpu]
    .join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
  return { key: slug, label: `${cpu.replace(/\bPLUS\b/g, "Plus")} + ${graphics}`, gpu };
}

export function groupMarketPcs(rows: readonly FullPcBoardRow[]) {
  const groups = new Map<string, ReturnType<typeof pcMarketGroup> & { rows: FullPcBoardRow[] }>();
  for (const row of rows) {
    const key = pcMarketGroup(row);
    const group = groups.get(key.key);
    if (group) group.rows.push(row);
    else groups.set(key.key, { ...key, rows: [row] });
  }
  return [...groups.values()].sort((a, b) =>
    Number(a.key === "unverified") - Number(b.key === "unverified") || a.label.localeCompare(b.label, "ko", { numeric: true }),
  );
}

export function hasCurrentMarketPrice(row: FullPcBoardRow, now: number) {
  return !row.unavailable && row.checkedToday && row.total !== null && row.offer?.condition !== "refurbished" &&
    row.offer?.availability === "in-stock" && Boolean(row.offer.availabilityCheckedAt && isPcToday(row.offer.availabilityCheckedAt, now));
}

export function homeMarketPcs(ordered: readonly FullPcBoardRow[], now: number) {
  const eligible = ordered.filter(row => {
    const group = pcMarketGroup(row);
    return group.gpu && group.gpu !== "내장그래픽" && !row.unavailable && !row.boardPurchaseHold &&
      !row.review?.configurationConflict && row.offer && row.offer.source !== "컴퓨존" &&
      row.offer.condition !== "refurbished" && !fullPcBestCpu(row.cpu, row.product.name).excluded;
  });
  const checked = eligible.filter(row => hasCurrentMarketPrice(row, now));
  const distinct = new Map<string, FullPcBoardRow>();
  for (const row of [...checked, ...eligible]) {
    const key = pcMarketGroup(row).key;
    if (!distinct.has(key)) distinct.set(key, row);
  }
  const rows = [...distinct.values()];
  const seed = Math.imul(Math.floor(now / 300_000), 2654435761) >>> 0;
  const rotate = (items: FullPcBoardRow[]) => {
    const offset = items.length ? seed % items.length : 0;
    return [...items.slice(offset), ...items.slice(0, offset)];
  };
  return [...rotate(rows.filter(row => hasCurrentMarketPrice(row, now))), ...rotate(rows.filter(row => !hasCurrentMarketPrice(row, now)))].slice(0, 9);
}

export function parsePcBudget(raw: string): number | null {
  const normalized = raw.normalize("NFKC").trim();
  const match = /^(\d+|\d{1,3}(?:,\d{3})+)\s*(만\s*)?(?:원)?$/.exec(normalized);
  if (!match) return null;
  const value = Number(match[1].replaceAll(",", "")) * (match[2] ? 10_000 : 1);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function qhdBand(row: FullPcBoardRow) {
  const { gpu } = pcMarketGroup(row);
  return qhdBands.findIndex(band => band.some(model => model === gpu));
}

export function marketPcsUnderBudget(rows: readonly FullPcBoardRow[], budget: number, now: number) {
  const priced = rows.filter(row =>
    !row.unavailable && row.total !== null && row.total <= budget && row.offer?.condition !== "refurbished",
  );
  const current = priced.filter(row => hasCurrentMarketPrice(row, now) && !row.boardPurchaseHold && !row.review?.configurationConflict);
  const gaming = current.filter(row => qhdBand(row) >= 0 && row.cpu).sort((a, b) =>
    qhdBand(a) - qhdBand(b) ||
    Number(Boolean(b.recommendation)) - Number(Boolean(a.recommendation)) ||
    Number(b.priceHold === null) - Number(a.priceHold === null) ||
    (b.quality?.score ?? -1) - (a.quality?.score ?? -1) ||
    a.total! - b.total! || a.product.id.localeCompare(b.product.id),
  );
  return { priced, current, gaming };
}
