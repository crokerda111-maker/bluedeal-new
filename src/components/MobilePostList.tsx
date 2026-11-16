import Link from "next/link";
import { labelByType } from "../lib/boardConfig";
import { formatKoreanDate } from "../lib/postStorage";
import type { Post } from "../lib/postTypes";

export default function MobilePostList({ posts, hrefPrefix, loading, emptyText, showVisibility = false }: {
  posts: Post[]; hrefPrefix: string; loading: boolean; emptyText: string; showVisibility?: boolean;
}) {
  return (
    <section className="bd-surface-md md:hidden" aria-label="게시글 목록" aria-busy={loading}>
      {loading ? <p role="status" className="px-4 py-8 text-center text-sm text-white/65">게시글을 불러오는 중입니다.</p>
        : posts.length === 0 ? <p className="px-4 py-8 text-center text-sm text-white/65">{emptyText}</p>
        : <ul className="divide-y divide-white/10">
          {posts.map(post => (
            <li key={post.id}>
              <Link href={`${hrefPrefix}/${post.id}`} className="block rounded-xl px-4 py-4 hover:bg-white/5">
                <div className="flex flex-wrap gap-2 text-xs text-cyan-200">
                  <span>{post.boardKey === "it" && post.type === "general" ? "뉴스" : labelByType(post.type)}</span>
                  {showVisibility ? <span className="text-white/60">{post.isPrivate ? "비공개" : "공개"}</span> : null}
                </div>
                <div className="mt-2 break-words text-sm font-medium leading-6 text-white/90">{post.title}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                  <span className="max-w-full truncate">{post.authorName || "익명"}</span>
                  <time dateTime={post.createdAt}>{formatKoreanDate(post.createdAt)} KST</time>
                </div>
              </Link>
            </li>
          ))}
        </ul>}
    </section>
  );
}
