import type { CatalogProduct, ProductCategory } from "./productCatalog";
import type { PriceItem } from "./mockPrices";

export type SearchQuery = Record<string, string | string[] | undefined>;
export type Facet = { key: string; label: string; unit?: string; labels?: Record<string, string> };
const memory = { key: "memory", label: "메모리 규격" };
const capacity = (label: string): Facet => ({ key: "capacity", label, unit: "capacity" });
const formFactor = { key: "formFactor", label: "제품 규격" };
const boardSizes: Record<string, string> = { microatx: "microATX", miniitx: "Mini-ITX", eatx: "E-ATX", atx: "ATX" };
const efficiencyGrades: Record<string, string> = { 골드: "GOLD", 브론즈: "BRONZE", 실버: "SILVER", 플래티넘: "PLATINUM", 티타늄: "TITANIUM", 스탠다드: "STANDARD" };
const normalizeEfficiency = (value: string) => efficiencyGrades[value] ?? value.toUpperCase();
function boardSize(value: string) {
  const size = value.match(/^(Micro[- ]?ATX|Mini[- ]?ITX|E[- ]?ATX|ATX)\b/i)?.[1];
  return size ? boardSizes[size.toLowerCase().replace(/[- ]/g, "")] : undefined;
}
export const CATEGORY_FACETS: Record<ProductCategory, Facet[]> = {
  cpu: [{ key: "memory", label: "지원 메모리" }, { key: "socket", label: "CPU 소켓" }, { key: "graphics", label: "내장그래픽", labels: { present: "있음", absent: "없음" } }],
  motherboard: [{ key: "socket", label: "CPU 소켓" }, memory, { key: "chipset", label: "칩셋" }, formFactor, { key: "wireless", label: "무선랜", labels: { present: "있음", absent: "없음" } }],
  ram: [memory, capacity("키트 총용량"), { key: "modules", label: "모듈 수", unit: "개" }, { key: "speed", label: "메모리 전송률", unit: "MT/s" }, { key: "latency", label: "CAS 지연", unit: "CL" }],
  gpu: [{ key: "chip", label: "GPU 칩셋" }, capacity("그래픽 메모리")],
  ssd: [capacity("SSD 용량"), { key: "interface", label: "연결 규격" }, formFactor, { key: "dram", label: "DRAM 캐시", labels: { present: "있음", absent: "없음", unknown: "미확인" } }],
  hdd: [capacity("HDD 용량"), formFactor, { key: "rpm", label: "회전 속도", unit: "rpm" }, { key: "recording", label: "기록 방식" }],
  psu: [{ key: "wattage", label: "정격·목록 출력", unit: "W" }, formFactor, { key: "efficiency", label: "효율 인증" }, { key: "modular", label: "케이블 방식" }, { key: "atx", label: "ATX 전원 규격" }],
  case: [{ key: "caseType", label: "케이스 종류" }, { key: "boardSupport", label: "지원 메인보드" }, { key: "gpuLength", label: "GPU 장착 길이", unit: "mm" }],
  cooler: [{ key: "coolerType", label: "쿨러 종류", labels: { "cpu-air-cooler": "CPU 공랭", "cpu-liquid-cooler": "CPU 수랭", "case-fan": "시스템 팬", "ssd-heatsink": "SSD 방열판", "ram-cooler": "RAM 쿨러" } }, { key: "socket", label: "지원 소켓" }, { key: "radiator", label: "라디에이터", unit: "mm" }, { key: "height", label: "공랭 장착 높이", unit: "mm" }, { key: "heatsinkHeight", label: "방열판 높이", unit: "mm" }, { key: "led", label: "조명", labels: { present: "RGB·ARGB 표기", absent: "없음 표기" } }],
  fullpc: [{ key: "os", label: "OS 판매 표기", labels: { "not-included": "미포함·프리도스", "windows-listed": "Windows 표기·라이선스 별도 확인" } }, { key: "components", label: "부품 구성 확인", labels: { table: "부품표 있음", partial: "일부 선택 확인", unconfirmed: "구성표 확인 전" } }],
  halfpc: [{ key: "os", label: "OS 판매 표기", labels: { "not-included": "미포함·프리도스", "windows-listed": "Windows 표기·라이선스 별도 확인" } }, { key: "components", label: "부품 구성 확인", labels: { table: "부품표 있음", partial: "일부 선택 확인", unconfirmed: "구성표 확인 전" } }],
  bundle: [{ key: "components", label: "포함 구성 확인", labels: { table: "부품표 있음", partial: "일부 선택 확인", unconfirmed: "구성표 확인 전" } }],
};
const categories = Object.keys(CATEGORY_FACETS) as ProductCategory[];
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : "";
export const normalizeProductText = (value: string) => value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
export const unknownBrand = (value: string) => /확인 필요|확인필요|미확인/.test(value);
const facetKeys = (category?: ProductCategory) => category ? [...CATEGORY_FACETS[category].map(facet => facet.key), ...(category === "cpu" ? ["cores"] : [])] : [];

export type ProductFilters = {
  q: string; brand: string; lifecycle: string; priceState: string; kind: string;
  condition: "standard" | "refurbished" | "all"; facets: Record<string, string>; page: number;
};
export function readProductFilters(query: SearchQuery, category?: ProductCategory): ProductFilters {
  const lifecycle = scalar(query.lifecycle) || scalar(query.catalogLifecycle);
  const rawPage = scalar(query.page) || scalar(query.catalogPage);
  const facets = Object.fromEntries(facetKeys(category).map(key => [key, scalar(query[key]).trim().slice(0, 100)]));
  if (category === "motherboard") facets.formFactor = boardSize(facets.formFactor) ?? facets.formFactor;
  if (category === "psu" && facets.efficiency !== "__unknown") facets.efficiency = normalizeEfficiency(facets.efficiency);
  return {
    q: (scalar(query.q) || scalar(query.catalogQ)).trim().slice(0, 100), brand: scalar(query.brand).slice(0, 100),
    lifecycle: lifecycle === "exclude-discontinued" ? lifecycle : "",
    priceState: ["recorded", "missing"].includes(scalar(query.priceState)) ? scalar(query.priceState) : "",
    kind: ["model", "product-family", "listed-wattage-option"].includes(scalar(query.kind)) ? scalar(query.kind) : "",
    condition: !category ? "all" : ["refurbished", "all"].includes(scalar(query.condition)) ? scalar(query.condition) as ProductFilters["condition"] : "standard",
    facets, page: /^\d{1,6}$/.test(rawPage) ? Math.max(1, Number(rawPage)) : 1,
  };
}

/** Read labeled facts and verified offer fields. Never infer hardware from a model name. */
export function productFacetValues(product: CatalogProduct, offers: readonly PriceItem[] = []): Record<string, string[]> {
  const values: Record<string, Set<string>> = {};
  const add = (key: string, value: string | number | undefined | null) => {
    if (value === null || value === undefined || value === "" || /추가 확인|확인 필요|미확인|변경없음/.test(String(value))) return;
    const normalized = String(value).trim();
    (values[key] ??= new Set()).add(key === "efficiency" ? normalizeEfficiency(normalized) : normalized);
  };
  for (const fact of product.facts ?? []) {
    try {
      const url = new URL(fact.source.url); const at = Date.parse(fact.source.observedAt ?? "");
      if (url.protocol === "https:" && !url.username && !url.password && !url.port && Number.isFinite(at) && at <= Date.now()) add(fact.key, fact.value);
    } catch { /* Invalid evidence remains unknown. */ }
  }
  const specs = product.specifications;
  const labeled = (...labels: string[]) => specs.filter(s => labels.includes(s.label)).map(s => s.value);
  const number = (value: string) => /^\d+(?:\.\d+)?$/.test(value.trim()) ? value.trim() : undefined;
  const memorySpec = labeled("지원 메모리", "메모리 종류", "메모리", "메모리 규격", "속도·타이밍");
  for (const value of memorySpec) for (const match of value.matchAll(/\bDDR[345]\b/g)) add("memory", match[0]);
  for (const value of labeled("CPU 소켓", "지원 소켓", "제조사 안내 기본 지원 소켓")) {
    for (const match of value.matchAll(/AM[45]|LGA\s?\d{4}|소켓\s?(\d{4})/gi)) add("socket", match[1] ? "LGA" + match[1] : match[0].replace(/\s/g, "").toUpperCase());
  }
  for (const value of labeled("칩셋", "세부 칩셋")) add("chipset", value);
  for (const value of labeled("규격", "폼 팩터", "폼팩터")) {
    add("formFactor", (product.category === "motherboard" ? boardSize(value) : undefined) ?? value);
  }
  for (const value of labeled("코어 수")) add("cores", number(value.replace(/\s*코어$/, "")));
  for (const value of labeled("판매 용량(GB)", "등록 용량(GB)", "판매명 그래픽 메모리(GB)")) add("capacity", number(value));
  for (const value of labeled("판매 총 용량", "제조사 표기 용량")) {
    const match = value.match(/^(\d+(?:\.\d+)?)\s*(GB|TB)$/i);
    if (match) add("capacity", Number(match[1]) * (match[2].toUpperCase() === "TB" ? 1000 : 1));
  }
  for (const value of labeled("모듈 수")) add("modules", number(value));
  for (const value of labeled("모듈 수·용량")) add("modules", value.match(/^\d+GB\s*[×x*]\s*(\d+)$/i)?.[1]);
  for (const value of labeled("속도·타이밍")) {
    add("speed", value.match(/DDR[345]-(\d+)/)?.[1]); add("latency", value.match(/\bCL(\d+)\b/)?.[1]);
  }
  if (product.category === "ram") for (const value of labeled("판매 구성 표기")) {
    const speed = value.match(/\bDDR[345][- ](\d{4})\b|\b(\d{4})\s*MT\/s\b/i);
    add("speed", speed?.[1] ?? speed?.[2]);
    add("latency", value.match(/\bCL(\d+)\b/i)?.[1]);
  }
  for (const value of labeled("인터페이스", "제조사 표기 연결 규격", "공식 제품군 인터페이스", "공식 인터페이스·NAND", "공식 폼팩터·인터페이스")) {
    if (/SATA/i.test(value)) add("interface", "SATA");
    if (/NVMe/i.test(value)) add("interface", "NVMe");
    for (const match of value.matchAll(/PCIe\s?([345])\.0/gi)) add("interface", "PCIe " + match[1] + ".0");
  }
  if (product.category === "ssd") for (const value of labeled("제조사 표기 장착 규격", "공식 폼팩터·인터페이스", "공식 폼팩터·기능")) {
    const form = value.match(/\bM\.2\s+(22(?:30|42|60|80|110))\b/i);
    if (form) add("formFactor", "M.2 " + form[1]);
  }
  for (const value of labeled("기록 방식")) add("recording", value);
  for (const value of labeled("회전 속도")) add("rpm", number(value.replace(/rpm|,/gi, "")));
  for (const value of labeled("목록 출력 옵션", "정격 출력")) add("wattage", number(value.replace(/W$/i, "")));
  if (product.category === "psu") for (const value of labeled("판매 구성 표기")) {
    add("wattage", value.match(/\b(\d{3,4})\s*W\b/i)?.[1]);
    const efficiency = value.match(/80\s*PLUS\s*(골드|브론즈|실버|플래티넘|티타늄|스탠다드|GOLD|BRONZE|SILVER|PLATINUM|TITANIUM|STANDARD)/i);
    if (efficiency) add("efficiency", efficiency[1].toUpperCase());
    if (/풀모듈러/.test(value)) add("modular", "풀모듈러");
    else if (/세미.?모듈러/.test(value)) add("modular", "세미모듈러");
    add("atx", value.match(/ATX\s*(3\.[01])/i)?.[1]);
  }
  if (product.category === "case") for (const value of product.features) if (/^(빅타워|미들타워|미니타워|미니ITX)$/i.test(value)) add("caseType", value);
  if (product.category === "cooler") {
    add("coolerType", product.subtype);
    for (const value of labeled("목록 LED")) {
      if (/^(없음|NO|NONE|NON[- ]?(?:RGB|LED))$/i.test(value)) add("led", "absent");
      else if (/RGB/i.test(value)) add("led", "present");
    }
  }
  if (["fullpc", "halfpc", "bundle"].includes(product.category)) {
    const components = specs.filter(s => /^판매처 (부품표|기본사양) · /.test(s.label));
    const selected = specs.filter(s => /^확인한 (기본 )?선택 · /.test(s.label));
    add("components", components.length ? "table" : selected.length ? "partial" : "unconfirmed");
    for (const value of specs.filter(s => /(?:확인한 (?:기본 )?선택|판매처 (?:부품표|기본사양)) · 운영체제$/.test(s.label)).map(s => s.value)) {
      if (/프리도스|미탑재|미포함|FreeDOS/i.test(value)) add("os", "not-included");
      else if (/Windows|윈도우/i.test(value)) add("os", "windows-listed");
    }
  }
  for (const offer of offers) {
    if (["ram", "gpu", "ssd"].includes(product.category)) add("capacity", offer.capacityGB);
    if (product.category === "ram") { add("memory", offer.memoryType); add("modules", offer.moduleCount); }
    if (product.category === "ssd" && offer.ssdDram && offer.ssdDram !== "unknown") add("dram", offer.ssdDram);
  }
  return Object.fromEntries(Object.entries(values).map(([key, set]) => [key, [...set]]));
}

export function matchesProductSearch(product: CatalogProduct, offers: readonly PriceItem[], query: string) {
  const terms = normalizeProductText(query).split(" ").filter(Boolean);
  const productText = [product.name, product.brand, ...product.features, ...product.specifications.map(s => s.label + " " + s.value)].join(" ");
  const texts = offers.length ? offers.map(offer => normalizeProductText([productText, offer.name, offer.spec, offer.source, offer.seller].join(" "))) : [normalizeProductText(productText)];
  return texts.some(text => terms.every(term => text.includes(term)));
}
export function matchesProduct(product: CatalogProduct, offers: readonly PriceItem[], filters: ProductFilters) {
  if (filters.brand === "__unknown" ? !unknownBrand(product.brand) : filters.brand && product.brand !== filters.brand) return false;
  if (filters.lifecycle && product.lifecycle === "listed-discontinued") return false;
  if (filters.priceState === "recorded" && !product.listings.length || filters.priceState === "missing" && product.listings.length) return false;
  if (filters.kind && (filters.kind === "model" ? ["product-family", "listed-wattage-option"].includes(product.kind) : product.kind !== filters.kind)) return false;
  if (product.category === "gpu" && filters.condition !== "all") {
    if (filters.condition === "refurbished" ? !offers.some(o => o.condition === "refurbished") : offers.length > 0 && offers.every(o => o.condition === "refurbished")) return false;
  }
  const facts = productFacetValues(product, offers);
  for (const [key, value] of Object.entries(filters.facets)) if (value) {
    const known = facts[key] ?? [];
    if (value === "__unknown" || key === "dram" && value === "unknown") { if (known.length) return false; }
    else if (!known.includes(value)) return false;
  }
  return matchesProductSearch(product, offers, filters.q);
}
export function productFacetOptions(products: readonly CatalogProduct[], offersById: ReadonlyMap<string, readonly PriceItem[]>, facet: Facet) {
  const counts = new Map<string, number>(); let unknown = 0;
  for (const p of products) {
    const values = productFacetValues(p, offersById.get(p.id));
    if (!(values[facet.key]?.length)) unknown++;
    for (const value of values[facet.key] ?? []) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return { values: [...counts].sort(([a], [b]) => a.localeCompare(b, "ko-KR", { numeric: true })), unknown };
}
export function facetLabel(facet: Facet, value: string) {
  if (value === "__unknown") return "미확인";
  if (facet.labels?.[value]) return facet.labels[value];
  if (facet.unit === "capacity") return Number(value) % 1000 === 0 ? `${Number(value) / 1000}TB` : `${value}GB`;
  if (facet.unit === "CL") return "CL" + value;
  return value + (facet.unit ? " " + facet.unit : "");
}
export function productHighlights(product: CatalogProduct, offers?: readonly PriceItem[]) {
  const values = productFacetValues(product, offers);
  return CATEGORY_FACETS[product.category].flatMap(facet => {
    const labels = values[facet.key]?.map(value => facetLabel(facet, value));
    return labels?.length ? [{ key: facet.key, label: facet.label, value: labels.join(" · ") }] : [];
  }).slice(0, 3);
}
export function productSearchHref(category: ProductCategory | undefined, query: SearchQuery, page = 1) {
  const params = new URLSearchParams();
  const keys = ["q", "brand", "lifecycle", "kind", "priceState", "condition", "sort", ...facetKeys(category)];
  for (const key of keys) if (typeof query[key] === "string" && query[key]) params.set(key, query[key] as string);
  if (page > 1) params.set("page", String(page));
  return `/prices${category ? "/" + category : ""}${params.size ? "?" + params : ""}`;
}
export function legacyProductsHref(query: SearchQuery) {
  const requested = scalar(query.category);
  const category = categories.includes(requested as ProductCategory) ? requested as ProductCategory : undefined;
  const mapped = { ...query, q: scalar(query.q) || scalar(query.catalogQ), lifecycle: scalar(query.lifecycle) || scalar(query.catalogLifecycle) };
  const page = scalar(query.page) || scalar(query.catalogPage);
  return productSearchHref(category, mapped, /^\d{1,6}$/.test(page) ? Math.max(1, Number(page)) : 1);
}

export function indexProductOffers(products: readonly CatalogProduct[], offers: readonly PriceItem[]) {
  const owners = new Map(products.flatMap(product => product.listings.map(listing => [listing.id, product.id] as const)));
  const result = new Map<string, PriceItem[]>();
  for (const offer of offers) {
    const id = owners.get(offer.id);
    if (id) { const rows = result.get(id) ?? []; rows.push(offer); result.set(id, rows); }
  }
  return result;
}
export function searchProducts(products: readonly CatalogProduct[], offersById: ReadonlyMap<string, readonly PriceItem[]>, filters: ProductFilters, rankedOffers: readonly PriceItem[], pageSize = 12) {
  const ranks = new Map(rankedOffers.map((offer, index) => [offer.id, index]));
  const rank = (product: CatalogProduct) => Math.min(Infinity, ...product.listings.map(listing => ranks.get(listing.id) ?? Infinity));
  const matching = products.filter(p => matchesProduct(p, offersById.get(p.id) ?? [], filters));
  matching.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "ko-KR", { numeric: true }) || a.id.localeCompare(b.id));
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(filters.page, totalPages);
  return { items: matching.slice((page - 1) * pageSize, page * pageSize), all: matching, total: matching.length, page, totalPages };
}
