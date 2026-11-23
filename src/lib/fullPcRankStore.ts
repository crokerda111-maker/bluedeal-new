import "server-only";

import { kstDay } from "./dailyPc";
import { kvCommand } from "./kvRest";
import { getLocalPrices } from "./localPrices";
import { buildFullPcBoard } from "./marketFullPc";

type Placement = { comparison: string; rank: number; mode: "score" | "price" };
const rankingKey = (day: string) => `bluedeal:market-fullpc:ranks:v1:${day}`;

export async function saveFullPcRanks(now: number) {
  const rows = buildFullPcBoard(getLocalPrices("fullpc").items, now);
  const ranks = rows.flatMap(({ product, comparison, placement }) =>
    comparison && placement ? [[product.id, { comparison, rank: placement.rank, mode: placement.mode }] as const] : []);
  if (ranks.length) {
    await kvCommand("SET", rankingKey(kstDay(now)), JSON.stringify(Object.fromEntries(ranks)), "EX", 14 * 86400);
  }
}

export async function previousFullPcRanks(now: number): Promise<ReadonlyMap<string, Placement>> {
  try {
    const raw = await kvCommand<string | null>("GET", rankingKey(kstDay(now - 86400_000)));
    const json: Record<string, Placement> = raw ? JSON.parse(raw) : {};
    return new Map(Object.entries(json).filter(([, row]) =>
      typeof row?.comparison === "string" && Number.isSafeInteger(row.rank) && row.rank > 0 &&
      (row.mode === "score" || row.mode === "price")));
  } catch {
    return new Map();
  }
}
