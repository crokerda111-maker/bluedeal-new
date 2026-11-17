import "server-only";
import type { Post, PostLinkInfo } from "./postTypes";
import type { OutboundLink } from "./outbound";
import { OUTBOUND_LINKS } from "./outbound";
import { detectMerchant, getRegisteredOutboundLink, isAffiliateHost, resolveAffiliateUrl } from "./affiliate";
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
  for (const href of hrefs) {
    const code = internalCode(href);
    if (!code) {
      // Direct merchant URLs do not go through our affiliate resolver.
      try {
        const url = new URL(href);
        const merchant = detectMerchant(url.hostname);
        if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.port &&
            ((merchant && isAffiliateHost(merchant, url.hostname)) || (url.hostname === "click.linkprice.com" && url.pathname === "/click.php"))) {
          info.affiliateHrefs.push(href);
          disclosures.add("external");
        }
      } catch { /* Plain text is preserved. */ }
      continue;
    }
    codes.set(href, code);
    const row = rows.get(code) ?? OUTBOUND_LINKS[code] ??
      (!pending.has(code) && pending.size < 100 ? getRegisteredOutboundLink(code) : null);
    if (row) rows.set(code, row);
    else pending.add(code);
  }
  // User-supplied /go paths cannot create an unbounded storage fan-out.
  try { for (const [code, row] of await getOutboundRows([...pending].slice(0, 100))) rows.set(code, row); }
  catch { /* Unverified links remain readable but do not become clickable. */ }
  for (const [href, code] of codes) {
    const row = rows.get(code);
    const resolved = row ? resolveAffiliateUrl({ ...row, code }) : null;
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
