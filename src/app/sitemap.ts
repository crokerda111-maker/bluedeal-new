import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { boardKeyToPath, COMMUNITY_BOARDS, IT_BOARD } from "../lib/boardConfig";
import { CATALOG_PRODUCTS } from "../lib/catalogData";
import { isIndexableComponent } from "../lib/componentDiscovery";
import { PRICE_CATEGORIES } from "../lib/priceCategories";
import { getLocalPrices } from "../lib/localPrices";
import { getReviewedMarketplaceFullPcs } from "../lib/marketFullPc";
import { GMARKET_BLACK_FRIDAY } from "../lib/gmarketBlackFriday";
import { listOnlinePostsByBoard } from "../lib/onlinePosts";
import { validPostPageId } from "../lib/postPage";

export const dynamic = "force-dynamic";

async function publicPostUrls(): Promise<MetadataRoute.Sitemap> {
  const boards = [IT_BOARD, ...COMMUNITY_BOARDS];
  const results = await Promise.allSettled(boards.map(async ({ key }) => {
    const posts = await listOnlinePostsByBoard(key, 200, { includeHotdealClicks: false });
    return posts.flatMap(post => {
      if (post.boardKey !== key || post.isPrivate || !validPostPageId(post.id) ||
        typeof post.title !== "string" || !post.title.trim() ||
        typeof post.content !== "string" || !post.content.trim()) return [];
      const date = post.updatedAt ?? post.createdAt;
      return [{
        url: `${SITE_URL}${boardKeyToPath(key)}/${post.id}`,
        ...(Number.isFinite(Date.parse(date)) ? { lastModified: date } : {}),
      }];
    });
  }));
  return results.flatMap(result => result.status === "fulfilled" ? result.value : []);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.VERCEL_ENV === "preview") return [];
  const paths = ["/", "/about", "/community-policy", "/it", "/community", "/prices", "/evaluate", "/events", GMARKET_BLACK_FRIDAY.path, ...COMMUNITY_BOARDS.map(board => `/community/${board.slug}`)];
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
    ...CATALOG_PRODUCTS.filter(isIndexableComponent).map(product => ({
      url: `${SITE_URL}/products/${product.id}`,
    })),
    ...await publicPostUrls(),
  ];
}
