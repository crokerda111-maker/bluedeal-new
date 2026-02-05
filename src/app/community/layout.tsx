import Link from "next/link";
import { COMMUNITY_BOARDS } from "../../lib/boardConfig";

export const metadata = {
  title: "커뮤니티 | BLUEDEAL",
  description: "BLUEDEAL 커뮤니티",
};

function BoardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
      href={href}
    >
      {children}
    </Link>
  );
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">커뮤니티</div>
            <div className="mt-1 text-sm text-white/65">리뷰/질문/팁/이슈 공유</div>
          </div>

          <Link href="/community" className="text-sm text-cyan-200 hover:underline">
            커뮤니티 홈 →
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {COMMUNITY_BOARDS.map((b) => (
            <BoardLink key={b.key} href={`/community/${b.slug}`}>
              {b.title}
            </BoardLink>
          ))}
        </div>
      </section>

      {children}
    </div>
  );
}
