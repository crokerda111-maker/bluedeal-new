import { NextRequest } from "next/server";
import { getAdminPassword, isAdminPasswordConfigured, setAdminCookie } from "../../../../lib/adminAuth";
import { postJson } from "../../../../lib/postAccess";
import { readJsonObject, RequestInputError } from "../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return postJson(data, init);
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await readJsonObject(req, 8192);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ errorCode: error.code, error: error.message }, { status: error.status });
    return json({ error: "입력한 내용을 확인해 주세요." }, { status: 400 });
  }

  const pw = typeof body?.password === "string" ? body.password : "";
  if (!pw) return json({ error: "Missing password" }, { status: 400 });

  if (!isAdminPasswordConfigured()) {
    return json(
      { errorCode: "ADMIN_PASSWORD_NOT_CONFIGURED", error: "관리자 비밀번호가 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  if (pw !== getAdminPassword()) {
    return json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const res = json({ ok: true });
  setAdminCookie(res);
  return res;
}
