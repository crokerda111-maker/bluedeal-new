import reviews from "../content/fullPcReviews.json";
import fullPcPhotos from "../content/products/fullPcPhotos.json";
import marketplaceNotes from "../content/products/pcMarketplaceNotes.json";
import { normalizeOutboundUrl } from "./affiliate";
import { CATALOG_PRODUCTS, getCatalogProduct } from "./catalogData";
import { isPcToday, kstDay } from "./dailyPc";
import { separatePcTotal, type FullPcReview } from "./fullPcReview";
import { FULL_PC_TIERS, fullPcComparisonKey, fullPcGpuChip, fullPcPricePoints, fullPcTier, rankComparableFullPcs } from "./fullPcTiers";
import { type PriceItem } from "./mockPrices";
import { assessMarketplaceFullPc } from "./marketplacePcQuality";
import { OUTBOUND_LINKS } from "./outbound";
import { pcCatalogConfiguration } from "./pcCatalogConfiguration";
import type { CatalogProduct } from "./productCatalog";
import type { ProductPhoto } from "./productEditorial";

const marketplaceReviews: readonly FullPcReview[] = reviews.filter(review => !review.configuration);
const catalogFullPcs = CATALOG_PRODUCTS.filter(product => product.category === "fullpc");

function deliveredTotal(offer?: PriceItem) {
  if (!offer || !Number.isSafeInteger(offer.price) || offer.price <= 0 ||
      typeof offer.shippingFee !== "number" || !Number.isSafeInteger(offer.shippingFee) || offer.shippingFee < 0) return null;
  return offer.price + offer.shippingFee;
}

export function getMarketplaceFullPcReview(productId: string) {
  return marketplaceReviews.find(review => review.productId === productId);
}

export function getFullPcPhoto(productId: string): ProductPhoto | undefined {
  return fullPcPhotos[productId as keyof typeof fullPcPhotos];
}

export function getReviewedMarketplaceFullPcs() {
  return marketplaceReviews.flatMap(review => {
    const product = getCatalogProduct(review.productId);
    return product?.kind === "retailer-reviewed-model" && product.category === "fullpc" ? [{ product, review }] : [];
  });
}

function comparisonHold(review: FullPcReview, offer: PriceItem, total: number | null, now: number) {
  if (review.notForSale || offer.availability === "out-of-stock") return "현재 판매 중 아님";
  if (review.configurationConflict) return review.configurationConflict;
  if (offer.condition === "refurbished") return "리퍼·벌크 상품입니다. 신품 순위에서는 제외됩니다.";
  if (review.checkedOn !== kstDay(now) || !offer.checkedAt || !isPcToday(offer.checkedAt, now) ||
      !offer.availabilityCheckedAt || !isPcToday(offer.availabilityCheckedAt, now) || offer.availability !== "in-stock") {
    return "당일 부품 구성·판매가·재고 재확인 필요";
  }
  if (!review.priceOption || review.priceOption !== offer.spec) return "판매 가격에 적용되는 기본 부품 옵션 확인 필요";
  if (total === null) return "배송 포함 기본 가격 확인 필요";
  if (!review.purchaseTerms?.os.trim() || !review.purchaseTerms.warranty.trim()) return "Windows·보증 조건 확인 필요";
  const power = review.tested.psu?.results[0];
  if (power === false) return "기본 파워가 그래픽카드 제조사의 권장 출력을 충족하지 않습니다.";
  if (power !== true) return "기본 파워의 그래픽카드 권장 출력 충족 여부 확인 필요";
  return null;
}

function selectMarketplaceFullPcs(items: readonly PriceItem[], now: number) {
  const offers = new Map(items.map(item => [item.id, item]));

  return getReviewedMarketplaceFullPcs().flatMap(({ product, review }) => {
    const source = normalizeOutboundUrl(review.sellerUrl);
    const marketplaceOffers = product.listings.flatMap(listing => {
      const offer = offers.get(listing.id);
      if (!offer?.goCode) return [];
      const link = Object.hasOwn(OUTBOUND_LINKS, offer.goCode) ? OUTBOUND_LINKS[offer.goCode] : null;
      if (!source || !link || link.merchant === "compuzone" || normalizeOutboundUrl(link.originalUrl) !== source) return [];
      return [{ offer, merchant: link.merchant }];
    }).sort((a, b) => (Date.parse(b.offer.checkedAt ?? "") || 0) - (Date.parse(a.offer.checkedAt ?? "") || 0));
    const entry = marketplaceOffers[0];
    if (!entry) return [];

    const { offer, merchant } = entry;
    const total = deliveredTotal(offer);
    const hold = comparisonHold(review, offer, total, now);
    const separateTotal = hold === null ? separatePcTotal(review, now) : null;
    const savings = separateTotal && total !== null
      ? { amount: separateTotal - total, percent: (separateTotal - total) / separateTotal * 100 }
      : null;

    return [{ product, offer, merchant, hold, savings }];
  });
}

type RankedPick = { rank: number; mode: "score"; points: number } | { rank: number; mode: "price" };
export type FullPcBoardRow = {
  product: CatalogProduct;
  review?: FullPcReview;
  offer?: PriceItem;
  cpu?: string;
  gpu?: string;
  tier: keyof typeof FULL_PC_TIERS;
  quality?: ReturnType<typeof assessMarketplaceFullPc>;
  priceComparison?: { points: number; lowest: number; count: number };
  priceHold: string | null;
  total: number | null;
  checkedToday: boolean;
  unavailable: boolean;
  comparison: string | null;
  placement?: RankedPick;
  savings?: { amount: number; percent: number };
  recommendation?: { amount: number; percent: number };
  merchant?: string;
};

export function groupComparableFullPcs(rows: readonly FullPcBoardRow[]) {
  const groups = new Map<string, FullPcBoardRow[]>();
  for (const row of rows) {
    if (!row.comparison) continue;
    const group = groups.get(row.comparison);
    if (group) group.push(row);
    else groups.set(row.comparison, [row]);
  }
  return groups;
}

export function buildFullPcBoard(items: readonly PriceItem[], now: number) {
  const verified = new Map(selectMarketplaceFullPcs(items, now).map(row => [row.product.id, row]));
  const prices = new Map(items.map(item => [item.id, item]));
  const rows = catalogFullPcs.map<FullPcBoardRow>(product => {
    const verifiedOffer = verified.get(product.id);
    const review = getMarketplaceFullPcReview(product.id);
    const specs = review ? [] : pcCatalogConfiguration(product);
    const cpu = review?.parts.cpu ?? specs.find(field => field.key === "cpu" && field.values.length === 1)?.values[0];
    const gpu = review?.parts.gpu ?? specs.find(field => field.key === "gpu" && field.values.length === 1)?.values[0];
    const tier = fullPcTier(fullPcGpuChip(gpu ?? product.name, !review));
    const offer = verifiedOffer?.offer ?? product.listings.map(listing => prices.get(listing.id))
      .filter(row => row !== undefined).sort((a, b) => (Date.parse(b.checkedAt ?? "") || 0) - (Date.parse(a.checkedAt ?? "") || 0))[0];
    const quality = review ? assessMarketplaceFullPc(review) : undefined;
    const note = marketplaceNotes[product.id as keyof typeof marketplaceNotes];
    const notForSale = (note && "saleStatus" in note && note.saleStatus === "not-for-sale") || review?.notForSale;
    const unavailable = !!notForSale || offer?.availability === "out-of-stock";
    const comparison = !unavailable && verifiedOffer?.hold === null && review?.purchaseTerms
      ? fullPcComparisonKey(review.parts.cpu, review.parts.gpu, review.purchaseTerms.os) : null;
    const priceHold = unavailable ? "현재 판매 중 아님" : review?.configurationConflict ?? (
      !review ? "기본 부품 모델과 판매 조건 확인 필요"
        : !verifiedOffer ? "검토한 옵션과 연결된 판매가 확인 필요"
        : verifiedOffer.hold ?? (comparison ? null : "CPU·GPU·VRAM·운영체제 확인 필요")
    );
    const savings = verifiedOffer?.savings ?? undefined;
    const recommendation = comparison && quality?.score != null && savings && savings.amount > 0 ? savings : undefined;
    return { product, review, offer, cpu, gpu, tier, quality,
      total: deliveredTotal(offer), checkedToday: !!offer?.checkedAt && isPcToday(offer.checkedAt, now),
      unavailable, comparison, priceHold, savings, recommendation, merchant: verifiedOffer?.merchant };
  });

  for (const group of groupComparableFullPcs(rows).values()) {
    const priced = group.flatMap(row => row.total === null ? [] : [{ row, total: row.total }]);
    if (priced.length < 2) continue;

    const lowest = Math.min(...priced.map(entry => entry.total));
    for (const { row, total } of priced) {
      row.priceComparison = { points: fullPcPricePoints(total, lowest), lowest, count: priced.length };
    }

    const ranked = rankComparableFullPcs(priced.flatMap(({ row, total }) => row.quality?.score == null ? [] :
      [{ id: row.product.id, row, score: row.quality.score / 40 * 100, total }]), lowest);
    if (ranked.length) {
      ranked.forEach(({ candidate, points }, index) => { candidate.row.placement = { rank: index + 1, mode: "score", points }; });
    } else {
      priced.sort((a, b) => a.total - b.total || a.row.product.id.localeCompare(b.row.product.id));
      priced.forEach(({ row }, index) => { row.placement = { rank: index + 1, mode: "price" }; });
    }
  }
  return rows;
}

export function orderFullPcBoard(a: FullPcBoardRow, b: FullPcBoardRow) {
  return Number(a.unavailable) - Number(b.unavailable) ||
    Number(Boolean(b.recommendation)) - Number(Boolean(a.recommendation)) ||
    Number(Boolean(b.comparison)) - Number(Boolean(a.comparison)) ||
    Number(b.checkedToday) - Number(a.checkedToday) ||
    Number(Boolean(b.review)) - Number(Boolean(a.review)) ||
    Number(Boolean(b.offer)) - Number(Boolean(a.offer)) ||
    (b.quality?.confirmed ?? -1) - (a.quality?.confirmed ?? -1) || a.product.name.localeCompare(b.product.name, "ko");
}

export function homeFullPcCandidates(rows: readonly FullPcBoardRow[], tier: FullPcBoardRow["tier"]) {
  const candidates = rows.filter(row => row.tier === tier && !row.unavailable && row.offer).sort(orderFullPcBoard);
  const recommended = candidates.filter(row => row.recommendation);
  const observed = candidates.filter(row => row.checkedToday && row.review && row.offer?.availability === "in-stock");
  return (recommended.length ? recommended : observed.length ? observed : candidates).slice(0, 4);
}
