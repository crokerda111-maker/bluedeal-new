import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { BlogValidationError, deleteAdminBlogPost, getHybridBlogPost, saveAdminBlogPost } from "../../../../lib/blogStorage";
import { KvNotConfiguredError } from "../../../../lib/kvRest";
import { assertSameOrigin, readJsonObject, RequestInputError } from "../../../../lib/requestGuard";
import { postJson } from "../../../../lib/postAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const post = await getHybridBlogPost(slug, isAdminRequest(req));
    if (!post) return postJson({ error: "Not found" }, { status: 404 });
    return postJson({ post });
  } catch {
    return postJson({ error: "글을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAdminRequest(req)) return postJson({ error: "Admin only" }, { status: 403 });
  try {
    const body: any = await readJsonObject(req, 512 * 1024);
    const { slug } = await context.params;
    const post = await saveAdminBlogPost(body, slug);
    return postJson({ post });
  } catch (error: any) {
    if (error instanceof RequestInputError) return postJson({ errorCode: error.code, error: error.message }, { status: error.status });
    if (error instanceof BlogValidationError) return postJson({ error: error.message }, { status: 400 });
    if (error instanceof KvNotConfiguredError) {
      return postJson({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 필요합니다." }, { status: 503 });
    }
    return postJson({ error: "글을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  if (!isAdminRequest(req)) return postJson({ error: "Admin only" }, { status: 403 });
  try {
    assertSameOrigin(req);
    const { slug } = await context.params;
    const deleted = await deleteAdminBlogPost(slug);
    if (!deleted) return postJson({ error: "Not found" }, { status: 404 });
    return postJson({ ok: true });
  } catch (error: any) {
    if (error instanceof RequestInputError) return postJson({ errorCode: error.code, error: error.message }, { status: error.status });
    if (error instanceof KvNotConfiguredError) {
      return postJson({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 필요합니다." }, { status: 503 });
    }
    return postJson({ error: "글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

