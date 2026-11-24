import "server-only";

import { ALL_BOARDS, boardKeyToPath } from "./boardConfig";
import { HOTDEAL_CATEGORIES, hotdealCategory, hotdealPrice, isRecommendedHotdeal } from "./hotdeal";
import { listOnlinePostsByBoard } from "./onlinePosts";
import { formatKoreanDate } from "./postStorage";
import type { Post } from "./postTypes";

export type HomeFeedData = {
  deals: Array<{ href: string; title: string; category?: string; store: string; date: string; excerpt: string; price: string }> | null;
  posts: Array<{ href: string; title: string; author: string; date: string; board: string }>;
  failedCount: number;
};

function formatDealDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric" });
}

function detailPath(post: Post): string {
  return boardKeyToPath(post.boardKey) + "/" + encodeURIComponent(post.id);
}

export async function loadHomeFeed(): Promise<HomeFeedData> {
  const boards = ALL_BOARDS.filter(board => board.key !== "inquiry");
  const lists = await Promise.allSettled(boards.map(board =>
    listOnlinePostsByBoard(board.key, board.key === "hotdeal" ? 30 : 3, { includeHotdealClicks: false })));
  const now = Date.now();
  const recent: Array<{ post: Post; board: string }> = [];
  let deals: HomeFeedData["deals"] = null;
  let failedCount = 0;

  lists.forEach((list, index) => {
    if (list.status === "rejected") {
      failedCount++;
      return;
    }
    const board = boards[index];
    const publicPosts = list.value.filter(post => !post.isPrivate);
    const featured = board.key === "hotdeal" ? publicPosts.filter(post => isRecommendedHotdeal(post.hotdeal, now)) : publicPosts;
    recent.push(...featured.slice(0, 3).map(post => ({ post, board: board.title })));
    if (board.key !== "hotdeal") return;

    deals = featured.slice(0, 4).map(post => ({
      href: detailPath(post),
      title: post.title,
      category: post.extra?.category ? HOTDEAL_CATEGORIES.find(category => category.value === hotdealCategory(post.extra?.category))?.label : undefined,
      store: String(post.extra?.store ?? "판매처 미표시"),
      date: formatDealDate(post.createdAt),
      excerpt: (post.content ?? "").trim().replace(/\s+/g, " ").slice(0, 140),
      price: hotdealPrice(post) || "가격 확인",
    }));
  });

  const posts = recent.sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt)).slice(0, 3).map(({ post, board }) => ({
    href: detailPath(post),
    title: post.title,
    author: post.authorName ?? "익명",
    date: formatKoreanDate(post.createdAt),
    board,
  }));
  return { deals, posts, failedCount };
}
