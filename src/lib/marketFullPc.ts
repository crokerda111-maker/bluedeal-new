import reviews from "../content/fullPcReviews.json";
import { normalizeOutboundUrl } from "./affiliate";
import { getCatalogProduct } from "./catalogData";
import { isPcToday, kstDay } from "./dailyPc";
import { scoreFullPcParts, type FullPcReview } from "./fullPcReview";
import { type PriceItem } from "./mockPrices";
import { OUTBOUND_LINKS } from "./outbound";

const marketplaceReviews: readonly FullPcReview[] = reviews.filter(review => !review.configuration);

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
    const total = Number.isSafeInteger(offer.price) && offer.price > 0 && typeof offer.shippingFee === "number" &&
      Number.isSafeInteger(offer.shippingFee) && offer.shippingFee >= 0 ? offer.price + offer.shippingFee : null;
    const checkedToday = !!offer.checkedAt && isPcToday(offer.checkedAt, now);
    const current = review.checkedOn === day && checkedToday &&
      offer.availability === "in-stock" && offer.condition !== "refurbished" && total !== null && score !== null &&
      !!review.purchaseTerms?.os.trim() && !!review.purchaseTerms.warranty.trim();
    const comparison = review.costComparison;
    const savings = comparison?.checkedOn === day && Number.isSafeInteger(comparison.separateTotal) &&
      comparison.separateTotal > 0 && current && total !== null
      ? { amount: comparison.separateTotal - total, percent: (comparison.separateTotal - total) / comparison.separateTotal * 100, source: comparison.source }
      : null;

    return [{ product, review, offer, merchant, score, range, total, current, checkedToday, savings }];
  });
}
