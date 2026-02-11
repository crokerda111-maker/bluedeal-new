import type { BoardKey, Post, PostExtra } from "./postTypes";

const STORAGE_KEY = "bluedeal_posts_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadLocalPosts(): Post[] {
  if (!isBrowser()) return [];
  const parsed = safeJsonParse<Post[]>(window.localStorage.getItem(STORAGE_KEY));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLocalPosts(posts: Post[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

export function getLocalPostsByBoard(boardKey: BoardKey): Post[] {
  const posts = loadLocalPosts();
  return posts
    .filter((p) => p.boardKey === boardKey)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getLocalPostById(id: string): Post | undefined {
  const posts = loadLocalPosts();
  return posts.find((p) => p.id === id);
}

function randomId(): string {
  if (isBrowser()) {
    const c: Crypto | undefined = (window as any).crypto;
    if (c && typeof (c as any).randomUUID === "function") {
      return (c as any).randomUUID();
    }
  }
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function sha256(text: string): Promise<string> {
  if (!isBrowser()) return "";

  const c: Crypto | undefined = (window as any).crypto;
  const subtle = (c as any)?.subtle;
  if (!subtle) {
    // fallback: 아주 단순한 해시(보안용 아님)
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
    return `weak_${h.toString(16)}`;
  }

  const enc = new TextEncoder();
  const buf = await subtle.digest("SHA-256", enc.encode(text));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type CreatePostInput = {
  boardKey: BoardKey;
  type: Post["type"];
  title: string;
  content: string;
  authorName?: string;
  isPrivate?: boolean;
  /**
   * Optional password for private posts.
   *
   * Some callers may send `null` (e.g. API payloads) to mean “no password”.
   * We accept it here to avoid strict-null type errors during `next build`.
   */
  password?: string | null;
  extra?: PostExtra;
};

export async function createLocalPost(input: CreatePostInput): Promise<Post> {
  const now = new Date().toISOString();

  const post: Post = {
    id: randomId(),
    boardKey: input.boardKey,
    type: input.type,
    title: input.title.trim(),
    content: input.content.trim(),
    createdAt: now,
    authorName: input.authorName?.trim() || undefined,
    isPrivate: input.isPrivate,
    extra: input.extra,
  };

  if (input.isPrivate) {
    const pw = input.password ?? "";
    post.passwordHash = pw ? await sha256(pw) : "";
  }

  const existing = loadLocalPosts();
  saveLocalPosts([post, ...existing]);

  return post;
}

export async function verifyLocalPostPassword(post: Post, password: string): Promise<boolean> {
  if (!post.isPrivate) return true;
  const hash = post.passwordHash ?? "";
  if (!hash) return true; // 비번을 안 걸었으면 통과(운영에서 바꿔도 됨)
  const inputHash = await sha256(password);
  return inputHash === hash;
}

export function formatKoreanDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
