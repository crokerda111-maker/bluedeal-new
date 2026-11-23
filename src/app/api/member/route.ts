import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../lib/adminAuth";
import { chooseWriterNickname, endWriterSession, readWriter, validWriterNickname, withdrawWriter, WRITER_SESSION, writerCookie } from "../../../lib/memberWrite";
import { postJson } from "../../../lib/postAccess";
import { assertSameOrigin, readJsonObject, RequestInputError } from "../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable(req: NextRequest) {
  return postJson({ state: "unavailable", admin: isAdminRequest(req), error: "계정 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
}

export async function GET(req: NextRequest) {
  try {
    return postJson({ ...(await readWriter(req)).status, admin: isAdminRequest(req) });
  } catch {
    return unavailable(req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nickname, action } = await readJsonObject(req, 512);
    const { identity, status } = await readWriter(req);
    if (!identity) return postJson({ error: "Google로 로그인해 주세요." }, { status: 401 });
    if (action === "withdraw") {
      if (!await withdrawWriter(identity)) return postJson({ error: "탈퇴할 회원 계정을 확인하지 못했습니다." }, { status: 409 });
      const res = postJson({ state: "login", admin: isAdminRequest(req) });
      writerCookie(res, WRITER_SESSION, "", 0);
      return res;
    }
    if (status.state === "suspended") return postJson({ error: "글쓰기 제재 기간입니다." }, { status: 403 });
    if (!validWriterNickname(nickname)) return postJson({ error: "사용 가능한 닉네임을 1~20자로 입력해 주세요." }, { status: 400 });
    const saved = await chooseWriterNickname(identity, nickname.trim());
    if (!saved) return postJson({ error: "계정 상태가 바뀌었습니다. 새로고침 후 다시 시도해 주세요." }, { status: 409 });
    if (saved.state === "taken") return postJson({ errorCode: "NICKNAME_TAKEN", error: "이미 사용 중인 닉네임입니다. 다른 이름을 입력해 주세요." }, { status: 409 });
    return postJson({ state: "ready", nickname: saved.nickname, admin: isAdminRequest(req) });
  } catch (error) {
    if (error instanceof RequestInputError) return postJson({ error: error.message }, { status: error.status });
    return unavailable(req);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const res = postJson({ state: "login", admin: isAdminRequest(req) });
    await endWriterSession(req, res);
    return res;
  } catch (error) {
    if (error instanceof RequestInputError) return postJson({ error: error.message }, { status: error.status });
    return unavailable(req);
  }
}
