import type { ReactNode } from "react";
import type { PostLinkInfo } from "../lib/postTypes";
import SmartLink from "./SmartLink";

export default function PostContentLink({ href, info, children, className }: { href: string; info?: PostLinkInfo; children: ReactNode; className?: string }) {
  if (info?.unavailableHrefs.includes(href)) return <span>{children}<span className="ml-1 text-xs text-amber-200">(링크 확인 필요)</span></span>;
  const affiliate = info?.affiliateHrefs.includes(href);
  return <>
    <SmartLink href={href} className={className ?? "text-cyan-200 hover:underline"} title={affiliate ? "제휴 링크 (새 창)" : "새 창으로 열기"} rel={affiliate ? "sponsored ugc noopener noreferrer" : "ugc noopener noreferrer"}>{children}</SmartLink>
    {affiliate ? <span className="ml-1 text-xs text-cyan-100">(제휴 링크)</span> : null}
  </>;
}
