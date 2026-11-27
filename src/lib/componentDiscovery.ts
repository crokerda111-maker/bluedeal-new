import type { CatalogProduct } from "./productCatalog";
import { isSpecificationSource } from "./productBuyingNotes";

export function isIndexableComponent(product: CatalogProduct): boolean {
  if (["fullpc", "halfpc", "bundle"].includes(product.category) ||
    product.kind === "product-family" || product.kind === "listed-wattage-option") return false;

  const valuesBySpec = new Map<string, Set<string>>();
  const documentedSpecs = new Set<string>();
  for (const { key, value, source } of product.facts ?? []) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || /확인 필요|확인 중|미확인|미공개|확인되지|^unknown$/.test(normalized) ||
      !isSpecificationSource(source)) continue;
    const values = valuesBySpec.get(key) ?? new Set();
    values.add(normalized);
    valuesBySpec.set(key, values);
    if (source.kind !== "retailer-listing") documentedSpecs.add(key);
  }
  return [...documentedSpecs].filter(key => valuesBySpec.get(key)?.size === 1).length >= 3;
}
