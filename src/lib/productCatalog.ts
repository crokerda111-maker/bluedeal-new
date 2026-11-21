export type ProductCategory = "cpu" | "motherboard" | "ram" | "gpu" | "psu" | "ssd" | "hdd" | "case" | "cooler" | "fullpc" | "halfpc" | "bundle";
export type ProductSource = { label: string; url: string; observedAt: string | null; kind: string };
export type CatalogProduct = {
  id: string; referenceCode: string; name: string; category: ProductCategory; subtype: string; brand: string;
  kind: "curated-model" | "source-reviewed-model" | "retailer-reviewed-model" | "model" | "listed-wattage-option" | "product-family";
  features: string[]; specifications: { label: string; value: string }[]; description: string; notes: string[];
  lifecycle: "unknown" | "listed-current" | "listed-discontinued";
  domesticState: "unverified" | "listing-observed"; manufacturerPartNumber: string | null;
  sources: ProductSource[]; listObservedAt: string | null;
  strengths: { title: string; detail: string; conditions: string; sources: ProductSource[] }[];
  issues: { title: string; summary: string; conditions: string; action: string; sources: ProductSource[] }[];
  reviewSummary: string | null; reviewSources: ProductSource[];
  listings: { id: string; merchant: string; seller: string; pricePage: string }[];
};

export const PRODUCT_CATEGORIES: { key: ProductCategory; label: string }[] = [
  { key: "cpu", label: "CPU" }, { key: "motherboard", label: "메인보드" }, { key: "ram", label: "RAM" },
  { key: "gpu", label: "그래픽카드" }, { key: "psu", label: "파워" }, { key: "ssd", label: "SSD" },
  { key: "hdd", label: "HDD" }, { key: "case", label: "케이스" }, { key: "cooler", label: "쿨러·방열판" },
  { key: "fullpc", label: "완본체" }, { key: "halfpc", label: "반본체" },
  { key: "bundle", label: "부품 패키지" },
];

export const PRODUCT_KIND_LABELS: Record<CatalogProduct["kind"], string> = {
  "curated-model": "등록 모델", "source-reviewed-model": "공식 자료 검토 모델", "model": "목록 모델",
  "listed-wattage-option": "출력 옵션", "product-family": "제품군",
  "retailer-reviewed-model": "판매페이지 확인 모델",
};

export function productCategoryLabel(category: ProductCategory) {
  return PRODUCT_CATEGORIES.find(value => value.key === category)?.label ?? category;
}

export function catalogDate(value: string | null) {
  if (!value) return "확인 전";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "확인 전";
  return date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
}

export type CatalogQuery = { q?: string | string[]; category?: string | string[]; brand?: string | string[]; lifecycle?: string | string[]; page?: string | string[] };
function scalar(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function normalize(value: string) { return value.normalize("NFKC").toLocaleLowerCase("ko").replace(/\s+/g, " ").trim(); }

export function searchCatalog(products: readonly CatalogProduct[], query: CatalogQuery, pageSize = 24) {
  const q = scalar(query.q).slice(0, 120).trim();
  const category = scalar(query.category); const brand = scalar(query.brand);
  const lifecycle = scalar(query.lifecycle) === "exclude-discontinued" ? "exclude-discontinued" : "";
  const terms = normalize(q).split(" ").filter(Boolean);
  const matching = products.filter(product => {
    if (category && product.category !== category) return false;
    if (brand && product.brand !== brand) return false;
    if (lifecycle && product.lifecycle === "listed-discontinued") return false;
    const text = normalize([product.name, product.brand, ...product.features, productCategoryLabel(product.category)].join(" "));
    return terms.every(term => text.includes(term));
  });
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const requested = scalar(query.page);
  const page = /^\d{1,6}$/.test(requested) ? Math.min(totalPages, Math.max(1, Number(requested))) : 1;
  return { q, category, brand, lifecycle, page, totalPages, total: matching.length, items: matching.slice((page - 1) * pageSize, page * pageSize) };
}

export function catalogHref(filters: { q: string; category: string; brand: string; lifecycle: string }, page = 1) {
  const query = new URLSearchParams();
  for (const key of ["q", "category", "brand", "lifecycle"] as const) if (filters[key]) query.set(key, filters[key]);
  if (page > 1) query.set("page", String(page));
  return `/products${query.size ? `?${query.toString()}` : ""}`;
}

export function summarizeCatalog(products: readonly CatalogProduct[]) {
  return {
    entries: products.length,
    models: products.filter(product => !["product-family", "listed-wattage-option"].includes(product.kind)).length,
    families: products.filter(product => product.kind === "product-family").length,
    outputOptions: products.filter(product => product.kind === "listed-wattage-option").length,
    discontinued: products.filter(product => product.lifecycle === "listed-discontinued").length,
    categoryCounts: Object.fromEntries(PRODUCT_CATEGORIES.map(category => [category.key, products.filter(product => product.category === category.key).length])) as Record<ProductCategory, number>,
  };
}
