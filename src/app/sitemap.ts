import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { COMMUNITY_BOARDS } from "../lib/boardConfig";
import { PRICE_CATEGORIES } from "../lib/priceCategories";
import { getLocalPrices } from "../lib/localPrices";
import { getReviewedMarketplaceFullPcs } from "../lib/marketFullPc";
import { GMARKET_BLACK_FRIDAY } from "../lib/gmarketBlackFriday";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/about", "/community-policy", "/it", "/community", "/prices", "/events", GMARKET_BLACK_FRIDAY.path, ...COMMUNITY_BOARDS.map(board => `/community/${board.slug}`)];
  return [
    ...paths.map(path => ({ url: `${SITE_URL}${path}` })),
    ...PRICE_CATEGORIES.flatMap(category => {
      const data = getLocalPrices(category.key);
      if (!data.items.length) return [];
      return [{ url: `${SITE_URL}/prices/${category.key}`, ...(data.updatedAt ? { lastModified: data.updatedAt } : {}) }];
    }),
    ...getReviewedMarketplaceFullPcs().map(({ product, review }) => ({
      url: `${SITE_URL}/products/${product.id}`,
      lastModified: review.checkedOn,
    })),
  ];
}
