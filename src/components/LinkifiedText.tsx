import React from "react";
import type { PostLinkInfo } from "../lib/postTypes";
import { textLinkParts } from "../lib/textLinks";
import PostContentLink from "./PostContentLink";

type Props = { text: string; className?: string; linkClassName?: string; linkInfo?: PostLinkInfo };

export default function LinkifiedText({ text, className, linkClassName, linkInfo }: Props) {
  if (!text) return null;
  return <div className={`min-w-0 [overflow-wrap:anywhere] ${className ?? ""}`}>
    {textLinkParts(text).map((part, index) => part.href
      ? <PostContentLink key={index} href={part.href} info={linkInfo} className={linkClassName}>{part.text}</PostContentLink>
      : <React.Fragment key={index}>{part.text}</React.Fragment>)}
  </div>;
}
