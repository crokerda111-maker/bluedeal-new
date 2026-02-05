import Link from "next/link";

export const metadata = {
  title: "문의/제보 | BLUEDEAL",
  description: "문의/제보",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/60 to-blue-500/40" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">BLUEDEAL</div>
              <div className="text-[11px] text-white/60">문의/제보</div>
            </div>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <Link className="text-white/80 hover:text-white" href="/prices">
              가격현황
            </Link>
            <Link className="text-white/80 hover:text-white" href="/guide">
              가이드
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">문의 / 제보</h1>
          <p className="mt-2 text-sm text-white/70">
            현재는 간단한 운영 단계입니다. 아래 방법 중 편한 방법으로 제보해 주세요.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">가격/상품 제보</div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>카테고리 (램/CPU/메인보드/그래픽카드/쿨러/반본체/완본체)</li>
              <li>상품명 + 핵심 스펙</li>
              <li>링크(판매처 URL)</li>
              <li>확인된 가격</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">문의</div>
            <div className="mt-3 text-sm text-white/70">
              아직 폼을 붙이기 전이라, 임시로 운영합니다.
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-[13px]">
                <div className="text-white/60">메일 주소를 정해두면 여기에 표시하면 됩니다.</div>
                <div className="mt-2 text-white/40">(예: contact@bluedeal.co.kr)</div>
              </div>
              <div className="mt-4 text-[12px] text-white/50">
                원하시면 다음 단계에서 구글폼/노션폼/자체 폼으로 바로 붙일 수 있게 구조 잡아줄게.
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">
          © {new Date().getFullYear()} BLUEDEAL
        </div>
      </footer>
    </div>
  );
}
