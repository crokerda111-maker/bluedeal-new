import Link from "next/link";
import { listHybridBlogPosts } from "../../lib/blogStorage";

export const metadata = {
  title: "구매가이드 | BLUEDEAL",
  description: "PC 부품과 완본체 상품 설명, 비교, 구매 가이드",
};

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export default async function BlogPage() {
  const { posts } = await listHybridBlogPosts();

  return (
    <div className="space-y-10">
      <section className="bd-surface p-6 md:p-8">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-cyan-200/80">BLUEDEAL GUIDE</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">구매가이드</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
          PC 부품과 완본체의 핵심 정보, 비교 기준과 구매 전 확인사항을 정리합니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {posts.length === 0 ? (
          <div className="bd-surface-md p-6 text-sm text-white/60 md:col-span-2">아직 발행된 글이 없습니다.</div>
        ) : posts.map((post) => (
          <article key={post.slug} className="bd-surface-md flex flex-col p-6">
            <div className="flex items-center justify-between gap-3 text-[12px]">
              <span className="font-semibold text-cyan-200/80">{post.category}</span>
              <time className="text-white/40" dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </div>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              <Link href={`/blog/${post.slug}`} className="hover:text-cyan-200">{post.title}</Link>
            </h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-white/60">{post.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {post.tags.map((tag) => <span key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/45">#{tag}</span>)}
            </div>
            <Link href={`/blog/${post.slug}`} className="mt-5 text-sm font-semibold text-cyan-200 hover:text-cyan-100">글 읽기 →</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
