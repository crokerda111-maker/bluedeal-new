import "server-only";

import { createHash } from "node:crypto";
import { detectMerchant, normalizeOutboundUrl, parseAffiliateMapping, resolveAffiliateUrl } from "./affiliate";
import type { AffiliateMapping } from "./affiliate";
import { kvCommand, kvPipeline } from "./kvRest";
import { OUTBOUND_LINKS } from "./outbound";
import type { OutboundLink } from "./outbound";

type StoredAffiliate = AffiliateMapping & { code: string };

function namespace(): string {
  const environment = process.env.VERCEL_ENV || "development";
  return `bd:affiliate:${environment}`;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function urlKey(url: string): string { return `${namespace()}:url:${digest(url)}`; }
function codeKey(code: string): string { return `${namespace()}:code:${code}`; }

function parseStored(raw: unknown): StoredAffiliate | null {
  if (typeof raw !== "string") return null;
  try {
    const mapping = parseAffiliateMapping(JSON.parse(raw));
    return mapping?.code ? { ...mapping, code: mapping.code } : null;
  } catch { return null; }
}

async function readKeys(keys: string[]): Promise<unknown[]> {
  const chunks = [];
  for (let i = 0; i < keys.length; i += 100) chunks.push(keys.slice(i, i + 100));
  const values = await Promise.all(chunks.map(async chunk => {
    const result = await kvCommand<unknown[]>("MGET", ...chunk);
    if (!Array.isArray(result) || result.length !== chunk.length) throw new Error("Invalid affiliate storage response");
    return result;
  }));
  return values.flat();
}

export async function getStoredAffiliateMappings(urls: Iterable<string>): Promise<Map<string, StoredAffiliate>> {
  const originals = new Set<string>();
  for (const url of urls) {
    const normalized = normalizeOutboundUrl(url);
    if (!normalized) continue;
    const merchant = detectMerchant(new URL(normalized).hostname);
    if (merchant === "gmarket" || merchant === "11st" || merchant === "coupang" || merchant === "aliexpress") originals.add(normalized);
  }
  const list = [...originals];
  const result = new Map<string, StoredAffiliate>();
  try {
    const records = await readKeys(list.map(urlKey));
    list.forEach((url, index) => {
      const row = parseStored(records[index]);
      if (row?.originalUrl === url) result.set(url, row);
    });
  } catch { /* The previous mappings and original purchase links are still available. */ }
  return result;
}

export async function getStoredAffiliateCodes(codes: Iterable<string>): Promise<Map<string, StoredAffiliate>> {
  const list = [...new Set(codes)].filter(code => /^[a-zA-Z0-9_-]{2,64}$/.test(code));
  const result = new Map<string, StoredAffiliate>();
  try {
    const records = await readKeys(list.map(codeKey));
    list.forEach((code, index) => {
      const row = parseStored(records[index]);
      if (row?.code === code) result.set(code, row);
    });
  } catch { /* Other registered and publisher links can still resolve. */ }
  return result;
}

export async function getOfferAffiliateCodes(items: Iterable<{ goCode?: string }>): Promise<Set<string>> {
  const links = new Map<string, OutboundLink>();
  for (const item of items) {
    if (item.goCode && Object.hasOwn(OUTBOUND_LINKS, item.goCode)) links.set(item.goCode, OUTBOUND_LINKS[item.goCode]);
  }
  const stored = await getStoredAffiliateMappings([...links.values()].map(link => link.originalUrl));
  return new Set([...links].flatMap(([code, link]) => {
    const resolution = resolveAffiliateUrl(link, stored.get(normalizeOutboundUrl(link.originalUrl) ?? ""));
    return resolution && resolution.mode !== "passthrough" ? [code] : [];
  }));
}

export async function importAffiliateMappings(mappings: AffiliateMapping[]) {
  const pending = new Map<string, StoredAffiliate>();
  const aliases = new Set<string>();
  for (const mapping of mappings) {
    const code = mapping.code ?? `af-${digest(mapping.originalUrl).slice(0, 24)}`;
    if (pending.has(mapping.originalUrl) || aliases.has(code)) return { invalid: true } as const;
    const staticLink = Object.hasOwn(OUTBOUND_LINKS, code) ? OUTBOUND_LINKS[code] : undefined;
    if (staticLink && normalizeOutboundUrl(staticLink.originalUrl) !== mapping.originalUrl) return { invalid: true } as const;
    pending.set(mapping.originalUrl, { ...mapping, code });
    aliases.add(code);
  }
  if (!pending.size) return { imported: 0, present: 0, conflicts: 0 };
  const entries = [...pending.values()];
  const writes = await kvPipeline(entries.map(row => {
    const value = JSON.stringify(row);
    return ["MSETNX", urlKey(row.originalUrl), value, codeKey(row.code), value];
  }));
  const saved = await readKeys(entries.flatMap(row => [urlKey(row.originalUrl), codeKey(row.code)]));
  const verified = entries.flatMap((row, index) => {
    const records = [parseStored(saved[index * 2]), parseStored(saved[index * 2 + 1])];
    return records.every(record => record?.code === row.code && record.originalUrl === row.originalUrl && record.affiliateUrl === row.affiliateUrl)
      ? [{ inserted: writes[index] === 1 }] : [];
  });
  const imported = verified.filter(entry => entry.inserted).length;
  return { imported, present: verified.length - imported, conflicts: entries.length - verified.length };
}
