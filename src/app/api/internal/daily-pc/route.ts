import { timingSafeEqual } from "node:crypto";
import { collectDailyPc } from "../../../../lib/collectDailyPc";
import { kstDay } from "../../../../lib/dailyPc";
import { dailyPcKey, readDailyPc } from "../../../../lib/dailyPcStore";
import { saveFullPcRanks } from "../../../../lib/fullPcRankStore";
import { kvCommand } from "../../../../lib/kvRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24 || (process.env.VERCEL && process.env.VERCEL_ENV !== "production")) return false;
  const expected = Buffer.from("Bearer " + secret);
  const auth = Buffer.from(request.headers.get("authorization") ?? "");
  return auth.length === expected.length && timingSafeEqual(auth, expected);
}

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request)) return Response.json({ state: "unauthorized" }, { status: 401, headers });
  const now = Date.now();
  const day = kstDay(now);
  try {
    await saveFullPcRanks(now);
  } catch (error) {
    console.error("Marketplace PC ranks could not be stored", error instanceof Error ? error.name : "Error");
  }
  try {
    if (await readDailyPc(day)) return Response.json({ state: "already-observed", day }, { headers });
    const lease = await kvCommand<string | null>("SET", dailyPcKey(day) + ":collect", "running", "NX", "EX", 310);
    if (lease !== "OK") return Response.json({ state: "running", day }, { status: 202, headers });
    const result = await collectDailyPc();
    if (result.day !== day) return Response.json({ state: "day-changed" }, { status: 409, headers });
    await kvCommand("SET", dailyPcKey(day), JSON.stringify(result), "EX", 60 * 60 * 24 * 45);
    return Response.json({ state: result.sourceState, day, planned: result.planned, checked: result.rows.length,
      observed: result.rows.filter(row => row.state === "observed").length }, { headers });
  } catch (error) {
    console.error("Daily PC run could not be stored", error instanceof Error ? error.name : "Error");
    return Response.json({ state: "failed", day }, { status: 503, headers });
  }
}
