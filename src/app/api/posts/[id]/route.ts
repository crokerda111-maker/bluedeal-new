import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { postJson, readAuthorizedPost } from "../../../../lib/postAccess";
import { KvNotConfiguredError } from "../../../../lib/kvRest";
import {
  deleteOnlinePost,
  PostValidationError,
  updateOnlinePost,
} from "../../../../lib/onlinePosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return postJson(data, init);
}

function stripPasswordHash(post: any) {
  if (!post) return post;
  const { passwordHash, ...rest } = post;
  return rest;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // URL 쿼리로 비밀번호를 받지 않습니다. 열람 인증은 POST /unlock을 사용합니다.
  return readAuthorizedPost(req, (await ctx.params).id);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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
    if (e instanceof PostValidationError) {
      return json({ error: e.message }, { status: 400 });
    }
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

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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
