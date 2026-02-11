import Link from "next/link";
import type { ReactNode } from "react";

export function isExternalHref(href: string): boolean {
  if (!href) return false;

  // Internal outbound redirect endpoint.
  if (href.startsWith("/go/")) return true;

  // Absolute URLs are treated as external.
  return /^https?:\/\//i.test(href);
}

/**
 * Returns true when the value is a http(s) absolute URL.
 *
 * Intentionally NOT a TypeScript type predicate.
 * Some pages pass a `string` and then do `isHttpUrl(text) || text.startsWith(...)`.
 * If this were a type predicate, TS could narrow the false branch of a `string` to `never`.
 */
export function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v.trim());
}

type SmartLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  /** Force opening in a new tab. If omitted, external links auto-open in new tab. */
  newTab?: boolean;
  rel?: string;
};

/**
 * SmartLink
 * - Internal links: Next.js Link (same tab)
 * - External/outbound links: <a target="_blank" rel="noopener noreferrer">
 */
export default function SmartLink({ href, children, className, title, newTab, rel }: SmartLinkProps) {
  const external = typeof newTab === "boolean" ? newTab : isExternalHref(href);

  if (external) {
    return (
      <a href={href} className={className} title={title} target="_blank" rel={rel ?? "noopener noreferrer"}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
