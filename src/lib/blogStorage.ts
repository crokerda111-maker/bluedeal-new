import "server-only";

import { STATIC_BLOG_POSTS } from "../content/blog/posts";
import type { BlogAffiliateLink, BlogPost, BlogPostInput } from "./blogTypes";
import { KvNotConfiguredError, kvCommand, kvMultiExec, kvPipeline } from "./kvRest";
import { createOrReuseOutboundCode } from "./onlineOutbound";

const BLOG_POST_PREFIX = "bd:blog:post:";
const BLOG_POSTS_INDEX = "bd:blog:posts";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class BlogValidationError extends Error {
  constructor(message: string) { super(message); this.name = "BlogValidationError"; }
}

function blogPostKey(slug: string): string {
  return `${BLOG_POST_PREFIX}${slug}`;
}

function normalizeSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function requireText(value: unknown, label: string, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new BlogValidationError(`${label}을(를) 입력하세요.`);
  if (text.length > maxLength) throw new BlogValidationError(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  return text;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((tag) => String(tag).trim()).filter(Boolean))).slice(0, 12);
}

function isValidGoCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{4,80}$/.test(value);
}

function normalizeStoredLinks(value: unknown): BlogAffiliateLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): BlogAffiliateLink | null => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const label = String(raw.label ?? "").trim();
      const goCode = String(raw.goCode ?? "").trim();
      if (!label || !isValidGoCode(goCode)) return null;
      return {
        label: label.slice(0, 120),
        goCode,
        merchant: String(raw.merchant ?? "").trim().slice(0, 40) || undefined,
        note: String(raw.note ?? "").trim().slice(0, 200) || undefined,
      };
    })
    .filter((item): item is BlogAffiliateLink => Boolean(item))
    .slice(0, 30);
}

async function convertAffiliateLinkLines(raw: unknown): Promise<BlogAffiliateLink[]> {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const links: BlogAffiliateLink[] = [];

  for (const line of raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 30)) {
    const separator = line.indexOf("|");
    if (separator < 1) throw new BlogValidationError("상품 링크는 ‘상품명 | https://주소’ 형식으로 입력하세요.");
    const label = line.slice(0, separator).trim();
    const url = line.slice(separator + 1).trim();
    if (!label || !url) throw new BlogValidationError("상품명과 주소를 모두 입력하세요.");

    const code = await createOrReuseOutboundCode(url);
    if (!code) throw new BlogValidationError("지원하는 판매처의 상품 주소인지 확인해 주세요.");
    links.push({ label: label.slice(0, 120), goCode: code });
  }

  return links;
}

function parseStoredPost(raw: unknown): BlogPost | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as BlogPost;
    if (!parsed || !SLUG_RE.test(parsed.slug) || !parsed.title || !parsed.body) return null;
    return { ...parsed, source: "admin", affiliateLinks: normalizeStoredLinks(parsed.affiliateLinks) };
  } catch {
    return null;
  }
}

export function getStaticBlogPosts(includeDrafts = false): BlogPost[] {
  return STATIC_BLOG_POSTS.filter((post) => includeDrafts || post.published).map((post) => ({ ...post, source: "static" }));
}

export async function listAdminBlogPosts(limit = 100): Promise<BlogPost[]> {
  const safeLimit = Math.max(1, Math.min(200, Number.isFinite(limit) ? limit : 100));
  const slugs = await kvCommand<string[]>("ZREVRANGE", BLOG_POSTS_INDEX, 0, safeLimit - 1);
  if (!Array.isArray(slugs) || slugs.length === 0) return [];
  const rawPosts = await kvPipeline(slugs.map((slug) => ["GET", blogPostKey(slug)]));
  return rawPosts.map(parseStoredPost).filter((post): post is BlogPost => Boolean(post));
}

export async function listHybridBlogPosts(options?: { includeDrafts?: boolean; limit?: number }): Promise<{
  posts: BlogPost[];
  onlineStorageAvailable: boolean;
}> {
  const includeDrafts = Boolean(options?.includeDrafts);
  const staticPosts = getStaticBlogPosts(includeDrafts);
  let adminPosts: BlogPost[] = [];
  let onlineStorageAvailable = true;

  try {
    adminPosts = await listAdminBlogPosts(options?.limit ?? 100);
  } catch (error) {
    if (!(error instanceof KvNotConfiguredError)) throw error;
    onlineStorageAvailable = false;
  }

  const merged = new Map<string, BlogPost>();
  for (const post of staticPosts) merged.set(post.slug, post);
  for (const post of adminPosts) {
    if (includeDrafts || post.published) merged.set(post.slug, post);
  }

  const posts = Array.from(merged.values()).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { posts, onlineStorageAvailable };
}

export async function getHybridBlogPost(slug: string, includeDrafts = false): Promise<BlogPost | null> {
  const safeSlug = normalizeSlug(slug);
  if (!SLUG_RE.test(safeSlug)) return null;

  try {
    const raw = await kvCommand<string | null>("GET", blogPostKey(safeSlug));
    const adminPost = parseStoredPost(raw);
    if (adminPost && (includeDrafts || adminPost.published)) return adminPost;
  } catch (error) {
    if (!(error instanceof KvNotConfiguredError)) throw error;
  }

  return getStaticBlogPosts(includeDrafts).find((post) => post.slug === safeSlug) ?? null;
}

export async function saveAdminBlogPost(input: BlogPostInput, previousSlug?: string): Promise<BlogPost> {
  if (input.published !== undefined && typeof input.published !== "boolean") throw new BlogValidationError("공개 여부를 다시 선택해 주세요.");
  const slug = normalizeSlug(input.slug);
  if (!SLUG_RE.test(slug)) throw new BlogValidationError("주소는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  const title = requireText(input.title, "제목", 160);
  const summary = requireText(input.summary, "요약", 360);
  const category = requireText(input.category, "카테고리", 60);
  const body = requireText(input.body, "본문", 100_000);

  const publishedAtValue = String(input.publishedAt ?? "").trim();
  const publishedAt = Number.isNaN(Date.parse(publishedAtValue)) ? new Date().toISOString() : new Date(publishedAtValue).toISOString();
  const fromLines = await convertAffiliateLinkLines(input.affiliateLinkLines);
  const affiliateLinks = fromLines.length > 0 ? fromLines : normalizeStoredLinks(input.affiliateLinks);
  const now = new Date().toISOString();

  const post: BlogPost = {
    slug,
    title,
    summary,
    category,
    tags: normalizeTags(input.tags),
    body,
    affiliateLinks,
    publishedAt,
    updatedAt: now,
    published: Boolean(input.published),
    source: "admin",
  };

  const oldSlug = normalizeSlug(previousSlug);
  const score = Date.parse(publishedAt) || Date.now();
  const commands: any[][] = [
    ["SET", blogPostKey(slug), JSON.stringify(post)],
    ["ZADD", BLOG_POSTS_INDEX, score, slug],
  ];
  if (oldSlug && oldSlug !== slug && SLUG_RE.test(oldSlug)) {
    commands.push(["DEL", blogPostKey(oldSlug)], ["ZREM", BLOG_POSTS_INDEX, oldSlug]);
  }
  await kvMultiExec(commands);
  return post;
}

export async function deleteAdminBlogPost(slug: string): Promise<boolean> {
  const safeSlug = normalizeSlug(slug);
  if (!SLUG_RE.test(safeSlug)) return false;
  const exists = await kvCommand<number>("EXISTS", blogPostKey(safeSlug));
  if (!exists) return false;
  await kvMultiExec([
    ["DEL", blogPostKey(safeSlug)],
    ["ZREM", BLOG_POSTS_INDEX, safeSlug],
  ]);
  return true;
}

