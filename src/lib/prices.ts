import type { PriceCategoryKey } from "./priceCategories";
import { getMockMeta, getMockPrices } from "./mockPrices";
import type { MetaPayload, PriceItem, PricesPayload } from "./mockPrices";

function normalizeBaseUrl(base: string): string {
  // remove trailing slash
  return base.replace(/\/+$/, "");
}

export function getPriceApiBase(): string | null {
  const base = process.env.PRICE_API_BASE;
  if (!base) return null;
  return normalizeBaseUrl(base);
}

async function safeFetchJson<T>(url: string, revalidateSeconds: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      // Next.js Data Cache (server component)
      next: { revalidate: revalidateSeconds },
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function normalizeMetaPayload(raw: unknown): MetaPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as any;

  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : isoNow();
  const schedule = typeof r.schedule === "string" ? r.schedule : "매일 09:00 / 17:00 갱신";
  const note = typeof r.note === "string" ? r.note : undefined;

  return { updatedAt, schedule, note };
}

function normalizePriceItem(raw: any, fallbackId: string): PriceItem | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" ? raw.id : fallbackId;
  const name = typeof raw.name === "string" ? raw.name : null;
  const price = typeof raw.price === "number" ? raw.price : Number(raw.price);

  if (!name) return null;
  if (!Number.isFinite(price)) return null;

  const item: PriceItem = {
    id,
    name,
    price,
    spec: typeof raw.spec === "string" ? raw.spec : undefined,
    low7d: typeof raw.low7d === "number" ? raw.low7d : undefined,
    low30d: typeof raw.low30d === "number" ? raw.low30d : undefined,
    change24hPct: typeof raw.change24hPct === "number" ? raw.change24hPct : undefined,
    url: typeof raw.url === "string" ? raw.url : undefined,
    goCode: typeof raw.goCode === "string" ? raw.goCode : undefined,
    source: typeof raw.source === "string" ? raw.source : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };

  return item;
}

function normalizePricesPayload(category: PriceCategoryKey, raw: unknown): PricesPayload | null {
  // 1) "정석" 스키마: { category, updatedAt, items: [...] }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as any;
    const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt : isoNow();
    const itemsRaw = Array.isArray(r.items) ? r.items : null;
    if (!itemsRaw) return null;

    const items: PriceItem[] = itemsRaw
      .map((it: any, idx: number) => normalizePriceItem(it, `${category}-tmp-${idx + 1}`))
      .filter(Boolean) as PriceItem[];

    return { category, updatedAt, items };
  }

  // 2) 느슨한 스키마: [ {name, price, ...}, ... ]
  if (Array.isArray(raw)) {
    const items: PriceItem[] = raw
      .map((it: any, idx: number) => normalizePriceItem(it, `${category}-tmp-${idx + 1}`))
      .filter(Boolean) as PriceItem[];

    return { category, updatedAt: isoNow(), items };
  }

  return null;
}

export async function getMeta(revalidateSeconds = 300): Promise<MetaPayload> {
  const base = getPriceApiBase();
  if (!base) return getMockMeta();

  const metaRaw = await safeFetchJson<unknown>(`${base}/meta.json`, revalidateSeconds);
  const meta = normalizeMetaPayload(metaRaw);
  return meta ?? getMockMeta();
}

export async function getPrices(category: PriceCategoryKey, revalidateSeconds = 300): Promise<PricesPayload> {
  const base = getPriceApiBase();
  if (!base) return getMockPrices(category);

  const dataRaw = await safeFetchJson<unknown>(`${base}/prices/${category}.json`, revalidateSeconds);
  const data = normalizePricesPayload(category, dataRaw);
  return data ?? getMockPrices(category);
}
