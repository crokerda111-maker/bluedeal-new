import { NextRequest } from "next/server";
import { postJson } from "../../../lib/postAccess";
import type { BoardKey, Post, PostType } from "../../../lib/postTypes";
import { getBoardByKey, getAllowedTypes, POST_TYPE_OPTIONS } from "../../../lib/boardConfig";
import { isAdminRequest } from "../../../lib/adminAuth";
import { memberLoginEnabled, memberWritingEnabled, readWriter } from "../../../lib/memberWrite";
import { KvNotConfiguredError } from "../../../lib/kvRest";
import { createOnlinePost, listHotdealPage, listOnlinePostsByBoard, PostValidationError } from "../../../lib/onlinePosts";
import { issuePostTitle, POST_LIMITS, validateIssueLine, validatePostFields } from "../../../lib/postInput";
import { readJsonObject, RequestInputError } from "../../../lib/requestGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: any, init?: ResponseInit) {
  return postJson(data, init);
}

function isValidPostType(t: any): t is PostType {
  return POST_TYPE_OPTIONS.some((x) => x.value === t);
}

function maskPrivateInList(posts: Post[]): Post[] {
  return posts.map((p) => {
    if (!p.isPrivate) {
      // never expose password hash
      const { passwordHash, ...rest } = p as any;
      return rest as Post;
    }
    const { passwordHash, ...rest } = p as any;
    return {
      ...(rest as Post),
      content: "",
      extra: undefined,
      hotdeal: undefined,
      hotdealClicks: undefined,
    };
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const boardKey = sp.get("boardKey") as BoardKey | null;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  const board = boardKey ? getBoardByKey(boardKey as any) : undefined;
  if (!boardKey || !board) {
    return json({ error: "Invalid or missing boardKey" }, { status: 400 });
  }

  try {
    const paging = boardKey === "hotdeal" && sp.get("paged") === "1";
    const after = sp.get("after");
    if (paging && after !== null && !/^[a-zA-Z0-9_-]{1,100}$/.test(after)) {
      return json({ error: "이전 글 위치를 확인해 주세요." }, { status: 400 });
    }
    const page = paging ? await listHotdealPage(after) : { posts: await listOnlinePostsByBoard(boardKey, limit) };
    if (!page) return json({ error: "목록이 바뀌었습니다. 처음부터 다시 불러와 주세요." }, { status: 409 });
    const { posts } = page;

    // Non-admin: never expose private content in list.
    if (!isAdminRequest(req)) {
      return json({ ...page, posts: maskPrivateInList(posts) });
    }

    // Admin: still remove passwordHash
    const safe = posts.map((p) => {
      const { passwordHash, ...rest } = p as any;
      return rest as Post;
    });
    return json({ ...page, posts: safe });
  } catch (e: any) {
    if (e instanceof KvNotConfiguredError) {
      return json(
        {
          errorCode: e.code,
          error: "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다.",
        },
        { status: 503 },
      );
    }
    return json({ error: "게시글 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await readJsonObject(req, POST_LIMITS.bodyBytes);
    if (body.boardKey === "issue") {
      if (body.isPrivate === true) throw new PostValidationError("이슈공유에는 공개 이슈를 등록할 수 있습니다.");
      const content = validateIssueLine(body.content);
      body = { ...body, content, title: issuePostTitle(content) };
    }
    validatePostFields(body);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ errorCode: error.code, error: error.message }, { status: error.status });
    if (error instanceof PostValidationError) return json({ error: error.message }, { status: 400 });
    return json({ error: "입력한 내용을 확인해 주세요." }, { status: 400 });
  }

  const boardKey = body?.boardKey as BoardKey | undefined;
  const type = body?.type as PostType | undefined;
  const title = String(body?.title ?? "");
  const content = String(body?.content ?? "");
  let authorName = typeof body?.authorName === "string" ? body.authorName : undefined;
  const extra = body?.extra;

  const board = boardKey ? getBoardByKey(boardKey as any) : undefined;
  if (!boardKey || !board) {
    return json({ error: "Invalid or missing boardKey" }, { status: 400 });
  }
  if (!isValidPostType(type)) {
    return json({ error: "Invalid or missing type" }, { status: 400 });
  }

  // board별 허용 말머리 강제
  const allowed = getAllowedTypes(board);
  if (!allowed.includes(type)) {
    return json({ error: "This board does not allow the selected type." }, { status: 400 });
  }

  if (boardKey === "it" && type === "pick" && !isAdminRequest(req)) {
    return json({ error: "곰선생 추천픽은 관리자만 작성할 수 있습니다." }, { status: 403 });
  }

  if (!title.trim()) return json({ error: "Missing title" }, { status: 400 });
  if (!content.trim()) return json({ error: "Missing content" }, { status: 400 });

  const isPrivate = Boolean(body?.isPrivate);
  const password = body?.password ?? null;
  const lockToAdminPassword = Boolean(body?.lockToAdminPassword);

  // 안전장치: lockToAdminPassword는 문의 게시판에서만 허용
  const effectiveLockToAdmin = isPrivate && lockToAdminPassword && boardKey === "inquiry";

  if (isPrivate && !effectiveLockToAdmin) {
    const pw = typeof password === "string" ? password.trim() : "";
    if (!pw) {
      return json({ error: "Private post requires password." }, { status: 400 });
    }
  }

  let writerId: string | undefined;
  if (memberLoginEnabled() && !isAdminRequest(req)) {
    const privateInquiry = boardKey === "inquiry" && isPrivate;
    try {
      const writer = privateInquiry ? null : await readWriter(req);
      if (writer?.status.state === "suspended") {
        return json({ errorCode: "WRITER_SUSPENDED", error: "글쓰기 제재 기간입니다." }, { status: 403 });
      }
      if (writer?.identity?.profile && writer.status.state === "ready") {
        writerId = writer.identity.profile.alias;
        authorName = writer.status.nickname;
      } else if (!privateInquiry && (memberWritingEnabled() || writer?.status.state === "nickname")) {
        return json({ errorCode: "WRITER_REQUIRED", error: "구글로 로그인한 뒤 닉네임을 등록해 주세요." }, { status: 401 });
      } else {
        authorName = "비회원";
      }
    } catch {
      return json({ errorCode: "WRITER_UNAVAILABLE", error: "글쓰기 계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
    }
  }

  try {
    const post = await createOnlinePost({
      boardKey,
      type,
      title,
      content,
      authorName,
      writerId,
      extra,
      isPrivate,
      password,
      lockToAdminPassword: effectiveLockToAdmin,
    });

    // never return password hash
    const { passwordHash, ...safe } = post as any;
    return json({ post: safe }, { status: 201 });
  } catch (e: any) {
    if (e instanceof PostValidationError) {
      return json({ error: e.message }, { status: 400 });
    }
    if (e instanceof KvNotConfiguredError) {
      return json(
        {
          errorCode: e.code,
          error: "온라인 저장소(KV) 연결이 아직 설정되지 않았습니다.",
        },
        { status: 503 },
      );
    }
    return json({ error: "게시글을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
