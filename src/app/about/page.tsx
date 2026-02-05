import Link from "next/link";

export const metadata = {
  title: "소개 | BLUEDEAL",
  description: "BLUEDEAL 소개",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/60 to-blue-500/40" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">BLUEDEAL</div>
              <div className="text-[11px] text-white/60">소개</div>
            </div>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <Link className="text-white/80 hover:text-white" href="/prices">
              가격현황
            </Link>
            <Link className="text-white/80 hover:text-white" href="/guide">
              가이드
            </Link>
            <Link className="text-white/80 hover:text-white" href="/contact">
              문의
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">BLUEDEAL은 뭐 하는 곳?</h1>
          <p className="mt-2 text-sm text-white/70">
            PC 부품/본체 가격을 보기 쉽게 모으고, 구매 판단을 빠르게 돕는 것을 목표로 합니다.
          </p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          <div className="font-semibold text-white">운영 원칙</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>가격은 일정 주기로 수집/정리하며, 마지막 업데이트 시간을 표시합니다.</li>
            <li>제휴 링크가 포함될 수 있으며, 고지 문구를 명확히 제공합니다.</li>
            <li>잘못된 가격/링크는 빠르게 수정합니다(제보 환영).</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">© {new Date().getFullYear()} BLUEDEAL</div>
      </footer>
    </div>
  );
}
