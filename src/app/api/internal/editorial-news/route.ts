import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { isAdminRequest } from "../../../../lib/adminAuth";
import { createOnlinePost } from "../../../../lib/onlinePosts";
import { postJson } from "../../../../lib/postAccess";
import { PostValidationError } from "../../../../lib/postInput";
import { readJsonObject, RequestInputError } from "../../../../lib/requestGuard";

const sources = new Set(["arstechnica.com", "nvidianews.nvidia.com", "blogs.nvidia.com"]);
const reviews = ["translation", "koreanEditing", "proofreading", "sensitiveContext"] as const;
const day = 86_400_000;

function publishedSource(value: unknown): string {
  if (typeof value !== "string" || value.length > 300 || /\s/.test(value)) throw new PostValidationError("공식 원문 주소를 입력해 주세요.");
  const url = URL.parse(value);
  if (!url || url.protocol !== "https:" || url.username || url.password || url.port || url.pathname === "/" || !sources.has(url.hostname)) {
    throw new PostValidationError("등록된 출처의 기사 주소가 필요합니다.");
  }
  return url.origin + url.pathname;
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return postJson({ error: "운영자 로그인이 필요합니다." }, { status: 401 });
  try {
    const input = await readJsonObject(request, 24 * 1024);
    const source = publishedSource(input.sourceUrl);
    const now = Date.now();
    const publishedAt = typeof input.publishedAt === "string" ? Date.parse(input.publishedAt) : NaN;
    const verified = reviews.every(key => Object.hasOwn(input, key) && input[key] === true);
    if (input.reviewed !== true || !verified || !Number.isFinite(publishedAt) || publishedAt > now || now - publishedAt > 20 * day) {
      throw new PostValidationError("최근 20일 원문과 번역·문장·오탈자·민감 표현 검토 기록이 필요합니다.");
    }
    if (typeof input.title !== "string" || typeof input.content !== "string" || !input.content.trim()) {
      throw new PostValidationError("뉴스 제목과 검토한 한국어 본문을 입력해 주세요.");
    }
    const id = "news-" + createHash("sha256").update(source.replace(/\/$/, "")).digest("hex").slice(0, 32);
    const { created } = await createOnlinePost({
      boardKey: "it", type: "news", authorName: "블루딜", title: input.title,
      content: input.content.trim() + "\n\n원문 " + source,
    }, { id });
    return postJson({ id, created }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof RequestInputError) return postJson({ error: error.message }, { status: error.status });
    if (error instanceof PostValidationError) return postJson({ error: error.message }, { status: 422 });
    return postJson({ error: "뉴스 게시를 완료하지 못했습니다." }, { status: 503 });
  }
}
