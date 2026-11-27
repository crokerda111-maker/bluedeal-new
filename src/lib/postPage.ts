import "server-only";

import { cache } from "react";
import type { BoardKey, Post } from "./postTypes";
import { getOnlinePostById } from "./onlinePosts";
import { getPostLinkInfo } from "./postLinkInfo";
import { pageMetadata } from "./site";

export function validPostPageId(id: string): boolean {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(id) && id !== "write";
}

const getPostForPage = cache(async (id: string, boardKey: BoardKey) => {
  if (!validPostPageId(id)) return null;
  const post = await getOnlinePostById(id);
  if (!post || post.id !== id || post.boardKey !== boardKey || typeof post.title !== "string") return null;
  return post;
});

export async function getPostPageInfo(id: string, boardKey: BoardKey) {
  const post = await getPostForPage(id, boardKey);
  if (!post) return null;
  return { id, boardKey, title: post.title, isPrivate: Boolean(post.isPrivate) };
}

export async function getPublicPostDetail(id: string, boardKey: BoardKey): Promise<Post | null> {
  const post = await getPostForPage(id, boardKey);
  if (!post || post.isPrivate || post.boardKey === "inquiry") return null;
  const { passwordHash, ...visible } = post;
  return { ...visible, linkInfo: await getPostLinkInfo(post) };
}

export function postPageMetadata(post: NonNullable<Awaited<ReturnType<typeof getPostPageInfo>>>, boardTitle: string, path: string) {
  if (post.isPrivate || post.boardKey === "inquiry") {
    return pageMetadata("문의 게시글 | BLUEDEAL", "블루딜 문의 게시판", undefined, true);
  }
  return pageMetadata(`${post.title.slice(0, 160)} | BLUEDEAL`, `블루딜 ${boardTitle} 게시글입니다.`, path);
}
