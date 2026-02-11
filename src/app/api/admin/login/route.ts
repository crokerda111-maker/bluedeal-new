import { NextRequest, NextResponse } from "next/server";
import { getAdminPassword, setAdminCookie } from "../../../../lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pw = typeof body?.password === "string" ? body.password : "";
  if (!pw) return json({ error: "Missing password" }, { status: 400 });

  if (pw !== getAdminPassword()) {
    return json({ error: "비밀번호가 맞지 않습니다." }, { status: 401 });
  }

  const res = json({ ok: true });
  setAdminCookie(res);
  return res;
}
