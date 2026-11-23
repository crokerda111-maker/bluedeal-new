import "server-only";
import type { Post, PostLinkInfo } from "./postTypes";
import type { OutboundLink } from "./outbound";
import { OUTBOUND_LINKS } from "./outbound";
import { detectMerchant, getRegisteredOutboundLink, isAffiliateHost, normalizeOutboundUrl, resolveAffiliateUrl } from "./affiliate";
import { getStoredAffiliateCodes, getStoredAffiliateMappings } from "./affiliateStore";
import { getOutboundRows } from "./onlineOutbound";
import { textLinkParts } from "./textLinks";

function internalCode(href: string): string | null {
  try {
    const url = new URL(href, "https://bluedeal.co.kr");
    if (!["https:", "http:"].includes(url.protocol) || !["bluedeal.co.kr", "www.bluedeal.co.kr"].includes(url.hostname) || url.username || url.password || url.port) return null;
    return url.pathname.match(/^\/go\/([a-zA-Z0-9_-]{2,64})\/?$/)?.[1] ?? null;
  } catch { return null; }
}

export async function getPostLinkInfo(post: Post): Promise<PostLinkInfo> {
  const hrefs = new Set(textLinkParts(post.content).flatMap(part => part.href ? [part.href] : []));
  for (const value of Object.values(post.extra ?? {})) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (/^https?:\/\//i.test(text) || text.startsWith("/go/")) hrefs.add(text);
  }
  const info: PostLinkInfo = { affiliateHrefs: [], unavailableHrefs: [], disclosures: [] };
  const disclosures = new Set<PostLinkInfo["disclosures"][number]>();
  const codes = new Map<string, string>();
  const rows = new Map<string, OutboundLink>();
  const pending = new Set<string>();
  const rawHotdeals = new Map<string, string>();
  for (const href of hrefs) {
    const code = internalCode(href);
    if (!code) {
      try {
        const url = new URL(href);
        const merchant = detectMerchant(url.hostname);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.port &&
            ((merchant && isAffiliateHost(merchant, url.hostname)) || (url.hostname === "click.linkprice.com" && url.pathname === "/click.php"))) {
          info.affiliateHrefs.push(href);
          disclosures.add("external");
        } else if (post.boardKey === "hotdeal" && rawHotdeals.size < 20 && (merchant === "gmarket" || merchant === "11st")) {
          const original = normalizeOutboundUrl(href);
          if (original) rawHotdeals.set(href, original);
        }
      } catch { /* Plain text is preserved. */ }
      continue;
    }
    codes.set(href, code);
    const row = rows.get(code) ?? (Object.hasOwn(OUTBOUND_LINKS, code) ? OUTBOUND_LINKS[code] : undefined) ??
      (!pending.has(code) && pending.size < 100 ? getRegisteredOutboundLink(code) : null);
    if (row) rows.set(code, row);
    else pending.add(code);
  }
  // User-supplied /go paths cannot create an unbounded storage fan-out.
  try { for (const [code, row] of await getOutboundRows([...pending].slice(0, 100))) rows.set(code, row); }
  catch { /* Unverified links remain readable but do not become clickable. */ }
  for (const [code, row] of await getStoredAffiliateCodes([...pending].filter(code => !rows.has(code)).slice(0, 100))) rows.set(code, row);
  const stored = await getStoredAffiliateMappings([...rows.values()].map(row => row.originalUrl).concat([...rawHotdeals.values()]));
  const rawAliases = await getStoredAffiliateCodes([...rawHotdeals.values()].flatMap(original => {
    const mapping = stored.get(original);
    return mapping ? [mapping.code] : [];
  }));
  for (const [href, original] of rawHotdeals) {
    const mapping = stored.get(original);
    if (!mapping || rawAliases.get(mapping.code)?.originalUrl !== original) continue;
    (info.linkReplacements ??= {})[href] = `/go/${mapping.code}`;
    info.affiliateHrefs.push(href);
    disclosures.add("linkprice");
  }
  for (const [href, code] of codes) {
    const row = rows.get(code);
    const resolved = row ? resolveAffiliateUrl({ ...row, code }, stored.get(normalizeOutboundUrl(row.originalUrl) ?? "")) : null;
    if (!resolved) { info.unavailableHrefs.push(href); continue; }
    if (resolved.mode === "passthrough") continue;
    info.affiliateHrefs.push(href);
    if (resolved.mode === "already-affiliate") disclosures.add("external");
    else if (["app.ac", "click.linkprice.com"].includes(new URL(resolved.url).hostname)) disclosures.add("linkprice");
    else if (resolved.merchant === "coupang") disclosures.add("coupang");
    else disclosures.add("bluedeal");
  }
  info.disclosures = [...disclosures];
  return info;
}
