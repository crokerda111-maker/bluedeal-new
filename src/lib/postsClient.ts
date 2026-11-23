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

export function postErrorMessage(error: unknown, fallback = "저장하지 못했습니다. 입력한 내용은 유지됩니다. 잠시 후 다시 시도해 주세요."): string {
  if (error instanceof ApiError && error.status !== undefined && [400, 401, 403, 413, 415, 429].includes(error.status)) return error.message;
  return fallback;
}

type PostDraft = {
  type: PostType;
  content: string;
  authorName?: string;
  extra?: PostExtra;
  isPrivate?: boolean;
  password?: string | null;
  /** 문의(가격현황 제보 등)에서: 운영자 비번으로 자동 잠금 */
  lockToAdminPassword?: boolean;
};

export type CreatePostPayload = PostDraft & (
  | { boardKey: "issue"; title?: string }
  | { boardKey: Exclude<BoardKey, "issue">; title: string }
);

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
  const code = typeof data?.errorCode === "string" && /^[A-Z0-9_]{1,64}$/.test(data.errorCode) ? data.errorCode : undefined;
  const configuredMessage = code === "KV_NOT_CONFIGURED" ? "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다."
    : code === "ADMIN_PASSWORD_NOT_CONFIGURED" ? "관리자 비밀번호가 아직 설정되지 않았습니다." : undefined;
  const suppliedMessage = res.status < 500 && typeof data?.error === "string" && data.error.trim().length <= 300 ? data.error.trim() : "";
  throw new ApiError(configuredMessage ?? (suppliedMessage || "요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요."), { code, status: res.status });
}

function invalidResponse(res: Response): never {
  throw new ApiError("서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", { code: "INVALID_API_RESPONSE", status: res.status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPost(value: unknown): value is Post {
  if (!isRecord(value) || "passwordHash" in value) return false;
  if (!["id", "boardKey", "type", "title", "content", "createdAt"].every(key => typeof value[key] === "string")) return false;
  if (!value.id || (value.isPrivate !== undefined && typeof value.isPrivate !== "boolean")) return false;
  if (value.authorName != null && typeof value.authorName !== "string") return false;
  return value.extra == null || isRecord(value.extra);
}

function readPost(res: Response, data: unknown, expectedId?: string): Post {
  if (!isRecord(data) || !isPost(data.post) || (expectedId !== undefined && data.post.id !== expectedId)) return invalidResponse(res);
  return data.post;
}

function requireSuccess(res: Response, data: unknown): void {
  if (!isRecord(data) || data.ok !== true) invalidResponse(res);
}

export async function apiListPosts(boardKey: BoardKey, limit = 50): Promise<Post[]> {
  const res = await fetch(
    `/api/posts?boardKey=${encodeURIComponent(boardKey)}&limit=${encodeURIComponent(String(limit))}`,
    { method: "GET", cache: "no-store" },
  );
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  if (!isRecord(data) || !Array.isArray(data.posts) || !data.posts.every(post => isPost(post) && post.boardKey === boardKey)) return invalidResponse(res);
  return data.posts as Post[];
}

export async function apiGetPost(id: string, opts?: { password?: string }): Promise<Post> {
  const password = opts?.password;
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}${password === undefined ? "" : "/unlock"}`, password === undefined ? { method: "GET", cache: "no-store" } : {
    method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  const post = readPost(res, data, id);
  const info = post.linkInfo;
  if (!isRecord(info) || Object.keys(info).some(key => !["affiliateHrefs", "disclosures", "linkReplacements", "unavailableHrefs"].includes(key)) ||
      !Array.isArray(info.affiliateHrefs) || !info.affiliateHrefs.every(value => typeof value === "string") ||
      !Array.isArray(info.unavailableHrefs) || !info.unavailableHrefs.every(value => typeof value === "string") ||
      !Array.isArray(info.disclosures) || !info.disclosures.every(value => ["linkprice", "coupang", "bluedeal", "external"].includes(value)) ||
      (info.linkReplacements !== undefined && (!isRecord(info.linkReplacements) || Object.values(info.linkReplacements).some(value =>
        typeof value !== "string" || !/^\/go\/[a-zA-Z0-9_-]{2,64}$/.test(value))))) return invalidResponse(res);
  return post;
}

export async function apiCreatePost(payload: CreatePostPayload): Promise<Post> {
  const res = await fetch(`/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  const post = readPost(res, data);
  if (post.boardKey !== payload.boardKey) return invalidResponse(res);
  return post;
}

export async function apiUpdatePost(id: string, patch: UpdatePostPayload): Promise<Post> {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  return readPost(res, data, id);
}

export async function apiDeletePost(id: string): Promise<void> {
  const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  requireSuccess(res, data);
}

export async function apiAdminStatus(): Promise<boolean> {
  const res = await fetch(`/api/admin/status`, { method: "GET", cache: "no-store" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  if (!isRecord(data) || typeof data.admin !== "boolean") return invalidResponse(res);
  return data.admin;
}

export async function apiAdminLogin(password: string): Promise<void> {
  const res = await fetch(`/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  requireSuccess(res, data);
}

export async function apiAdminLogout(): Promise<void> {
  const res = await fetch(`/api/admin/logout`, { method: "POST" });
  const data = await parseJsonSafe(res);
  if (!res.ok) throwApiError(res, data);
  requireSuccess(res, data);
}
