/**
 * Bluedeal Headless API client
 *
 * Backend: WordPress plugin (Bluedeal Headless API)
 * Base: https://blusedeal.co.kr/wp-json/bluedeal/v1
 */

import type { BoardKey } from "./boardConfig";
import type { Comment, Post, PostType } from "./postTypes";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");

export type ApiError = {
  code?: string;
  message?: string;
  details?: any;
};

export type ApiUser = {
  id: number;
  email: string;
  nickname: string;
  role?: string;
  created_at: string;
};

export type ApiBoard = {
  slug: string;
  name: string;
  sort_order: number;
  is_public: 0 | 1;
};

export type ApiPost = {
  id: number;
  board_slug: string;
  type: string;
  title: string;
  // list()에서는 content가 없을 수 있음
  content?: string;
  // JSON object
  extra?: any;
  author_nickname?: string;
  author_email?: string;
  is_private: 0 | 1;
  created_at: string; // MySQL UTC: YYYY-MM-DD HH:mm:ss
  updated_at?: string;
};

export type ApiComment = {
  id: number;
  post_id: number;
  user_id?: number;
  author_nickname?: string;
  content: string;
  created_at: string; // MySQL UTC
};

export type ApiListResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

function assertApiBase() {
  if (!API_BASE) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE가 비어있습니다. Vercel 환경변수에 NEXT_PUBLIC_API_BASE를 설정하세요. 예) https://blusedeal.co.kr/wp-json/bluedeal/v1"
    );
  }
}

async function apiFetch<T>(
  path: string,
  opts: RequestInit & { json?: any } = {}
): Promise<T> {
  assertApiBase();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers as any),
  };

  let body = opts.body;
  if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    body,
    credentials: "include",
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error?.message)) ||
      `API 요청 실패: ${res.status}`;
    const err: ApiError = {
      code: data?.code,
      message: msg,
      details: data,
    };
    throw Object.assign(new Error(msg), { api: err, status: res.status });
  }

  return data as T;
}

/**
 * 보드 키(inquiry) → 실제 API 보드 slug(contact)
 * (UI에서는 /contact, 내부 BoardKey는 inquiry로 유지)
 */
function normalizeBoardSlug(boardKeyOrSlug: string): string {
  return boardKeyOrSlug === "inquiry" ? "contact" : boardKeyOrSlug;
}

function normalizeBoardKeyFromSlug(slug: string): BoardKey {
  // contact 보드는 UI에서 inquiry로 부름
  if (slug === "contact") return "inquiry";

  // 나머지는 slug === key
  return slug as BoardKey;
}

const POST_TYPES: PostType[] = ["general", "question", "tip"];
function normalizePostType(t: any): PostType {
  return POST_TYPES.includes(t) ? (t as PostType) : "general";
}

export function mysqlUtcToIso(mysqlUtc: string | undefined | null): string {
  if (!mysqlUtc) return new Date().toISOString();
  // Already ISO?
  if (mysqlUtc.includes("T")) return mysqlUtc;
  // MySQL UTC -> ISO
  return `${mysqlUtc.replace(" ", "T")}Z`;
}

export function mapApiPostToPost(p: ApiPost): Post {
  const boardKey = normalizeBoardKeyFromSlug(p.board_slug);
  return {
    id: String(p.id),
    boardKey,
    type: normalizePostType(p.type),
    title: p.title,
    content: p.content || "",
    authorName: p.author_nickname || "익명",
    createdAt: mysqlUtcToIso(p.created_at),
    updatedAt: p.updated_at ? mysqlUtcToIso(p.updated_at) : undefined,
    isPinned: false,
    isPrivate: Boolean(p.is_private),
    extra: p.extra || {},
    viewCount: 0,
    commentsCount: 0,
  };
}

export function mapApiCommentToComment(c: ApiComment): Comment {
  return {
    id: String(c.id),
    postId: String(c.post_id),
    authorName: c.author_nickname || "익명",
    content: c.content,
    createdAt: mysqlUtcToIso(c.created_at),
  };
}

// -----------------
// Auth
// -----------------

export async function apiHealth() {
  return apiFetch<{ ok: true; now: string; version: string }>(`/health`, {
    method: "GET",
  });
}

export async function apiSignup(payload: {
  email: string;
  password: string;
  nickname: string;
  consents?: {
    terms: boolean;
    privacy: boolean;
    age14: boolean;
    agreedAt?: string;
  };
}) {
  return apiFetch<{ ok: true; user: ApiUser }>(`/auth/signup`, {
    method: "POST",
    json: payload,
  });
}

export async function apiLogin(payload: { email: string; password: string }) {
  return apiFetch<{ ok: true; user: ApiUser }>(`/auth/login`, {
    method: "POST",
    json: payload,
  });
}

export async function apiLogout() {
  return apiFetch<{ ok: true }>(`/auth/logout`, {
    method: "POST",
  });
}

export async function apiMe() {
  return apiFetch<{ ok: true; user: ApiUser }>(`/auth/me`, {
    method: "GET",
  });
}

// -----------------
// Boards / Posts
// -----------------

export async function apiListBoards() {
  // plugin 응답: { boards: [...] }
  const data = await apiFetch<{ boards?: ApiBoard[]; items?: ApiBoard[] }>(`/boards`, {
    method: "GET",
  });
  return {
    items: (data.items || data.boards || []) as ApiBoard[],
  };
}

export async function apiListBoardPosts(
  boardKeyOrSlug: string,
  pageOrOpts: number | { page?: number; page_size?: number } = 1,
  pageSizeMaybe: number = 10
): Promise<ApiListResponse<ApiPost>> {
  const board = normalizeBoardSlug(boardKeyOrSlug);

  const page =
    typeof pageOrOpts === "number" ? pageOrOpts : Number(pageOrOpts.page || 1);
  const page_size =
    typeof pageOrOpts === "number"
      ? pageSizeMaybe
      : Number(pageOrOpts.page_size || 10);

  const qs = new URLSearchParams({
    page: String(page),
    page_size: String(page_size),
  });

  // plugin 응답: { posts: [...], page, page_size, total }
  const data = await apiFetch<any>(
    `/boards/${encodeURIComponent(board)}/posts?${qs.toString()}`,
    {
      method: "GET",
    }
  );

  // 호환: items/posts
  const items = (data.items || data.posts || []) as ApiPost[];
  return {
    items,
    page: Number(data.page || page),
    page_size: Number(data.page_size || page_size),
    total: Number(data.total || items.length),
  };
}

export async function apiGetPost(postId: string | number) {
  // plugin 응답: { post: {...} }
  return apiFetch<{ post: ApiPost }>(`/posts/${encodeURIComponent(String(postId))}`, {
    method: "GET",
  });
}

export type ApiCreatePostPayload = {
  type: string;
  title: string;
  content: string;
  extra?: any;
  is_private?: boolean;
  password?: string;
};

export async function apiCreatePost(boardKeyOrSlug: string, payload: ApiCreatePostPayload) {
  const board = normalizeBoardSlug(boardKeyOrSlug);

  // plugin create 응답: { ok:true, id:<number> }
  const created = await apiFetch<{ ok: true; id: number }>(`/boards/${encodeURIComponent(board)}/posts`, {
    method: "POST",
    json: {
      ...payload,
      // plugin은 0/1을 기대하지만 bool도 처리 가능하게끔 보내도 됨.
      is_private: payload.is_private ? 1 : 0,
    },
  });

  // 작성 후 바로 상세 데이터까지 돌려주면 UI에서 편함
  const detail = await apiGetPost(created.id);
  return { ok: true as const, post: detail.post };
}

export async function apiDeletePost(postId: string | number) {
  return apiFetch<{ ok: true }>(`/posts/${encodeURIComponent(String(postId))}`, {
    method: "DELETE",
  });
}

// -----------------
// Comments
// -----------------

export async function apiListComments(
  postId: string | number,
  pageOrOpts: number | { page?: number; page_size?: number } = 1,
  pageSizeMaybe: number = 10
): Promise<ApiListResponse<ApiComment>> {
  const page =
    typeof pageOrOpts === "number" ? pageOrOpts : Number(pageOrOpts.page || 1);
  const page_size =
    typeof pageOrOpts === "number"
      ? pageSizeMaybe
      : Number(pageOrOpts.page_size || 10);

  const qs = new URLSearchParams({
    page: String(page),
    page_size: String(page_size),
  });

  // plugin 응답: { comments: [...], page, page_size, total }
  const data = await apiFetch<any>(
    `/posts/${encodeURIComponent(String(postId))}/comments?${qs.toString()}`,
    {
      method: "GET",
    }
  );

  const items = (data.items || data.comments || []) as ApiComment[];
  return {
    items,
    page: Number(data.page || page),
    page_size: Number(data.page_size || page_size),
    total: Number(data.total || items.length),
  };
}

export async function apiCreateComment(
  postId: string | number,
  payload: { content: string } | string
) {
  const json = typeof payload === "string" ? { content: payload } : payload;

  // plugin 응답: { ok:true, id:<number> }
  const created = await apiFetch<{ ok: true; id: number }>(
    `/posts/${encodeURIComponent(String(postId))}/comments`,
    {
      method: "POST",
      json,
    }
  );

  return { ok: true as const, id: created.id };
}
