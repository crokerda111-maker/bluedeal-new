import data from "../content/products/catalog.json";
import type { CatalogProduct } from "./productCatalog";
import { summarizeCatalog } from "./productCatalog";

export const CATALOG_PRODUCTS = data.products as CatalogProduct[];
export const CATALOG_HASH = data.catalogHash;
export const CATALOG_SUMMARY = summarizeCatalog(CATALOG_PRODUCTS);
export const CATALOG_BRANDS = [...new Set(CATALOG_PRODUCTS.map(product => product.brand))].sort((a, b) => a.localeCompare(b));
const byId = new Map(CATALOG_PRODUCTS.map(product => [product.id, product]));
export function getCatalogProduct(id: string) { return byId.get(id); }
