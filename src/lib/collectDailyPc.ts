import robotsParser from "robots-parser";
import { setTimeout as pause } from "node:timers/promises";
import { kstDay, type PcDay, type PcObservation } from "./dailyPc";
import { discoverCompuzonePcs, parseCompuzonePc, PC_LIST, PC_ORIGIN, type CompuzoneTarget } from "./pcCompuzone";

const agentName = "BLUEDEAL-Catalog";
const agent = `${agentName}/0.1 (+https://bluedeal.co.kr/about)`;
const robotsUrl = PC_ORIGIN + "/robots.txt";
const maxBytes = 2_000_000;

class StopSource extends Error {}

async function loadPage(url: string, request: typeof fetch): Promise<{ text: string; observedAt: string }> {
  const address = new URL(url);
  if (address.origin !== PC_ORIGIN || address.username || address.password) throw new StopSource("source");
  const started = Date.now();
  const response = await request(url, {
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(6500),
    headers: { "User-Agent": agent, Accept: url === robotsUrl ? "text/plain" : "text/html" },
  });
  if (response.status === 404 && url === robotsUrl) return { text: "", observedAt: new Date(started).toISOString() };
  if (response.status === 404 || response.status === 410) throw new Error("not-found");
  if (!response.ok) throw new StopSource("access");
  const contentType = response.headers.get("content-type") ?? "";
  if (!(url === robotsUrl ? /^text\/plain\b/i : /^text\/html\b/i).test(contentType)) throw new StopSource("format");
  const ageHeader = response.headers.get("age");
  if (ageHeader && !/^\d{1,7}$/.test(ageHeader)) throw new Error("cache-age");
  const age = Number(ageHeader ?? 0);
  const responseDate = Date.parse(response.headers.get("date") ?? "");
  const observed = Math.min(started - age * 1000, Number.isFinite(responseDate) ? responseDate : started);
  if (url !== robotsUrl && (started - observed > 15 * 60_000 || kstDay(observed) !== kstDay(started))) throw new Error("cached");
  if (Number(response.headers.get("content-length")) > maxBytes || !response.body) throw new Error("size");
  const reader = response.body.getReader();
  const encoding = /charset\s*=\s*["']?([a-z0-9_-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  if (!/^(utf-8|euc-kr|windows-949)$/i.test(encoding)) throw new StopSource("encoding");
  const decoder = new TextDecoder(encoding);
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error("size");
      text += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  text += decoder.decode();
  if (text.length < 25_000 && /cf-chl-|_incapsula_resource|verify you are human|checking your browser|접근이 제한되었습니다/i.test(text)) throw new StopSource("challenge");
  return { text, observedAt: new Date(observed).toISOString() };
}

function unavailable(target: CompuzoneTarget, note: string): PcObservation {
  return { ...target, checkedAt: new Date().toISOString(), state: "unavailable", title: "", seller: "", price: null, shipping: null,
    cpu: null, gpu: null, parts: {}, os: null, warranty: null, configuration: null, detailDigest: null, note };
}

export async function collectDailyPc(request: typeof fetch = fetch): Promise<PcDay> {
  const started = Date.now();
  const report: PcDay = { day: kstDay(started), startedAt: new Date(started).toISOString(), planned: 0,
    completedAt: "", sourceState: "complete", rows: [] };
  try {
    const robots = robotsParser(robotsUrl, (await loadPage(robotsUrl, request)).text.replace(/^\uFEFF/, ""));
    const delay = Math.max(3000, (robots.getCrawlDelay(agentName) ?? 0) * 1000);
    if (!Number.isFinite(delay) || delay > 20_000) throw new StopSource("crawl-delay");
    let last = Date.now();
    const read = async (url: string) => {
      if (robots.isAllowed(url, agentName) !== true) throw new StopSource("robots");
      if (Date.now() - started > 235_000 || kstDay(Date.now()) !== report.day) throw new StopSource("schedule");
      await pause(Math.max(0, last + delay - Date.now()));
      last = Date.now();
      return loadPage(url, request);
    };
    const list = await read(PC_LIST);
    const targets = discoverCompuzonePcs(list.text);
    if (!targets.length) throw new StopSource("empty-list");
    report.planned = targets.length;
    for (const target of targets) {
      try {
        const page = await read(target.merchantUrl);
        report.rows.push(parseCompuzonePc(page.text, target, page.observedAt));
      } catch (error) {
        if (error instanceof StopSource) throw error;
        report.rows.push(unavailable(target, "판매 페이지 응답 또는 확인 시각 재검토 필요"));
      }
    }
  } catch {
    report.sourceState = "stopped";
  }
  report.completedAt = new Date().toISOString();
  return report;
}
