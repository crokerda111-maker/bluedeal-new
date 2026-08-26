import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogBody from "../../../components/BlogBody";
import { getHybridBlogPost } from "../../../lib/blogStorage";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getHybridBlogPost(params.slug);
  if (!post) return { title: "글을 찾을 수 없습니다 | BLUEDEAL" };
  return {
    title: `${post.title} | BLUEDEAL`,
    description: post.summary,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: post.summary, type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt },
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getHybridBlogPost(params.slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/blog" className="text-sm text-white/50 hover:text-white/80">← 구매가이드</Link>

      <header className="mt-5 border-b border-white/10 pb-8">
        <div className="text-sm font-semibold text-cyan-200/80">{post.category}</div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{post.title}</h1>
        <p className="mt-4 text-base leading-7 text-white/60">{post.summary}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] text-white/40">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
          {post.tags.map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
      </header>

      <div className="py-4"><BlogBody body={post.body} /></div>

      {post.affiliateLinks.length > 0 ? (
        <section className="bd-surface-md mt-8 p-5">
          <h2 className="text-lg font-semibold">글에서 소개한 상품</h2>
          <p className="mt-2 text-[12px] leading-5 text-white/50">
            이 글에는 제휴 링크가 포함될 수 있으며, 링크를 통한 구매 시 블루딜이 일정 수수료를 받을 수 있습니다. 구매 가격에는 영향을 주지 않습니다.
          </p>
          <div className="mt-4 grid gap-3">
            {post.affiliateLinks.map((link) => (
              <a key={`${link.goCode}-${link.label}`} href={`/go/${encodeURIComponent(link.goCode)}`} rel="sponsored nofollow" className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4 hover:bg-cyan-300/15">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white/90">{link.label}</div>
                    {link.note ? <div className="mt-1 text-[12px] text-white/50">{link.note}</div> : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-cyan-200">판매처 보기 →</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <aside className="mt-8 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-[12px] leading-5 text-white/50">
        상품 가격과 재고는 판매처에서 수시로 변경될 수 있습니다. 구매 전 판매처의 최종 가격과 상품 정보를 확인하세요.
      </aside>
    </article>
  );
}

