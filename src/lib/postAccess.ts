import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "./adminAuth";
import { limitAuthenticationAttempt } from "./authAttempts";
import { KvNotConfiguredError } from "./kvRest";
import { getOnlinePostById, verifyOnlinePostPassword } from "./onlinePosts";
import { getPostLinkInfo } from "./postLinkInfo";

export function postJson(data: unknown, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export async function readAuthorizedPost(req: NextRequest, id: string, password?: string) {
  if (!id) return postJson({ error: "Missing id" }, { status: 400 });
  try {
    const post = await getOnlinePostById(id);
    if (!post) return postJson({ error: "Not found" }, { status: 404 });
    if (post.isPrivate && !isAdminRequest(req)) {
      if (password === undefined) return postJson({ errorCode: "POST_LOCKED", error: "비공개 글입니다. 비밀번호를 입력하세요." }, { status: 401 });
      const limited = await limitAuthenticationAttempt(req, "private-unlock");
      if (limited) return postJson({ errorCode: limited.errorCode, error: limited.error }, {
        status: limited.status, headers: limited.retryAfter ? { "Retry-After": String(limited.retryAfter) } : undefined,
      });
      if (!await verifyOnlinePostPassword(post, password)) return postJson({ errorCode: "PASSWORD_INVALID", error: "비밀번호가 맞지 않습니다." }, { status: 403 });
    }
    const { passwordHash, ...visible } = post;
    return postJson({ post: { ...visible, linkInfo: await getPostLinkInfo(post) } });
  } catch (error: unknown) {
    if (error instanceof KvNotConfiguredError) return postJson({ errorCode: error.code, error: "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다." }, { status: 503 });
    return postJson({ error: "게시글을 불러오지 못했습니다." }, { status: 500 });
  }
}
