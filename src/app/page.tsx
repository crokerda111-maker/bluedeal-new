"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, DEALS, KEYWORDS } from "../lib/mockDeals";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function formatAgo(min: number) {
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}시간 ${m}분 전` : `${h}시간 전`;
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

function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "soft" }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60";
  const style =
    variant === "primary"
      ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200 shadow-[0_14px_40px_-16px_rgba(34,211,238,0.55)]"
      : variant === "soft"
      ? "bg-white/8 hover:bg-white/12 border border-white/10 text-white"
      : "bg-transparent hover:bg-white/8 border border-white/10 text-white/90";

  return (
    <button className={cn(base, style, className)} {...props}>
      {children}
    </button>
  );
}

function Stat({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/55">{k}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{v}</div>
      <div className="mt-1 text-xs text-white/55">{d}</div>
    </div>
  );
}

function HeatBar({ heat }: { heat: number }) {
  return (
    <div className="w-28">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span>Heat</span>
        <span className="text-white/80">{heat}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-gradient-to-r from-cyan-200 to-blue-500"
          style={{ width: `${Math.max(0, Math.min(100, heat))}%` }}
        />
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "hot" | "priceAsc" | "priceDesc">("latest");
  const [onlyFreeShip, setOnlyFreeShip] = useState(false);
  const [onlyCoupon, setOnlyCoupon] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = DEALS.filter((d) => {
      const matchQ =
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.store.toLowerCase().includes(q) ||
        d.tag?.toLowerCase().includes(q) ||
        d.source.toLowerCase().includes(q);

      const matchShip = !onlyFreeShip || d.shippingLabel.includes("무료");
      const matchCoupon = !onlyCoupon || d.tag === "쿠폰";

      return matchQ && matchShip && matchCoupon;
    });

    list = [...list].sort((a, b) => {
      if (sort === "latest") return a.minutesAgo - b.minutesAgo;
      if (sort === "hot") return b.heat - a.heat;
      if (sort === "priceAsc") return a.price - b.price;
      return b.price - a.price;
    });

    return list;
  }, [query, sort, onlyFreeShip, onlyCoupon]);

  const topPick = filtered[0] ?? DEALS[0];

  return (
    <div className="min-h-screen bg-[#060B1A] text-white">
      {/* 배경 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-44 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/18 blur-[110px]" />
        <div className="absolute top-52 left-[-160px] h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[95px]" />
        <div className="absolute bottom-[-220px] right-[-160px] h-[560px] w-[560px] rounded-full bg-indigo-500/14 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,58,138,0.25),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(34,211,238,0.12),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:84px_84px]" />
      </div>

      <style jsx global>{`
        @keyframes sheen {
          0% {
            transform: translateX(-30%);
            opacity: 0;
          }
          20% {
            opacity: 1;
          }
          100% {
            transform: translateX(130%);
            opacity: 0;
          }
        }
      `}</style>

      <div className="relative mx-auto max-w-6xl px-4 pb-16">
        {/* 헤더 */}
        <header className="sticky top-0 z-30 -mx-4 px-4 backdrop-blur supports-[backdrop-filter]:bg-[#060B1A]/65">
          <div className="flex items-center justify-between border-b border-white/10 py-4">
            <div className="flex items-center gap-3">
              <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gradient-to-br from-cyan-200/90 to-blue-500/90 shadow-[0_12px_30px_-14px_rgba(59,130,246,0.7)]">
                <div className="absolute inset-0 bg-white/20" style={{ animation: "sheen 2.8s ease-in-out infinite" }} />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight">BLUEDEAL</div>
                <div className="text-xs text-white/55">IT 소식·커뮤니티·가격현황·핫딜</div>
              </div>
            </div>

            <nav className="hidden items-center gap-6 text-sm text-white/75 md:flex">
              <a className="hover:text-white" href="/it">
                IT 소식
              </a>
              <a className="hover:text-white" href="/community">
                커뮤니티
              </a>
              <a className="hover:text-white" href="/prices">
                가격현황
              </a>
              <a className="hover:text-white" href="/">
                핫딜
              </a>
              <a className="hover:text-white" href="/contact">
                문의
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Button variant="ghost" className="hidden md:inline-flex">
                로그인
              </Button>
              <Button onClick={() => alert("MVP: 핫딜 제보 폼은 다음 단계에서 붙입니다.")}>핫딜 제보</Button>
            </div>
          </div>
        </header>

        {/* 히어로 + 트렌딩 */}
        <section className="pt-10 md:pt-14">
          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            {/* 왼쪽: 히어로 */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_34px_90px_-56px_rgba(59,130,246,0.7)] md:p-8">
              <div className="flex flex-wrap gap-2">
                <Pill tone="cyan">실시간 핫딜</Pill>
                <Pill tone="muted">/go 제휴 리다이렉트</Pill>
                <Pill tone="muted">요약 템플릿</Pill>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
                파란 테마로, <span className="text-cyan-200">딜 판단</span>을 더 빠르게.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">
                링크 기반으로 딜을 모으고, 핵심만 템플릿으로 정리합니다. 클릭은 내부 /go 링크로 관리해서 교체·추적이 쉬워집니다.
              </p>

              {/* 검색/필터 */}
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#050816]/60 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <span className="text-white/45">🔎</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-white/35"
                      placeholder="예: B850, DDR5 6000, NVMe 2TB, QHD 165..."
                      aria-label="검색"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant={onlyFreeShip ? "primary" : "soft"}
                      className="flex-1 md:flex-none"
                      onClick={() => setOnlyFreeShip((v) => !v)}
                    >
                      무료배송
                    </Button>
                    <Button
                      variant={onlyCoupon ? "primary" : "soft"}
                      className="flex-1 md:flex-none"
                      onClick={() => setOnlyCoupon((v) => !v)}
                    >
                      쿠폰만
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 md:flex-none"
                      onClick={() => {
                        setQuery("");
                        setOnlyFreeShip(false);
                        setOnlyCoupon(false);
                      }}
                    >
                      초기화
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {["역대가", "HOT", "빠름", "PC부품", "모니터"].map((t) => (
                    <button
                      key={t}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                      onClick={() => setQuery(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Stat k="업데이트" v="1~5분 주기" d="소스/정책에 맞춰 조절" />
                <Stat k="템플릿" v="요약·주의·대체" d="결정에 필요한 구조 고정" />
                <Stat k="링크관리" v="/go 리다이렉트" d="링크 교체/집계가 쉬움" />
              </div>
            </div>

            {/* 오른쪽: 트렌딩 카드 */}
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-7">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">오늘의 키워드</div>
                <a href="#" className="text-xs text-cyan-200 hover:underline">
                  더보기
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {KEYWORDS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setQuery(k)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                  >
                    {k}
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-[#050816]/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/55">TOP PICK</div>
                  <Pill tone="cyan">{topPick.tag ?? "추천"}</Pill>
                </div>

                <div className="mt-2 text-sm font-semibold leading-6">{topPick.title}</div>

                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{topPick.priceLabel}</div>
                    <div className="text-xs text-white/55">
                      {topPick.store} · {topPick.shippingLabel} · {formatAgo(topPick.minutesAgo)}
                    </div>
                  </div>
                  <HeatBar heat={topPick.heat} />
                </div>

                <div className="mt-3 space-y-1 text-xs text-white/65">
                  {topPick.bullets.slice(0, 3).map((b, i) => (
                    <div key={i}>• {b}</div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" onClick={() => router.push(`/deals/${topPick.id}`)}>
                    딜 보기
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      if (topPick.sourceUrl && topPick.sourceUrl !== "#") window.open(topPick.sourceUrl, "_blank", "noreferrer");
                    }}
                  >
                    출처
                  </Button>
                </div>

                <div className="mt-3 text-[11px] text-white/45">* 실제 운영에선 출처 링크/삭제요청 대응을 기본으로 깔고 갑니다.</div>
              </div>
            </aside>
          </div>
        </section>

        {/* 카테고리 */}
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm font-semibold">카테고리</div>
              <div className="mt-1 text-xs text-white/55">클릭하면 해당 카테고리 딜만 모아보기</div>
            </div>
            <a href="#" className="text-xs text-cyan-200 hover:underline">
              전체 카테고리
            </a>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {CATEGORIES.map((c) => (
              <a
                key={c}
                href="#"
                className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{c}</div>
                  <div className="text-white/35 group-hover:text-white/70">→</div>
                </div>
                <div className="mt-2 text-xs text-white/55">최신 · 역대가 · 쿠폰 필터</div>
              </a>
            ))}
          </div>
        </section>

        {/* 리스트 */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-semibold">실시간 핫딜</div>
              <div className="mt-1 text-xs text-white/55">메타(제목/가격/판매처/시간) + 템플릿 요약으로 “판단”에 집중</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 outline-none"
                aria-label="정렬"
              >
                <option value="latest">최신순</option>
                <option value="hot">인기순</option>
                <option value="priceAsc">가격 낮은순</option>
                <option value="priceDesc">가격 높은순</option>
              </select>
              <Button variant="soft" onClick={() => setQuery("퀘")}>
                퀘 소스
              </Button>
              <Button variant="soft" onClick={() => setQuery("조드")}>
                조드 소스
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
                <div className="text-sm font-semibold">검색 결과가 없음</div>
                <div className="mt-2 text-xs text-white/55">키워드를 줄이거나 필터를 해제해봐.</div>
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      setQuery("");
                      setOnlyFreeShip(false);
                      setOnlyCoupon(false);
                    }}
                  >
                    초기화
                  </Button>
                </div>
              </div>
            ) : (
              filtered.map((d) => (
                <div key={d.id} className="group rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {d.tag ? <Pill tone="cyan">{d.tag}</Pill> : null}
                        <Pill tone="muted">{d.store}</Pill>
                        <Pill tone="muted">{d.source} 소스</Pill>
                        <span className="text-xs text-white/45">{formatAgo(d.minutesAgo)}</span>
                      </div>

                      <div className="mt-2 truncate text-base font-semibold tracking-tight group-hover:text-cyan-100">{d.title}</div>

                      <div className="mt-2 grid gap-1 text-xs text-white/65 md:grid-cols-3">
                        <div>• {d.bullets[0]}</div>
                        <div>• {d.bullets[1]}</div>
                        <div className="hidden md:block">• {d.bullets[2]}</div>
                      </div>

                      <div className="mt-2 text-[11px] text-white/45">
                        출처:{" "}
                        <a className="underline hover:text-white" href={d.sourceUrl} target="_blank" rel="noreferrer">
                          원문
                        </a>{" "}
                        · 이동:{" "}
                        <a className="underline hover:text-white" href={d.goUrl}>
                          /go 링크
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 md:justify-end">
                      <div className="text-right">
                        <div className="text-lg font-semibold">{d.priceLabel}</div>
                        <div className="text-xs text-white/55">{d.shippingLabel}</div>
                      </div>

                      <div className="hidden md:block">
                        <HeatBar heat={d.heat} />
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => router.push(`/deals/${d.id}`)}>딜 보기</Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (d.sourceUrl && d.sourceUrl !== "#") window.open(d.sourceUrl, "_blank", "noreferrer");
                          }}
                        >
                          출처
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 하단 섹션 */}
        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">커뮤니티/팁</div>
            <div className="mt-1 text-xs text-white/55">리뷰·질문·오버클럭·자료실</div>

            <div className="mt-5 space-y-3">
              {[
                { t: "하드웨어 질문/추천 게시판", href: "/community/hardware", d: "견적·호환·추천" },
                { t: "오버클럭 팁/세팅 공유", href: "/community/overclock", d: "PBO·언더볼팅·램 타이밍" },
                { t: "리뷰 게시판", href: "/community/review", d: "제품 후기·사용기" },
                { t: "자료실", href: "/community/resources", d: "유틸·드라이버·가이드 링크" },
              ].map((row) => (
                <a
                  key={row.href}
                  href={row.href}
                  className="block rounded-2xl border border-white/10 bg-[#050816]/60 p-4 hover:bg-white/10"
                >
                  <div className="text-sm font-semibold">{row.t}</div>
                  <div className="mt-1 text-xs text-white/55">{row.d}</div>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">알림 구독</div>
            <div className="mt-1 text-xs text-white/55">키워드 기반으로만 받기(메일/웹푸시 확장)</div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-[#050816]/60 p-4">
              <label className="text-xs text-white/55">이메일</label>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/35"
                placeholder="you@example.com"
              />
              <label className="mt-4 block text-xs text-white/55">관심 키워드(쉼표로 구분)</label>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/35"
                placeholder="예: NVMe 2TB, B850, DDR5 6000"
              />
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => alert("MVP: 구독 저장은 다음 단계에서 붙입니다.")}>
                  구독하기
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setQuery("NVMe 2TB")}>
                  샘플
                </Button>
              </div>
            </div>

            <div className="mt-4 text-[11px] text-white/45">* 운영 단계에서 텔레그램/디스코드도 쉽게 확장 가능.</div>
          </div>
        </section>

        {/* 푸터 */}
        <footer className="mt-12 border-t border-white/10 py-8 text-xs text-white/55">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-white/75">BLUEDEAL</div>
              <div className="mt-1">출처 표기 · 제휴 링크 안내 · 삭제 요청 즉시 반영</div>
            </div>
            <div className="flex flex-wrap gap-4">
              <a className="hover:text-white" href="#">
                이용약관
              </a>
              <a className="hover:text-white" href="#">
                개인정보처리방침
              </a>
              <a className="hover:text-white" href="#">
                제휴/문의
              </a>
              <a className="hover:text-white" href="#">
                공지
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
