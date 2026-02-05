import Link from "next/link";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";

export const metadata = {
  title: "가이드 | BLUEDEAL",
  description: "가격현황 이용 가이드 및 구매 팁",
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-400/60 to-blue-500/40" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">BLUEDEAL</div>
              <div className="text-[11px] text-white/60">가이드</div>
            </div>
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            <Link className="text-white/80 hover:text-white" href="/prices">
              가격현황
            </Link>
            <Link className="text-white/80 hover:text-white" href="/contact">
              문의
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-2xl font-semibold tracking-tight">구매 가이드 / 가격현황 안내</h1>
          <p className="mt-2 text-sm text-white/70">
            BLUEDEAL은 PC 부품/본체의 가격 변화를 쉽게 확인할 수 있게 정리합니다.{" "}
            <b>가격은 변동될 수 있으며</b>, 표기된 가격이 최종 구매 가격을 보장하지 않습니다.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">가격 갱신 주기</div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>갱신: <b>매일 09:00 / 17:00</b> (2회)</li>
              <li>갱신 직후에도 공급처/재고 상황에 따라 실제 가격은 달라질 수 있습니다.</li>
              <li>표 상단/허브에 <b>마지막 업데이트 시각</b>을 표시합니다.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">가격 보는 법 (빠른 팁)</div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
              <li>“24h” 변화율은 최근 24시간 내 변화(가능한 경우)만 표시합니다.</li>
              <li>“7일/30일 최저”는 최근 기간 내 기록된 최저가입니다(수집 범위에 따라 달라질 수 있음).</li>
              <li>가격 비교는 <b>동일 스펙/동일 제품</b>끼리만 하는 것이 안전합니다.</li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">카테고리 구성</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRICE_CATEGORIES.map((c) => (
              <Link
                key={c.key}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:border-white/20 hover:bg-white/10"
                href={`/prices/${c.key}`}
              >
                <div className="font-semibold text-white">{c.shortTitle}</div>
                <div className="mt-1 text-[12px] text-white/60">{c.description}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">제휴(Affiliate) 고지</div>
          <div className="mt-3 space-y-2 text-sm text-white/70">
            <p>
              일부 링크는 제휴 링크일 수 있으며, 사용자가 링크를 통해 구매할 경우 BLUEDEAL이 일정 수수료를 받을 수 있습니다.
            </p>
            <p>
              제휴 수수료는 운영 비용에 사용되며, <b>사용자 구매 가격은 동일하거나 변동이 없습니다</b>(단, 판매처 정책에 따라 달라질 수 있음).
            </p>
            <p className="text-[12px] text-white/50">
              파트너별로 별도 문구/고지 형식이 필요한 경우, 운영 정책에 따라 고지 문구를 업데이트합니다.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="text-lg font-semibold">문의/제보</div>
          <div className="mt-3 text-sm text-white/70">
            가격 오류/누락/추가 요청이 있으면{" "}
            <Link className="text-cyan-200 hover:text-cyan-100" href="/contact">
              문의 페이지
            </Link>
            로 남겨주세요.
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-4 text-sm text-white/60">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} BLUEDEAL</div>
            <div className="flex items-center gap-4">
              <Link className="hover:text-white" href="/prices">
                가격현황
              </Link>
              <Link className="hover:text-white" href="/contact">
                문의/제보
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
