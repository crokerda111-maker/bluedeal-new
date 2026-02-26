import React from "react";
import SmartLink from "./SmartLink";

const LINK_RE = /(https?:\/\/[^\s<>"']+|\/go\/[A-Za-z0-9_-]{4,})/g;

function stripTrailingPunct(raw: string): { href: string; trailing: string } {
  let href = raw;
  let trailing = "";

  while (href.length && /[\.,;:!?]$/.test(href)) {
    trailing = href.slice(-1) + trailing;
    href = href.slice(0, -1);
  }

  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  for (const [open, close] of pairs) {
    while (href.endsWith(close)) {
      const opens = (href.match(new RegExp(`\\${open}`, "g")) ?? []).length;
      const closes = (href.match(new RegExp(`\\${close}`, "g")) ?? []).length;
      if (closes <= opens) break;
      trailing = close + trailing;
      href = href.slice(0, -1);
    }
  }

  return { href, trailing };
}

type Props = {
  text: string;
  className?: string;
  linkClassName?: string;
};

/**
 * Render plain text while auto-linking http(s) URLs and /go/* links.
 * - External links open in a new tab (SmartLink behavior)
 */
export default function LinkifiedText({ text, className, linkClassName }: Props) {
  if (!text) return null;

  const parts = text.split(LINK_RE);

  return (
    <div className={className}>
      {parts.map((p, idx) => {
        if (!p) return null;
        if (p.startsWith("/go/") || /^https?:\/\//i.test(p)) {
          const { href, trailing } = stripTrailingPunct(p);
          return (
            <React.Fragment key={idx}>
              <SmartLink href={href} className={linkClassName ?? "text-cyan-200 hover:underline"}>
                {href}
              </SmartLink>
              {trailing}
            </React.Fragment>
          );
        }

        return <React.Fragment key={idx}>{p}</React.Fragment>;
      })}
    </div>
  );
}
