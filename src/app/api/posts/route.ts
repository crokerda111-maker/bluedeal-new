import { NextRequest, NextResponse } from "next/server";
import type { BoardKey, PostType } from "../../../lib/postTypes";
import { getBoardByKey, POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import { createOnlinePost, listOnlinePostsByBoard } from "../../../lib/onlinePosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function isValidPostType(t: any): t is PostType {
  return POST_TYPE_OPTIONS.some((x) => x.value === t);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const boardKey = sp.get("boardKey") as BoardKey | null;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  if (!boardKey || !getBoardByKey(boardKey as any)) {
    return json({ error: "Invalid or missing boardKey" }, { status: 400 });
  }

  try {
    const posts = await listOnlinePostsByBoard(boardKey, limit);
    return json({ posts });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to load posts";
    const status = msg.includes("Missing KV config") ? 503 : 500;
    return json({ error: msg }, { status });
  }
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const boardKey = body?.boardKey as BoardKey | undefined;
  const type = body?.type as PostType | undefined;
  const title = String(body?.title ?? "");
  const content = String(body?.content ?? "");
  const authorName = typeof body?.authorName === "string" ? body.authorName : undefined;
  const extra = body?.extra;

  if (!boardKey || !getBoardByKey(boardKey as any)) {
    return json({ error: "Invalid or missing boardKey" }, { status: 400 });
  }
  if (!isValidPostType(type)) {
    return json({ error: "Invalid or missing type" }, { status: 400 });
  }
  if (!title.trim()) return json({ error: "Missing title" }, { status: 400 });
  if (!content.trim()) return json({ error: "Missing content" }, { status: 400 });

  // MVP: Community posts are public.
  const isPrivate = Boolean(body?.isPrivate);
  const password = body?.password ?? null;

  try {
    const post = await createOnlinePost({
      boardKey,
      type,
      title,
      content,
      authorName,
      extra,
      isPrivate,
      password,
    });

    return json({ post }, { status: 201 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "Failed to create post";
    const status = msg.includes("Missing KV config") ? 503 : 500;
    return json({ error: msg }, { status });
  }
}
