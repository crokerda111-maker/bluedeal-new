import type { BoardKey, Post, PostExtra, PostType } from "./postTypes";

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

export type CreatePostPayload = {
  boardKey: BoardKey;
  type: PostType;
  title: string;
  content: string;
  authorName?: string;
  extra?: PostExtra;
  isPrivate?: boolean;
  password?: string | null;
  /** 문의(가격현황 제보 등)에서: 운영자 비번으로 자동 잠금 */
  lockToAdminPassword?: boolean;
};

export type UpdatePostPayload = Partial<{
  type: PostType;
  title: string;
  content: string;
  authorName: string | null;
  isPrivate: boolean;
  password: string | null;
  lockToAdminPassword: boolean;
  extra: PostExtra | null;
}>;

async function parseJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function throwApiError(res: Response, data: any) {
  const msg = data?.error || `Request failed (${res.status})`;
  throw new ApiError(msg, { code: data?.errorCode, status: res.status });
}

export async function apiListPosts(boardKey: BoardKey, limit = 50): Promise<Post[]> {
  const res = await fetch(
    `/api/posts?boardKey=${encodeURIComponent(boardKey)}&limit=${encodeURIComponent(String(limit))}`,
    { method: "GET" },
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  return Array.isArray(data?.posts) ? (data.posts as Post[]) : [];
}

export async function apiGetPost(id: string, opts?: { password?: string }): Promise<Post> {
  const qs = opts?.password ? `?pw=${encodeURIComponent(opts.password)}` : "";
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}${qs}`, { method: "GET" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  if (!data?.post) throw new ApiError("Post payload missing", { status: res.status });
  return data.post as Post;
}

export async function apiCreatePost(payload: CreatePostPayload): Promise<Post> {
  const res = await fetch(`/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  if (!data?.post) throw new ApiError("Post payload missing", { status: res.status });
  return data.post as Post;
}

export async function apiUpdatePost(id: string, patch: UpdatePostPayload): Promise<Post> {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  if (!data?.post) throw new ApiError("Post payload missing", { status: res.status });
  return data.post as Post;
}

export async function apiDeletePost(id: string): Promise<void> {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
}

export async function apiAdminStatus(): Promise<boolean> {
  const res = await fetch(`/api/admin/status`, { method: "GET" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  return Boolean(data?.admin);
}

export async function apiAdminLogin(password: string): Promise<void> {
  const res = await fetch(`/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
}

export async function apiAdminLogout(): Promise<void> {
  const res = await fetch(`/api/admin/logout`, { method: "POST" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
}
