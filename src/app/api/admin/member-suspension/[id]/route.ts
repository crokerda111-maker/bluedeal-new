import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../../../lib/adminAuth";
import { kvCommand } from "../../../../../lib/kvRest";
import { memberLoginEnabled, writerAuthorKey, writerPostKey, writerSuspensionKey } from "../../../../../lib/memberWrite";
import { postJson } from "../../../../../lib/postAccess";
import { assertSameOrigin, readJsonObject, RequestInputError } from "../../../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function manage(req: NextRequest, { params }: Context) {
  if (!isAdminRequest(req)) return postJson({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  if (!memberLoginEnabled()) return postJson({ available: false });

  try {
    if (req.method !== "GET") assertSameOrigin(req);
    const { id } = await params;
    if (!/^[a-z0-9_-]{1,100}$/i.test(id)) return postJson({ available: false });
    const alias = await kvCommand<string | null>("GET", writerPostKey(id));
    const writerId = alias ? await kvCommand<string | null>("GET", writerAuthorKey(alias)) : null;
    if (!writerId) return postJson({ available: false });

    const key = writerSuspensionKey(writerId);
    if (req.method === "PUT") {
      const { days } = await readJsonObject(req, 384);
      if (typeof days !== "number" || ![1, 7, 30].includes(days)) {
        return postJson({ error: "제재 기간을 1일, 7일, 30일 중 선택해 주세요." }, { status: 400 });
      }
      const seconds = days * 86400;
      const until = new Date(Date.now() + seconds * 1000).toISOString();
      await kvCommand("SET", key, until, "EX", seconds);
      return postJson({ available: true, until });
    }
    if (req.method === "DELETE") {
      await kvCommand("DEL", key);
      return postJson({ available: true, until: null });
    }
    return postJson({ available: true, until: await kvCommand<string | null>("GET", key) });
  } catch (error) {
    if (error instanceof RequestInputError) return postJson({ error: error.message }, { status: error.status });
    return postJson({ error: "계정 제재 정보를 처리하지 못했습니다." }, { status: 503 });
  }
}

export const GET = manage;
export const PUT = manage;
export const DELETE = manage;
