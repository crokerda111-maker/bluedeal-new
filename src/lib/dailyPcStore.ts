import "server-only";
import { kvCommand } from "./kvRest";
import type { PcDay } from "./dailyPc";

const prefix = "bluedeal:daily-pc:v1:";
export const dailyPcKey = (day: string) => prefix + day;

export async function readDailyPc(day: string): Promise<PcDay | null> {
  const raw = await kvCommand<string | null>("GET", dailyPcKey(day));
  if (!raw) return null;
  const result = JSON.parse(raw) as PcDay;
  if (result.day !== day || !Array.isArray(result.rows)) throw new Error("Invalid PC observations");
  return result;
}
