import catalog from "../content/products/catalog.json";
import caseMarketOptions from "../content/products/caseMarketplaceOptions.json";
import reviewed from "../content/products/marketplaceListings.json";
import originalOutbound from "../content/outbound.generated.json";
import { normalizeOutboundUrl } from "./affiliate";
import type { PriceItem } from "./mockPrices";
import type { Merchant, OutboundLink } from "./outbound";
import { getCaseOptions } from "./productEditorial";

type ReviewedListing = {
  productId: string;
  url: string;
  seller: string;
  checkedOn: string;
  option?: string;
};

export type MarketPriceLink = {
  goCode: string;
  merchant: Merchant;
  seller?: string;
  option?: string;
  checkedOn?: string;
};

const recorded = originalOutbound as Record<string, OutboundLink>;

function productAddress(raw: string) {
  const url = normalizeOutboundUrl(raw);
  if (!url) return;
  const u = new URL(url);
  let match: string | null | undefined;
  let merchant: Merchant;
  if (u.hostname === "item.gmarket.co.kr" && u.pathname.toLowerCase() === "/item") {
    match = u.searchParams.get("goodsCode") ?? u.searchParams.get("goodscode");
    merchant = "gmarket";
  } else if (u.hostname === "itempage3.auction.co.kr" && u.pathname.toLowerCase() === "/detailview.aspx") {
    match = u.searchParams.get("itemno") ?? u.searchParams.get("ItemNo");
    merchant = "auction";
  } else if (u.hostname === "www.11st.co.kr") {
    match = u.pathname.match(/^\/products\/(\d+)\/?$/)?.[1];
    merchant = "11st";
  } else if (["www.ssg.com", "emart.ssg.com", "shinsegaemall.ssg.com"].includes(u.hostname) && u.pathname === "/item/itemView.ssg") {
    match = u.searchParams.get("itemId");
    merchant = "ssg";
  } else if (u.hostname === "www.lotteon.com") {
    match = u.pathname.match(/^\/p\/product\/LO(\d+)\/?$/)?.[1];
    merchant = "lotteon";
  } else {
    return;
  }
  const itemIdPattern = merchant === "auction" ? /^[A-Z]\d{7,12}$/ : /^\d{6,18}$/;
  if (!match || !itemIdPattern.test(match)) return;
  return { code: `market-${merchant}-${match}`, merchant, url };
}

// An item URL appearing on more than one product can be a shared option page.
const byAddress = new Map<string, { productIds: Set<string>; rows: ReviewedListing[] }>();
const exactReviewed = reviewed as ReviewedListing[];
for (const row of exactReviewed) {
  const address = productAddress(row.url);
  if (!address) continue;
  const existing = byAddress.get(address.code) ?? { productIds: new Set(), rows: [] };
  existing.productIds.add(row.productId);
  existing.rows.push(row);
  byAddress.set(address.code, existing);
}

const offerOwners = new Map(catalog.products.flatMap(product =>
  product.listings.map(offer => [offer.id, product.id] as const)));
const recordedByAddress = new Map<string, OutboundLink[]>();
for (const link of Object.values(recorded)) {
  const address = productAddress(link.originalUrl);
  if (address) {
    const matches = recordedByAddress.get(address.code) ?? [];
    matches.push(link);
    recordedByAddress.set(address.code, matches);
  }
}

for (const product of catalog.products) {
  if (product.kind === "product-family" || product.kind === "listed-wattage-option") continue;
  for (const source of product.sources) {
    if (source.kind !== "retailer-listing" || !source.observedAt) continue;
    const address = productAddress(source.url);
    if (!address) continue;
    const existing = byAddress.get(address.code) ?? { productIds: new Set(), rows: [] };
    existing.productIds.add(product.id);
    existing.rows.push({ productId: product.id, url: address.url, seller: "", checkedOn: source.observedAt });
    byAddress.set(address.code, existing);
  }
}

const linksByProduct = new Map<string, MarketPriceLink[]>();
const reviewedLinksByUrl = new Map<string, { productId: string; link: MarketPriceLink }>();
export const MARKETPLACE_OUTBOUND_LINKS: Record<string, OutboundLink> = {};
for (const [code, { productIds, rows }] of byAddress) {
  if (productIds.size !== 1) continue;
  const [preferred] = rows;
  const address = productAddress(preferred.url);
  if (!address) continue;
  const existing = recordedByAddress.get(code) ?? [];
  // A recorded sale keeps its original /go code and the exact registered URL.
  const same = existing.find(link => normalizeOutboundUrl(link.originalUrl) === address.url);
  if (existing.length && !same) continue;
  // Keep the earlier marketplace button URL after the same listing gains a recorded price.
  if (same?.code !== code) MARKETPLACE_OUTBOUND_LINKS[code] = { code, merchant: address.merchant, originalUrl: address.url };
  const productLinks = linksByProduct.get(preferred.productId) ?? [];
  const link = { goCode: same?.code ?? code, merchant: address.merchant, seller: preferred.seller || undefined, option: preferred.option, checkedOn: preferred.checkedOn };
  productLinks.push(link);
  linksByProduct.set(preferred.productId, productLinks);
  reviewedLinksByUrl.set(address.url, { productId: preferred.productId, link });
}

// A family can display an existing offer for an explicitly matched case option.
for (const { familyId, productId, option, url, checkedOn } of caseMarketOptions) {
  const variant = reviewedLinksByUrl.get(url);
  if (variant?.productId !== productId || !getCaseOptions(familyId)?.some(entry => entry.label === option)) continue;
  const familyLinks = linksByProduct.get(familyId) ?? [];
  familyLinks.push({ ...variant.link, option, checkedOn });
  linksByProduct.set(familyId, familyLinks);
}

export function productMarketplaceLinks(productId: string, offers: readonly PriceItem[], includeReviewed = true): MarketPriceLink[] {
  const soldOut = new Set(offers.filter(item => item.availability === "out-of-stock").map(item => item.goCode));
  const links = includeReviewed ? (linksByProduct.get(productId) ?? []).filter(link => !soldOut.has(link.goCode)) : [];
  const byCode = new Map(links.map(link => [link.goCode, link]));
  for (const item of offers) {
    if (!item.goCode || item.availability === "out-of-stock" || offerOwners.get(item.id) !== productId) continue;
    const link = recorded[item.goCode];
    if (!link || byCode.has(item.goCode)) continue;
    byCode.set(item.goCode, { goCode: item.goCode, merchant: link.merchant, seller: item.seller, checkedOn: item.checkedAt || item.updatedAt });
  }
  return [...byCode.values()];
}

export const MARKETPLACE_NAMES: Record<Merchant, string> = {
  gmarket: "G마켓", "11st": "11번가", ssg: "SSG.COM", lotteon: "롯데온", auction: "옥션",
  coupang: "쿠팡", aliexpress: "AliExpress", naver: "네이버", compuzone: "컴퓨존",
  seorinexpress: "서린 공식몰", darkflash: "다크플래쉬", icoda: "아이코다",
  redbitmall: "레드빗몰", ohou: "오늘의집",
};
