import { NextRequest } from "next/server";
import { clearAdminCookie } from "../../../../lib/adminAuth";
import { postJson } from "../../../../lib/postAccess";
import { assertSameOrigin, RequestInputError } from "../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try { assertSameOrigin(req); }
  catch (error) {
    if (error instanceof RequestInputError) return postJson({ errorCode: error.code, error: error.message }, { status: error.status });
    return postJson({ error: "요청을 처리하지 못했습니다." }, { status: 400 });
  }
  const res = postJson({ ok: true });
  clearAdminCookie(res);
  return res;
}
