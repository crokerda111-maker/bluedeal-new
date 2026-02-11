import "server-only";

import crypto from "crypto";
import type { BoardKey, Post, PostExtra, PostType } from "./postTypes";
import { getBoardByKey, getAllowedTypes } from "./boardConfig";
import { getAdminPassword } from "./adminAuth";
import { kvCommand, kvMultiExec, kvPipeline } from "./kvRest";

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

export type CreateOnlinePostInput = {
  boardKey: BoardKey;
  type: PostType;
  title: string;
  content: string;
  authorName?: string;
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
  if (!b) throw new Error("Invalid boardKey");
  const allowed = getAllowedTypes(b);
  if (!allowed.includes(type)) throw new Error("Invalid type for board");
}

export async function createOnlinePost(input: CreateOnlinePostInput): Promise<Post> {
  assertBoardAndType(input.boardKey, input.type);

  const nowIso = new Date().toISOString();
  const id = randomId();
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
  };

  if (input.isPrivate) {
    if (input.lockToAdminPassword) {
      post.passwordHash = sha256(getAdminPassword());
    } else {
      const pw = (input.password ?? "").trim();
      post.passwordHash = pw ? sha256(pw) : "";
    }
  }

  // Atomic: store post JSON + add to board index.
  await kvMultiExec([
    ["SET", postKey(id), JSON.stringify(post)],
    ["ZADD", boardZsetKey(input.boardKey), score, id],
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

export async function listOnlinePostsByBoard(boardKey: BoardKey, limit = 50): Promise<Post[]> {
  const b = getBoardByKey(boardKey);
  if (!b) throw new Error("Invalid boardKey");

  const safeLimit = Math.max(1, Math.min(200, Number.isFinite(limit) ? limit : 50));

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

  // Ensure ordering by createdAt desc.
  posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return posts;
}

export async function verifyOnlinePostPassword(post: Post, password: string): Promise<boolean> {
  if (!post.isPrivate) return true;
  const hash = post.passwordHash ?? "";
  if (!hash) return true;
  return sha256(password) === hash;
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

  // Validate board/type constraint
  assertBoardAndType(next.boardKey, next.type);

  // Private/password handling
  if (!next.isPrivate) {
    delete next.passwordHash;
  } else {
    if (patch.lockToAdminPassword) {
      next.passwordHash = sha256(getAdminPassword());
    } else if (patch.password !== undefined) {
      const pw = (patch.password ?? "").trim();
      next.passwordHash = pw ? sha256(pw) : "";
    } else {
      // keep existing hash
      next.passwordHash = current.passwordHash ?? "";
    }
  }

  await kvCommand("SET", postKey(id), JSON.stringify(next));
  return next;
}

export async function deleteOnlinePost(id: string): Promise<boolean> {
  const current = await getOnlinePostById(id);
  if (!current) return false;

  await kvMultiExec([
    ["DEL", postKey(id)],
    ["ZREM", boardZsetKey(current.boardKey), id],
  ]);

  return true;
}
