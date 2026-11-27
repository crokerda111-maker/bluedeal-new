import backfilledDealIds from "../content/hotdeal-images.json";
import type { Post } from "./postTypes";

const backfilled = new Set<string>(backfilledDealIds);
const localPhoto = /^\/hotdeals\/(?:11st-\d+|deal-[0-9a-f]{32})\.webp$/;
const gmarketPhoto = /^https:\/\/gdimg\.gmarket\.co\.kr\/(\d+)\/still\/(?:280|300|600)(?:\?ver=\d+)?$/;
const coupangPhoto = /^https:\/\/thumbnail\.coupangcdn\.com\/thumbnails\/remote\/\d{2,4}x\d{2,4}(?:ex|fit)?\/image\/(?:vendor_inventory|retail\/images)\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)$/;

export function dealPhoto(post: Post): string | null {
  if (post.boardKey !== "hotdeal" || !post.hotdeal || post.isPrivate) return null;
  if (backfilled.has(post.id)) return `/hotdeals/${post.id}.webp`;
  const image = post.hotdeal.image;
  return image && (localPhoto.test(image) || gmarketPhoto.test(image) || coupangPhoto.test(image)) ? image : null;
}

/** Returns undefined when no photo was provided, and null when a provided photo is invalid. */
export function reviewedDealPhoto(input: unknown, merchant: string, productUrl: URL): string | null | undefined {
  if (merchant === "gmarket") {
    const id = [...productUrl.searchParams].find(([key]) => key.toLowerCase() === "goodscode")?.[1];
    if (id && /^\d+$/.test(id)) {
      if (input === undefined) return `https://gdimg.gmarket.co.kr/${id}/still/600`;
      if (typeof input === "string" && gmarketPhoto.exec(input)?.[1] === id) return input;
    }
  } else if (merchant === "coupang" && typeof input === "string" && coupangPhoto.test(input)) {
    return input;
  } else if (merchant === "11st" && typeof input === "string") {
    const id = productUrl.pathname.match(/^\/products\/(\d+)\/?$/)?.[1] ?? productUrl.searchParams.get("prdNo");
    if (id && /^\d+$/.test(id) && input === `/hotdeals/11st-${id}.webp`) return input;
  }
  return input === undefined ? undefined : null;
}
