import Link from "next/link";

export const metadata = {
  title: "문의 | BLUEDEAL",
  description: "문의 게시판",
};

function TopNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="text-white/80 hover:text-white" href={href}>
      {children}
    </Link>
  );
}

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

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/60 to-blue-500/40" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">BLUEDEAL</div>
              <div className="text-[11px] text-white/60">문의</div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-4 text-sm">
            <TopNavLink href="/it">IT 소식</TopNavLink>
            <TopNavLink href="/community">커뮤니티</TopNavLink>
            <TopNavLink href="/prices">가격현황</TopNavLink>
            <TopNavLink href="/">핫딜</TopNavLink>
            <TopNavLink href="/contact">문의</TopNavLink>
          </nav>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 py-3">
            <BoardLink href="/contact/public">공개 문의</BoardLink>
            <BoardLink href="/contact/private">비공개 문의</BoardLink>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">
          © {new Date().getFullYear()} BLUEDEAL
          <div className="mt-2 text-[12px] text-white/50">
            비공개 문의는 MVP 단계에서는 비밀번호로 잠금 처리합니다.
          </div>
        </div>
      </footer>
    </div>
  );
}
