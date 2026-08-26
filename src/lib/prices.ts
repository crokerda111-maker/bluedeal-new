import type { PriceCategoryKey } from "./priceCategories";
import type { MetaPayload, PricesPayload } from "./mockPrices";
import { getLocalMeta, getLocalPrices } from "./localPrices";

/**
 * 가격 데이터는 PC 수집기가 생성해 Git에 포함한 JSON만 사용합니다.
 * GitHub push 후 Vercel이 새 데이터를 포함해 다시 배포합니다.
 */
export async function getMeta(): Promise<MetaPayload> {
  return getLocalMeta();
}

export async function getPrices(category: PriceCategoryKey): Promise<PricesPayload> {
  return getLocalPrices(category);
}
