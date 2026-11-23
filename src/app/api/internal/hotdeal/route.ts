import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { publishVerifiedHotdeal } from "../../../../lib/hotdealPublisher";
import { postJson } from "../../../../lib/postAccess";
import { PostValidationError } from "../../../../lib/postInput";
import { readJsonObject, RequestInputError } from "../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return postJson({ error: "운영자 로그인이 필요합니다." }, { status: 401 });
  try {
    const input = await readJsonObject(request, 24 * 1024);
    const result = await publishVerifiedHotdeal(input);
    return postJson(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof RequestInputError) return postJson({ error: error.message }, { status: error.status });
    if (error instanceof PostValidationError) return postJson({ error: error.message }, { status: 422 });
    return postJson({ error: "핫딜 게시를 완료하지 못했습니다." }, { status: 503 });
  }
}
