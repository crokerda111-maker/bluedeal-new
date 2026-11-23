import { CATALOG_PRODUCTS } from "../../../../lib/catalogData";
import { getLocalPrices } from "../../../../lib/localPrices";
import { PRICE_CATEGORIES } from "../../../../lib/priceCategories";

const productByListing = new Map(CATALOG_PRODUCTS.flatMap(product => product.listings.map(listing => [listing.id, product.id] as const)));

export function GET() {
  const observations = PRICE_CATEGORIES.flatMap(({ key }) => getLocalPrices(key).items.flatMap(item => {
    const productId = productByListing.get(item.id);
    if (!productId || !item.checkedAt || !Number.isSafeInteger(item.price) || item.price <= 0) return [];
    return [{
      id: item.id, productId, category: key, name: item.name, option: item.spec ?? "",
      seller: item.seller ?? "", source: item.source ?? "", checkedAt: item.checkedAt, price: item.price,
      shipping: item.shippingFee ?? null, availability: item.availability ?? "unknown",
    }];
  }));
  return Response.json({ service: "BLUEDEAL", schemaVersion: 1, observations }, { headers: {
    "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex, nofollow",
  } });
}
