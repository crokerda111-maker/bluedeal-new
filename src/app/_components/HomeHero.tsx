"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

export default function HomeHero({ updatedAt }: { updatedAt: string }) {
  const [q, setQ] = useState("");

  const tags = useMemo(
    () => ["DDR5", "B850", "NVMe 2TB", "CPU", "GPU", "쿨러", "반본체", "완본체"],
    [],
  );

  const chips = useMemo(() => PRICE_CATEGORIES.slice(0, 8), []);

  return (
    <section className="pt-6 md:pt-8">
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        {/* Left: hero */}
        <div className="bd-surface p-6 shadow-[0_34px_90px_-56px_rgba(59,130,246,0.7)] md:p-8">
          <div className="flex flex-wrap gap-2">
            <Pill tone="cyan">가격현황</Pill>
            <Pill tone="muted">매일 09:00·17:00 업데이트</Pill>
            <Pill tone="muted">IT 소식·커뮤니티·핫딜</Pill>
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            파란 테마로, <span className="text-cyan-200">딜 판단</span>을 더 빠르게.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
            IT 소식, 커뮤니티, 가격현황, 핫딜을 한곳에 모았습니다. 필요한 정보만 빠르게 찾아 딜 판단에 집중할 수 있게
            구성했습니다.
          </p>

          {/* search row (visual + quick links) */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#050816]/60 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="text-white/45">🔎</span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
                  placeholder="예: DDR5 6000, B850, 4070S, 7800X3D..."
                  aria-label="검색"
                />
              </div>

              <div className="flex gap-2">
                <ButtonLink href="/prices" variant="primary" className="flex-1 md:flex-none">
                  가격현황
                </ButtonLink>
                <ButtonLink href="/community" variant="soft" className="flex-1 md:flex-none">
                  커뮤니티
                </ButtonLink>
                <ButtonLink href="/community/hotdeal" variant="ghost" className="flex-1 md:flex-none">
                  핫딜
                </ButtonLink>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  onClick={() => setQ(t)}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat k="게시글" v="최신" d="IT 소식 + 커뮤니티" />
            <Stat k="가격현황" v="09/17시" d="하루 2회 업데이트" />
            <Stat k="핫딜" v="모아보기" d="구매/출처 링크 정리" />
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
              <Pill tone="cyan">09:00 / 17:00</Pill>
            </div>

            <div className="mt-2 text-sm font-semibold leading-6">RAM/CPU/GPU/본체 가격현황 요약</div>

            <div className="mt-3 text-xs text-white/65">마지막 업데이트: {fmtKorean(updatedAt)}</div>

            <div className="mt-3 space-y-1 text-xs text-white/65">
              <div>• 램, CPU, SSD, 그래픽카드, 메인보드, 쿨러</div>
              <div>• 반본체 / 완본체까지 한 번에</div>
            </div>

            <div className="mt-4 flex gap-2">
              <ButtonLink href="/prices" className="flex-1" variant="primary">
                가격현황 보기
              </ButtonLink>
              <ButtonLink href="/it" className="flex-1" variant="ghost">
                IT 소식
              </ButtonLink>
            </div>

            <div className="mt-3 text-[11px] text-white/45">
              ※ 가격 데이터는 매일 09:00 / 17:00(KST) 기준으로 갱신됩니다. 오탈자/누락 제보는 문의 게시판에 남겨주세요.
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
