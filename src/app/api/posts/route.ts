import { NextRequest, NextResponse } from "next/server";
import type { BoardKey, Post, PostType } from "../../../lib/postTypes";
import { getBoardByKey, getAllowedTypes, POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import { isAdminRequest } from "../../../lib/adminAuth";
import { KvNotConfiguredError } from "../../../lib/kvRest";
import { createOnlinePost, listOnlinePostsByBoard } from "../../../lib/onlinePosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function isValidPostType(t: any): t is PostType {
  return POST_TYPE_OPTIONS.some((x) => x.value === t);
}

function maskPrivateInList(posts: Post[]): Post[] {
  return posts.map((p) => {
    if (!p.isPrivate) {
      // never expose password hash
      const { passwordHash, ...rest } = p as any;
      return rest as Post;
    }
    const { passwordHash, ...rest } = p as any;
    return {
      ...(rest as Post),
      content: "",
      extra: undefined,
    };
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const boardKey = sp.get("boardKey") as BoardKey | null;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  const board = boardKey ? getBoardByKey(boardKey as any) : undefined;
  if (!boardKey || !board) {
    return json({ error: "Invalid or missing boardKey" }, { status: 400 });
  }

  try {
    const posts = await listOnlinePostsByBoard(boardKey, limit);

    // Non-admin: never expose private content in list.
    if (!isAdminRequest(req)) {
      return json({ posts: maskPrivateInList(posts) });
    }

    // Admin: still remove passwordHash
    const safe = posts.map((p) => {
      const { passwordHash, ...rest } = p as any;
      return rest as Post;
    });
    return json({ posts: safe });
  } catch (e: any) {
    if (e instanceof KvNotConfiguredError) {
      return json(
        {
          errorCode: e.code,
          error: "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다.",
          hint: "Vercel 환경변수(KV_REST_API_URL/KV_REST_API_TOKEN 또는 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN) 설정 후 재배포하세요.",
        },
        { status: 503 },
      );
    }
    const msg = typeof e?.message === "string" ? e.message : "Failed to load posts";
    return json({ error: msg }, { status: 500 });
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

  const board = boardKey ? getBoardByKey(boardKey as any) : undefined;
  if (!boardKey || !board) {
    return json({ error: "Invalid or missing boardKey" }, { status: 400 });
  }
  if (!isValidPostType(type)) {
    return json({ error: "Invalid or missing type" }, { status: 400 });
  }

  // board별 허용 말머리 강제
  const allowed = getAllowedTypes(board);
  if (!allowed.includes(type)) {
    return json({ error: "This board does not allow the selected type." }, { status: 400 });
  }

  if (!title.trim()) return json({ error: "Missing title" }, { status: 400 });
  if (!content.trim()) return json({ error: "Missing content" }, { status: 400 });

  const isPrivate = Boolean(body?.isPrivate);
  const password = body?.password ?? null;
  const lockToAdminPassword = Boolean(body?.lockToAdminPassword);

  // 안전장치: lockToAdminPassword는 문의 게시판에서만 허용
  const effectiveLockToAdmin = isPrivate && lockToAdminPassword && boardKey === "inquiry";

  if (isPrivate && !effectiveLockToAdmin) {
    const pw = typeof password === "string" ? password.trim() : "";
    if (!pw) {
      return json({ error: "Private post requires password." }, { status: 400 });
    }
  }

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
      lockToAdminPassword: effectiveLockToAdmin,
    });

    // never return password hash
    const { passwordHash, ...safe } = post as any;
    return json({ post: safe }, { status: 201 });
  } catch (e: any) {
    if (e instanceof KvNotConfiguredError) {
      return json(
        {
          errorCode: e.code,
          error: "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다.",
        },
        { status: 503 },
      );
    }
    const msg = typeof e?.message === "string" ? e.message : "Failed to create post";
    return json({ error: msg }, { status: 500 });
  }
}
