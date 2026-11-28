import reviews from "../content/fullPcReviews.json";
import { normalizeOutboundUrl } from "./affiliate";
import { CATALOG_PRODUCTS } from "./catalogData";
import { isPcToday, PC_PARTS, type PcSlot } from "./dailyPc";
import type { FullPcReview } from "./fullPcReview";
import { getLocalPrices } from "./localPrices";
import { OUTBOUND_LINKS } from "./outbound";
import type { PriceCategoryKey } from "./priceCategories";

const categories: Record<PcSlot, PriceCategoryKey> = {
  cpu: "cpu", gpu: "gpu", board: "motherboard", ram: "ram",
  storage: "ssd", psu: "psu", cooler: "cooler", case: "case",
};
const modelKey = (model: string) => model.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
const slots = Object.keys(PC_PARTS) as PcSlot[];
type PartOffer = { model: string; quantity: number; price: number; shipping: number; checkedAt: string; availabilityCheckedAt?: string; source: string };

const offersByModel = new Map<string, PartOffer[]>();
function addOffer(slot: PcSlot, offer: PartOffer) {
  const key = `${slot}:${modelKey(offer.model)}`;
  const group = offersByModel.get(key);
  if (group) group.push(offer);
  else offersByModel.set(key, [offer]);
}

for (const slot of slots) {
  const category = categories[slot];
  const items = new Map(getLocalPrices(category).items.map(item => [item.id, item]));
  for (const product of CATALOG_PRODUCTS.filter(product => product.category === category)) {
    for (const listing of product.listings) {
      const item = items.get(listing.id);
      const origin = item?.goCode ? OUTBOUND_LINKS[item.goCode]?.originalUrl : undefined;
      if (item?.availability !== "in-stock" || item.condition === "refurbished" || !item.checkedAt ||
          !item.availabilityCheckedAt || item.shippingFee == null || !origin) continue;
      addOffer(slot, { model: product.name, quantity: 1, price: item.price, shipping: item.shippingFee,
        checkedAt: item.checkedAt, availabilityCheckedAt: item.availabilityCheckedAt, source: origin });
    }
  }
}
for (const review of reviews as FullPcReview[]) {
  for (const slot of slots) {
    const quote = review.costComparison?.parts[slot];
    if (quote?.model === review.parts[slot]) addOffer(slot, quote);
  }
}

/** Only explicit model and quantity matches, with today's delivery-inclusive observations. */
export function dailyPartsBasket(review: FullPcReview, now: number) {
  const parts: (PartOffer & { slot: PcSlot; total: number })[] = [];
  for (const slot of slots) {
    const model = review.parts[slot];
    const quantity = review.quantities?.[slot] ?? 1;
    const offers = offersByModel.get(`${slot}:${modelKey(model)}`) ?? [];
    const best = offers.filter(offer => offer.quantity === quantity && Number.isSafeInteger(offer.price) &&
      offer.price > 0 && Number.isSafeInteger(offer.shipping) && offer.shipping >= 0 &&
      Boolean(normalizeOutboundUrl(offer.source)) && isPcToday(offer.checkedAt, now) &&
      isPcToday(offer.availabilityCheckedAt ?? offer.checkedAt, now))
      .map(offer => ({ ...offer, slot, total: offer.price * quantity + offer.shipping }))
      .filter(offer => Number.isSafeInteger(offer.total))
      .sort((a, b) => a.total - b.total || Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
    if (!best) return null;
    parts.push(best);
  }
  const total = parts.reduce((sum, part) => sum + part.total, 0);
  return Number.isSafeInteger(total) ? { parts, total } : null;
}
