import Link from "next/link";

export const metadata = {
  title: "IT 소식 | BLUEDEAL",
  description: "IT 소식 모아보기",
};

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="text-white/80 hover:text-white" href={href}>
      {children}
    </Link>
  );
}

const SEED_NEWS = [
  {
    title: "(샘플) 그래픽카드 신제품 루머/요약 모음",
    badge: "GPU",
    summary: "정리형 글: 출시 일정/가격대/성능 루머는 변동될 수 있습니다.",
  },
  {
    title: "(샘플) DDR5 가격 흐름 한눈에 보기",
    badge: "RAM",
    summary: "가격현황 페이지 기준으로 체감 변동 포인트를 정리합니다.",
  },
  {
    title: "(샘플) Windows/드라이버 업데이트 주의사항",
    badge: "TIP",
    summary: "문제 발생 빈도가 높은 케이스를 짧게 정리합니다.",
  },
];

export default function ITNewsPage() {
  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/60 to-blue-500/40" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">BLUEDEAL</div>
              <div className="text-[11px] text-white/60">IT 소식</div>
            </div>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <NavLink href="/it">IT 소식</NavLink>
            <NavLink href="/community">커뮤니티</NavLink>
            <NavLink href="/prices">가격현황</NavLink>
            <NavLink href="/">핫딜</NavLink>
            <NavLink href="/contact">문의</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">IT 소식</h1>
          <p className="mt-2 text-sm text-white/70">
            초기 구색용 섹션입니다. 다음 단계에서 RSS/크롤링/에디터 방식 중 하나로 실제 콘텐츠로 교체하면 됩니다.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {SEED_NEWS.map((n) => (
            <div key={n.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                {n.badge}
              </div>
              <div className="mt-3 text-lg font-semibold leading-snug">{n.title}</div>
              <div className="mt-2 text-sm text-white/70">{n.summary}</div>
              <div className="mt-4 text-[12px] text-white/50">※ 샘플 콘텐츠 (운영 방식 확정 시 교체)</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm text-white/70">
            <div className="font-semibold text-white">다음 단계 옵션</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>RSS 기반: 빠르고 안정적(출처 명확)</li>
              <li>요약/큐레이션: 짧은 요약 + 관련 링크 방식</li>
              <li>직접 작성: 컨텐츠 품질은 좋지만 운영 부담 증가</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">© {new Date().getFullYear()} BLUEDEAL</div>
      </footer>
    </div>
  );
}
