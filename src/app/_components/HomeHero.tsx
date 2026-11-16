"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function fmtKorean(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function Pill({
  children,
  tone = "base",
}: {
  children: React.ReactNode;
  tone?: "base" | "cyan" | "muted";
}) {
  const cls =
    tone === "cyan"
      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      : tone === "muted"
      ? "border-white/10 bg-white/5 text-white/70"
      : "border-white/12 bg-white/6 text-white/80";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] leading-none", cls)}>
      {children}
    </span>
  );
}

function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "soft";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60";
  const style =
    variant === "primary"
      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200 shadow-[0_14px_40px_-16px_rgba(34,211,238,0.55)]"
      : variant === "soft"
      ? "bg-white/8 hover:bg-white/12 border border-white/10 text-white"
      : "bg-transparent hover:bg-white/8 border border-white/10 text-white/90";

  return (
    <Link href={href} className={cn(base, style, className)}>
      {children}
    </Link>
  );
}

function Stat({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="bd-surface-md p-4">
      <div className="text-xs text-white/55">{k}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{v}</div>
      <div className="mt-1 text-xs text-white/55">{d}</div>
    </div>
  );
}

export default function HomeHero({ updatedAt, schedule, itemCount }: { updatedAt: string; schedule: string; itemCount: number }) {
  const chips = useMemo(() => PRICE_CATEGORIES.slice(0, 8), []);

  return (
    <section className="pt-6 md:pt-8">
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        {/* Left: hero */}
        <div className="bd-surface p-6 shadow-[0_34px_90px_-56px_rgba(59,130,246,0.7)] md:p-8">
          <div className="flex flex-wrap gap-2">
            <Pill tone="cyan">IT 소식</Pill>
            <Pill tone="muted">하드웨어 커뮤니티</Pill>
            <Pill tone="muted">핫딜 공유</Pill>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            PC와 IT 이야기를,
            <br />
            <span className="text-cyan-200">함께 나누고 빠르게 확인하세요.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
            최신 IT 뉴스부터 하드웨어 질문, 사용기, 오버클럭 정보와 핫딜까지 한곳에서 나눕니다.
            상품 링크에는 광고·제휴 여부를 투명하게 안내합니다.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/community" variant="primary">
              커뮤니티 둘러보기
            </ButtonLink>
            <ButtonLink href="/it" variant="soft">
              IT 소식 보기
            </ButtonLink>
            <ButtonLink href="/community/hotdeal" variant="ghost">
              핫딜 확인하기
            </ButtonLink>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat k="IT 소식" v="뉴스" d="업데이트·이슈·추천픽" />
            <Stat k="커뮤니티" v="참여" d="질문·후기·정보 공유" />
            <Stat k="핫딜" v="공유" d="상품 정보·제휴 링크" />
          </div>
        </div>

        {/* Right: status card */}
        <aside className="bd-surface p-6 md:p-7">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">오늘의 현황</div>
            <Link href="/prices" className="text-xs text-cyan-200 hover:underline">
              더보기
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map((c) => (
              <Link
                key={c.key}
                href={`/prices/${c.key}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
              >
                {c.shortTitle}
              </Link>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#050816]/60 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/55">업데이트</div>
              <Pill tone="cyan">가격 확인</Pill>
            </div>

            <div className="mt-2 text-sm font-semibold leading-6">
              {itemCount > 0 ? `현재 등록 상품 ${itemCount}개` : "첫 가격 데이터 등록 준비 중"}
            </div>

            <div className="mt-3 text-xs text-white/65">최근 가격 확인: {fmtKorean(updatedAt)} KST</div>

            <div className="mt-3 space-y-1 text-xs text-white/65">
              <div>• 램, CPU, SSD, 그래픽카드, 메인보드, 쿨러</div>
              <div>• 반본체 / 완본체까지 한 번에</div>
            </div>

            <div className="mt-4 flex gap-2">
              <ButtonLink href="/prices" className="flex-1" variant="primary">
                가격현황 보기
              </ButtonLink>
              <ButtonLink href="/community" className="flex-1" variant="ghost">
                커뮤니티
              </ButtonLink>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              ※ 갱신 방식: {schedule}. 오탈자/누락 제보는 문의 게시판에 남겨주세요.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
