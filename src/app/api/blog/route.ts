import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../lib/adminAuth";
import { BlogValidationError, listHybridBlogPosts, saveAdminBlogPost } from "../../../lib/blogStorage";
import { KvNotConfiguredError } from "../../../lib/kvRest";
import { readJsonObject, RequestInputError } from "../../../lib/requestGuard";
import { postJson } from "../../../lib/postAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = isAdminRequest(req);
  try {
    const result = await listHybridBlogPosts({ includeDrafts: admin, limit: 200 });
    return postJson(result);
  } catch {
    return postJson({ error: "블로그 글을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return postJson({ error: "Admin only" }, { status: 403 });
  try {
    const body: any = await readJsonObject(req, 512 * 1024);
    const post = await saveAdminBlogPost(body);
    return postJson({ post }, { status: 201 });
  } catch (error: any) {
    if (error instanceof RequestInputError) return postJson({ errorCode: error.code, error: error.message }, { status: error.status });
    if (error instanceof BlogValidationError) return postJson({ error: error.message }, { status: 400 });
    if (error instanceof KvNotConfiguredError) {
      return postJson({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 필요합니다." }, { status: 503 });
    }
    return postJson({ error: "글을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

