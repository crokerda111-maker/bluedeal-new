import { NextRequest } from "next/server";
import { postJson, readAuthorizedPost } from "../../../../../lib/postAccess";
import { readJsonObject, RequestInputError } from "../../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(req, 8192);
  } catch (error) {
    if (error instanceof RequestInputError) return postJson({ errorCode: error.code, error: error.message }, { status: error.status });
    return postJson({ error: "입력한 내용을 확인해 주세요." }, { status: 400 });
  }
  const password = body.password;
  if (typeof password !== "string" || !password.trim()) return postJson({ error: "비밀번호를 입력하세요." }, { status: 400 });
  const { id } = await ctx.params;
  return readAuthorizedPost(req, id, password.trim());
}
