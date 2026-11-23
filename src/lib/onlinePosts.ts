import "server-only";

import crypto from "crypto";
import type { BoardKey, Post, PostExtra, PostType } from "./postTypes";
import { isHotdealAuthor, type VerifiedHotdeal } from "./hotdeal";
import { getBoardByKey, getAllowedTypes } from "./boardConfig";
import { getAdminPassword } from "./adminAuth";
import { kvCommand, kvMultiExec, kvPipeline } from "./kvRest";
import { writerPostKey } from "./memberWrite";
import { createOrReuseOutboundCode, isHttpUrlString } from "./onlineOutbound";
import { issuePostTitle, PostValidationError, validatePostFields } from "./postInput";
export { PostValidationError } from "./postInput";

const POST_KEY_PREFIX = "bd:post:";
const BOARD_ZSET_PREFIX = "bd:board:";

function postKey(id: string): string {
  return `${POST_KEY_PREFIX}${id}`;
}

function boardZsetKey(boardKey: BoardKey): string {
  return `${BOARD_ZSET_PREFIX}${boardKey}:posts`;
}

function randomId(): string {
  // Node 18+ supports randomUUID.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function privatePasswordHash(password: unknown): string {
  const value = typeof password === "string" ? password.trim() : "";
  if (!value) throw new PostValidationError("비공개 글에는 비밀번호가 필요합니다.");
  return sha256(value);
}

function adminPasswordHash(): string {
  const password = getAdminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD가 설정되지 않았습니다.");
  return sha256(password);
}

function stripTrailingPunct(raw: string): { url: string; trailing: string } {
  let url = raw;
  let trailing = "";

  // Always strip common punctuation
  while (url.length && /[\.,;:!?]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  // Strip closing brackets only when unbalanced
  const pairs: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];
  for (const [open, close] of pairs) {
    // Keep removing `close` if there are more closes than opens.
    while (url.endsWith(close)) {
      const opens = (url.match(new RegExp(`\\${open}`, "g")) ?? []).length;
      const closes = (url.match(new RegExp(`\\${close}`, "g")) ?? []).length;
      if (closes <= opens) break;
      trailing = close + trailing;
      url = url.slice(0, -1);
    }
  }

  return { url, trailing };
}

type ConversionBudget = { remaining: number; codes: Map<string, string | null> };

async function boundedOutboundCode(url: string, budget: ConversionBudget): Promise<string | null> {
  if (budget.codes.has(url)) return budget.codes.get(url) ?? null;
  if (budget.remaining <= 0) return null;
  budget.remaining -= 1;
  const code = await createOrReuseOutboundCode(url);
  budget.codes.set(url, code);
  return code;
}

async function convertOutboundInText(text: string, budget: ConversionBudget): Promise<string> {
  const URL_RE = /https?:\/\/[^\s<>"]+/gi;
  const found = text.match(URL_RE);
  if (!found || found.length === 0) return text;

  // Deduplicate exact matches to reduce KV writes
  const uniq = Array.from(new Set(found));

  const map = new Map<string, string>();
  for (const raw of uniq) {
    const { url, trailing } = stripTrailingPunct(raw);
    if (!isHttpUrlString(url)) continue;

    const code = await boundedOutboundCode(url, budget);
    if (code) {
      map.set(raw, `/go/${code}${trailing}`);
    }
  }

  if (map.size === 0) return text;

  // Replace using original raw matches (including punctuation)
  return text.replace(URL_RE, (m) => map.get(m) ?? m);
}

async function convertOutboundInExtra(extra: PostExtra | undefined, budget: ConversionBudget): Promise<PostExtra | undefined> {
  if (!extra) return extra;

  const next: PostExtra = { ...extra };

  for (const [k, v] of Object.entries(next)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t) continue;
    if (t.startsWith("/go/")) continue;
    if (!isHttpUrlString(t)) continue;

    const code = await boundedOutboundCode(t, budget);
    if (code) {
      next[k] = `/go/${code}`;
    }
  }

  return next;
}

export type CreateOnlinePostInput = {
  boardKey: BoardKey;
  type: PostType;
  title: string;
  content: string;
  authorName?: string;
  writerId?: string;
  isPrivate?: boolean;
  password?: string | null;
  /**
   * If true, use ADMIN_PASSWORD as the password for this private post.
   * This avoids exposing the admin password to the client.
   */
  lockToAdminPassword?: boolean;
  extra?: PostExtra;
};

function assertBoardAndType(boardKey: BoardKey, type: PostType) {
  const b = getBoardByKey(boardKey);
  if (!b) throw new PostValidationError("게시판을 다시 선택해 주세요.");
  const allowed = getAllowedTypes(b);
  if (!allowed.includes(type)) throw new PostValidationError("이 게시판에서 사용할 수 없는 말머리입니다.");
}

export function createOnlinePost(input: CreateOnlinePostInput): Promise<Post>;
export function createOnlinePost(input: CreateOnlinePostInput, verified: { id: string; hotdeal?: VerifiedHotdeal }): Promise<{ post: Post; created: boolean }>;
export async function createOnlinePost(input: CreateOnlinePostInput, verified?: { id: string; hotdeal?: VerifiedHotdeal }) {
  assertBoardAndType(input.boardKey, input.type);
  validatePostFields(input);

  if (input.boardKey === "hotdeal" && isHotdealAuthor(input.authorName) && !verified?.hotdeal) {
    throw new PostValidationError("블루딜 AI는 운영 게시 전용 작성자입니다.");
  }
  const nowIso = new Date().toISOString();
  const id = verified?.id ?? randomId();
  const score = Date.now();

  const post: Post = {
    id,
    boardKey: input.boardKey,
    type: input.type,
    title: input.title.trim(),
    content: input.content.trim(),
    createdAt: nowIso,
    authorName: input.authorName?.trim() || undefined,
    isPrivate: input.isPrivate,
    extra: input.extra,
    hotdeal: verified?.hotdeal,
  };

  if (input.isPrivate) {
    post.passwordHash = input.lockToAdminPassword ? adminPasswordHash() : privatePasswordHash(input.password);
  }

  // Bound the combined content/extra conversion work. Remaining URLs stay intact.
  const conversion: ConversionBudget = { remaining: 20, codes: new Map() };
  // Convert outbound links to /go/{code} (best-effort).
  // - Only allowlisted hosts are converted (others remain original).
  try {
    post.content = await convertOutboundInText(post.content, conversion);
    post.extra = await convertOutboundInExtra(post.extra, conversion);
  } catch {
    // ignore conversion errors (posting should still work)
  }

  if (post.boardKey === "issue" && !post.isPrivate) post.title = issuePostTitle(post.content);

  // Atomic: store post JSON + add to board index.
  if (verified) {
    const [created] = await kvMultiExec([
      ["SET", postKey(id), JSON.stringify(post), "NX"],
      ["ZADD", boardZsetKey(input.boardKey), "NX", score, id],
    ]);
    return { post, created: created === "OK" };
  }
  await kvMultiExec([
    ["SET", postKey(id), JSON.stringify(post)],
    ["ZADD", boardZsetKey(input.boardKey), score, id],
    ...(input.writerId ? [["SET", writerPostKey(id), input.writerId]] : []),
  ]);

  return post;
}

export async function getOnlinePostById(id: string): Promise<Post | null> {
  const raw = await kvCommand<string | null>("GET", postKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Post;
  } catch {
    return null;
  }
}

export async function listOnlinePostsByBoard(boardKey: BoardKey, limit = 50, { includeHotdealClicks = true } = {}): Promise<Post[]> {
  const b = getBoardByKey(boardKey);
  if (!b) throw new Error("Invalid boardKey");

  const safeLimit = Math.max(1, Math.min(200, Number.isFinite(limit) ? Math.floor(limit) : 50));

  const ids = await kvCommand<string[]>("ZREVRANGE", boardZsetKey(boardKey), 0, safeLimit - 1);
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const results = await kvPipeline(ids.map((id) => ["GET", postKey(id)]));

  const posts: Post[] = [];
  for (const raw of results) {
    if (!raw || typeof raw !== "string") continue;
    try {
      const p = JSON.parse(raw) as Post;
      posts.push(p);
    } catch {
      // ignore
    }
  }

  if (boardKey === "hotdeal" && includeHotdealClicks) {
    const verifiedPosts = posts.flatMap(post => {
      const href = post.extra?.dealLink;
      const code = typeof href === "string" ? href.match(/^\/go\/([a-zA-Z0-9_-]{2,64})$/)?.[1] : undefined;
      return !post.isPrivate && post.hotdeal && code ? [{ post, code }] : [];
    });
    if (verifiedPosts.length) {
      try {
        const clicks = await kvCommand<unknown[]>("MGET", ...verifiedPosts.map(item => "bd:out:click:" + item.code));
        verifiedPosts.forEach(({ post }, index) => {
          const count = Number(clicks[index]);
          if (Number.isSafeInteger(count) && count > 0) post.hotdealClicks = count;
        });
      } catch { /* The hotdeal list is still available if click counts fail. */ }
    }
  }

  // Ensure ordering by createdAt desc.
  posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return posts;
}

export async function verifyOnlinePostPassword(post: Post, password: string): Promise<boolean> {
  if (!post.isPrivate) return true;
  const hash = post.passwordHash ?? "";
  // Historical/malformed records must not become readable with any password.
  if (!/^[0-9a-f]{64}$/.test(hash)) return false;
  return crypto.timingSafeEqual(Buffer.from(sha256(password), "hex"), Buffer.from(hash, "hex"));
}

export type UpdateOnlinePostInput = {
  title?: string;
  content?: string;
  authorName?: string | null;
  type?: PostType;
  extra?: PostExtra | null;
  isPrivate?: boolean;
  password?: string | null;
  lockToAdminPassword?: boolean;
};

export async function updateOnlinePost(id: string, patch: UpdateOnlinePostInput): Promise<Post | null> {
  const current = await getOnlinePostById(id);
  if (!current) return null;
  validatePostFields(patch, { partial: true, current });

  const next: Post = {
    ...current,
    title: typeof patch.title === "string" ? patch.title.trim() : current.title,
    content: typeof patch.content === "string" ? patch.content.trim() : current.content,
    authorName:
      patch.authorName === undefined
        ? current.authorName
        : patch.authorName === null
          ? undefined
          : String(patch.authorName).trim() || undefined,
    type: patch.type ?? current.type,
    extra: patch.extra === undefined ? current.extra : patch.extra === null ? undefined : patch.extra,
    isPrivate: patch.isPrivate === undefined ? current.isPrivate : Boolean(patch.isPrivate),
    updatedAt: new Date().toISOString(),
  };

  if (next.boardKey === "hotdeal" && !current.hotdeal && isHotdealAuthor(next.authorName) && next.authorName !== current.authorName) {
    throw new PostValidationError("블루딜 AI는 운영 게시 전용 작성자입니다.");
  }
  if (current.hotdeal && (next.title !== current.title || next.content !== current.content ||
      next.authorName !== current.authorName || next.isPrivate ||
      (patch.extra !== undefined && JSON.stringify(next.extra) !== JSON.stringify(current.extra)))) {
    delete next.hotdeal;
    if (isHotdealAuthor(next.authorName)) next.authorName = "블루딜 운영팀";
  }

  // Validate board/type constraint
  assertBoardAndType(next.boardKey, next.type);

  // Private/password handling
  if (!next.isPrivate) {
    delete next.passwordHash;
  } else {
    if (patch.lockToAdminPassword) {
      next.passwordHash = adminPasswordHash();
    } else if (patch.password !== undefined) {
      next.passwordHash = privatePasswordHash(patch.password);
    } else {
      // Public -> private must supply a password. Never store an empty lock.
      if (!current.passwordHash) {
        throw new PostValidationError("비공개로 변경할 때는 비밀번호 또는 운영자 잠금을 설정하세요.");
      }
      next.passwordHash = current.passwordHash;
    }
  }

  const conversion: ConversionBudget = { remaining: 20, codes: new Map() };
  try {
    next.content = await convertOutboundInText(next.content, conversion);
    next.extra = await convertOutboundInExtra(next.extra, conversion);
  } catch { /* Link conversion is best effort; preserve the original text on failure. */ }

  await kvCommand("SET", postKey(id), JSON.stringify(next));
  return next;
}

export async function deleteOnlinePost(id: string): Promise<boolean> {
  const current = await getOnlinePostById(id);
  if (!current) return false;

  await kvMultiExec([
    ["DEL", postKey(id), writerPostKey(id)],
    ["ZREM", boardZsetKey(current.boardKey), id],
  ]);

  return true;
}
