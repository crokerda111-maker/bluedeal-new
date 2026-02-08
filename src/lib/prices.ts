import type { PriceCategoryKey } from "./priceCategories";
import { getMockMeta, getMockPrices } from "./mockPrices";
import type { MetaPayload, PricesPayload } from "./mockPrices";

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

export async function getMeta(revalidateSeconds = 300): Promise<MetaPayload> {
  const base = getPriceApiBase();
  if (!base) return getMockMeta();

  const meta = await safeFetchJson<MetaPayload>(`${base}/meta.json`, revalidateSeconds);
  return meta ?? getMockMeta();
}

export async function getPrices(category: PriceCategoryKey, revalidateSeconds = 300): Promise<PricesPayload> {
  const base = getPriceApiBase();
  if (!base) return getMockPrices(category);

  const data = await safeFetchJson<PricesPayload>(`${base}/prices/${category}.json`, revalidateSeconds);
  return data ?? getMockPrices(category);
}
