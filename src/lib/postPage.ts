import "server-only";

import { cache } from "react";
import type { BoardKey } from "./postTypes";
import { getOnlinePostById } from "./onlinePosts";
import { pageMetadata } from "./site";

/** 존재·게시판·공개 여부만 반환하며 본문·이메일·암호 해시는 전달하지 않습니다. */
export const getPostPageInfo = cache(async (id: string, boardKey: BoardKey) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  const post = await getOnlinePostById(id);
  if (!post || post.id !== id || post.boardKey !== boardKey || typeof post.title !== "string") return null;
  return { id, boardKey, title: post.title, isPrivate: Boolean(post.isPrivate) };
});

export function postPageMetadata(post: NonNullable<Awaited<ReturnType<typeof getPostPageInfo>>>, boardTitle: string, path: string) {
  if (post.isPrivate || post.boardKey === "inquiry") {
    return pageMetadata("문의 게시글 | BLUEDEAL", "블루딜 문의 게시판", undefined, true);
  }
  return pageMetadata(`${post.title.slice(0, 160)} | BLUEDEAL`, `블루딜 ${boardTitle} 게시글입니다.`, path);
}
