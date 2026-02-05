import Link from "next/link";

export const metadata = {
  title: "가격현황 | BLUEDEAL",
  description: "PC 부품/본체 가격현황",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="text-white/80 hover:text-white" href={href}>
      {children}
    </Link>
  );
}

export default function PricesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/60 to-blue-500/40" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">BLUEDEAL</div>
              <div className="text-[11px] text-white/60">가격현황</div>
            </div>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <NavLink href="/prices">가격현황</NavLink>
            <NavLink href="/guide">가이드</NavLink>
            <NavLink href="/contact">문의</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} BLUEDEAL</div>
            <div className="flex items-center gap-4">
              <Link className="hover:text-white" href="/guide">
                제휴/가격 안내
              </Link>
              <Link className="hover:text-white" href="/contact">
                문의/제보
              </Link>
            </div>
          </div>
          <div className="mt-3 text-[12px] text-white/50">
            가격/재고는 수시로 변동될 수 있습니다. 일부 링크는 제휴 링크일 수 있습니다.
          </div>
        </div>
      </footer>
    </div>
  );
}
