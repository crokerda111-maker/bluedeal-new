import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { KvNotConfiguredError } from "../../../../lib/kvRest";
import {
  deleteOnlinePost,
  getOnlinePostById,
  updateOnlinePost,
  verifyOnlinePostPassword,
} from "../../../../lib/onlinePosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function stripPasswordHash(post: any) {
  if (!post) return post;
  const { passwordHash, ...rest } = post;
  return rest;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  if (!id) return json({ error: "Missing id" }, { status: 400 });

  const admin = isAdminRequest(req);
  const pw = req.nextUrl.searchParams.get("pw") ?? "";

  try {
    const post = await getOnlinePostById(id);
    if (!post) return json({ error: "Not found" }, { status: 404 });

    if (post.isPrivate && !admin) {
      if (!pw.trim()) {
        return json(
          {
            errorCode: "POST_LOCKED",
            error: "비공개 글입니다. 비밀번호를 입력하세요.",
          },
          { status: 401 },
        );
      }

      const ok = await verifyOnlinePostPassword(post, pw);
      if (!ok) {
        return json(
          {
            errorCode: "PASSWORD_INVALID",
            error: "비밀번호가 맞지 않습니다.",
          },
          { status: 403 },
        );
      }
    }

    return json({ post: stripPasswordHash(post) });
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
    const msg = typeof e?.message === "string" ? e.message : "Failed to load post";
    return json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  if (!id) return json({ error: "Missing id" }, { status: 400 });

  if (!isAdminRequest(req)) {
    return json({ error: "Admin only" }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const updated = await updateOnlinePost(id, body ?? {});
    if (!updated) return json({ error: "Not found" }, { status: 404 });
    return json({ post: stripPasswordHash(updated) });
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
    const msg = typeof e?.message === "string" ? e.message : "Failed to update post";
    return json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id;
  if (!id) return json({ error: "Missing id" }, { status: 400 });

  if (!isAdminRequest(req)) {
    return json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const ok = await deleteOnlinePost(id);
    if (!ok) return json({ error: "Not found" }, { status: 404 });
    return json({ ok: true });
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
    const msg = typeof e?.message === "string" ? e.message : "Failed to delete post";
    return json({ error: msg }, { status: 500 });
  }
}
