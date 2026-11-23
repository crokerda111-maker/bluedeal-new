import reviews from "../content/fullPcReviews.json";
import marketplaceNotes from "../content/products/pcMarketplaceNotes.json";
import { normalizeOutboundUrl } from "./affiliate";
import { CATALOG_PRODUCTS, getCatalogProduct } from "./catalogData";
import { isPcToday, kstDay } from "./dailyPc";
import { scoreFullPcParts, separatePcTotal, type FullPcReview } from "./fullPcReview";
import { FULL_PC_TIERS, fullPcComparisonKey, fullPcGpuChip, fullPcPricePoints, fullPcTier, rankComparableFullPcs } from "./fullPcTiers";
import { type PriceItem } from "./mockPrices";
import { OUTBOUND_LINKS } from "./outbound";
import { pcCatalogConfiguration } from "./pcCatalogConfiguration";
import type { CatalogProduct } from "./productCatalog";

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

export function getReviewedMarketplaceFullPcs() {
  return marketplaceReviews.flatMap(review => {
    const product = getCatalogProduct(review.productId);
    return product?.kind === "retailer-reviewed-model" && product.category === "fullpc" ? [{ product, review }] : [];
  });
}

export function selectMarketplaceFullPcs(items: readonly PriceItem[], now: number) {
  const offers = new Map(items.map(item => [item.id, item]));
  const day = kstDay(now);

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
    const { score, range } = scoreFullPcParts(review);
    const total = deliveredTotal(offer);
    const checkedToday = !!offer.checkedAt && isPcToday(offer.checkedAt, now);
    const matchedToday = review.checkedOn === day && checkedToday && !!offer.availabilityCheckedAt &&
      isPcToday(offer.availabilityCheckedAt, now) && review.tested.psu?.results[0] === true &&
      offer.availability === "in-stock" && offer.condition !== "refurbished" && total !== null &&
      !review.configurationConflict && !review.notForSale && !!review.priceOption && review.priceOption === offer.spec &&
      !!review.purchaseTerms?.os.trim() && !!review.purchaseTerms.warranty.trim();
    const current = matchedToday && score !== null;
    const separateTotal = current ? separatePcTotal(review, now) : null;
    const savings = separateTotal && total !== null
      ? { amount: separateTotal - total, percent: (separateTotal - total) / separateTotal * 100 }
      : null;

    return [{ product, review, offer, merchant, score, range, total, current, matchedToday, checkedToday, savings }];
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
  score: number | null;
  range?: readonly [number, number];
  priceScore?: number;
  total: number | null;
  checkedToday: boolean;
  unavailable: boolean;
  comparison: string | null;
  placement?: RankedPick;
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
    const assessment = review ? scoreFullPcParts(review) : null;
    const note = marketplaceNotes[product.id as keyof typeof marketplaceNotes];
    const notForSale = (note && "saleStatus" in note && note.saleStatus === "not-for-sale") || review?.notForSale;
    const comparison = verifiedOffer?.matchedToday && review?.purchaseTerms
      ? fullPcComparisonKey(review.parts.cpu, review.parts.gpu, review.purchaseTerms.os) : null;
    const recommendation = comparison && verifiedOffer?.savings && verifiedOffer.savings.amount > 0 ? verifiedOffer.savings : undefined;
    return { product, review, offer, cpu, gpu, tier, score: assessment?.score ?? null, range: assessment?.range,
      total: deliveredTotal(offer), checkedToday: !!offer?.checkedAt && isPcToday(offer.checkedAt, now),
      unavailable: !!notForSale || offer?.availability === "out-of-stock",
      comparison, recommendation, merchant: verifiedOffer?.merchant };
  });

  for (const group of groupComparableFullPcs(rows).values()) {
    const priced = group.flatMap(row => row.total === null ? [] : [{ row, total: row.total }]);
    if (priced.length < 2) continue;

    const lowest = Math.min(...priced.map(entry => entry.total));
    for (const { row, total } of priced) row.priceScore = fullPcPricePoints(total, lowest);

    const ranked = rankComparableFullPcs(priced.flatMap(({ row, total }) => row.score === null ? [] :
      [{ id: row.product.id, row, score: row.score, total }]), lowest);
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
    (b.score ?? -1) - (a.score ?? -1) || a.product.name.localeCompare(b.product.name, "ko");
}

export function homeFullPcCandidates(rows: readonly FullPcBoardRow[], tier: FullPcBoardRow["tier"]) {
  const candidates = rows.filter(row => row.tier === tier && !row.unavailable && row.offer).sort(orderFullPcBoard);
  const recommended = candidates.filter(row => row.recommendation);
  const observed = candidates.filter(row => row.checkedToday && row.review && row.offer?.availability === "in-stock");
  return (recommended.length ? recommended : observed.length ? observed : candidates).slice(0, 4);
}
