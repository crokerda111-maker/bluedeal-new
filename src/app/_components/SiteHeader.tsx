"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { COMMUNITY_BOARDS } from "../../lib/boardConfig";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";
import { CATEGORIES as DEAL_CATEGORIES } from "../../lib/mockDeals";
import { getNickname, onProfileChanged, setNickname } from "../../lib/profile";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function Dropdown({
  label,
  href,
  children,
}: {
  label: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <Link className="hover:text-white" href={href}>
        {label}
      </Link>

      {/*
        Dropdown hover 유지:
        - 기존 mt-2(외부 마진)로 생기던 "마우스 이동 갭" 때문에 hover가 끊기는 문제를 해결
        - 대신 컨테이너에 pt-2(내부 패딩)로 시각적 간격을 만들고, 그 패딩 영역도 hover 영역으로 포함
      */}
      <div className="pointer-events-none absolute left-0 top-full z-50 w-56 pt-2 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="bd-surface-md bg-[#060B1A]/95 p-2 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]">
          {children}
        </div>
      </div>
    </div>
  );
}

function DropItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-white/8 hover:text-white"
    >
      <span>{children}</span>
      <span className="text-white/30">→</span>
    </Link>
  );
}

export default function SiteHeader() {
  const [nickname, setNickState] = useState("게스트");

  useEffect(() => {
    setNickState(getNickname("게스트"));
    const off = onProfileChanged(() => setNickState(getNickname("게스트")));
    return () => off();
  }, []);

  const communityItems = useMemo(() => COMMUNITY_BOARDS, []);
  const priceItems = useMemo(() => PRICE_CATEGORIES, []);

  const setNicknamePrompt = () => {
    const next = prompt("닉네임을 입력하세요 (최대 20자)", nickname === "게스트" ? "" : nickname);
    if (!next) return;
    setNickname(next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-gradient-to-br from-cyan-200/90 to-blue-500/90 shadow-[0_12px_30px_-14px_rgba(59,130,246,0.7)]">
              <div
                className="absolute inset-0 bg-white/20"
                style={{ animation: "sheen 2.8s ease-in-out infinite" }}
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">BLUEDEAL</div>
              <div className="text-xs text-white/55">IT · 커뮤니티 · 가격 · 핫딜</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm text-white/75 md:flex">
            <Link className="hover:text-white" href="/it">
              IT 소식
            </Link>

            <Dropdown label="커뮤니티" href="/community">
              <div className="px-3 py-2 text-xs text-white/45">바로가기</div>
              <DropItem href="/community">커뮤니티 홈</DropItem>
              <div className="my-2 h-px bg-white/10" />
              {communityItems.map((b) => (
                <DropItem key={b.key} href={`/community/${b.slug}`}>
                  {b.title}
                </DropItem>
              ))}
            </Dropdown>

            <Dropdown label="가격현황" href="/prices">
              <div className="px-3 py-2 text-xs text-white/45">카테고리</div>
              <DropItem href="/prices">전체 보기</DropItem>
              <div className="my-2 h-px bg-white/10" />
              {priceItems.map((c) => (
                <DropItem key={c.key} href={`/prices/${c.key}`}>
                  {c.shortTitle}
                </DropItem>
              ))}
            </Dropdown>

            <Dropdown label="핫딜" href="/hot">
              <div className="px-3 py-2 text-xs text-white/45">카테고리</div>
              <DropItem href="/hot">전체 보기</DropItem>
              <div className="my-2 h-px bg-white/10" />
              {DEAL_CATEGORIES.map((c) => (
                <DropItem key={c} href={`/hot?cat=${encodeURIComponent(c)}`}>
                  {c}
                </DropItem>
              ))}
            </Dropdown>

            <Link className="hover:text-white" href="/contact">
              문의
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={setNicknamePrompt}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10",
              )}
              type="button"
              title="닉네임 설정"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300/80" />
              <span className="max-w-[120px] truncate">{nickname}</span>
              <span className="text-white/40">설정</span>
            </button>
          </div>
        </div>

        {/* Mobile nav (no dropdown; 섹션 내부 subnav로 보완) */}
        <nav className="mt-3 flex gap-3 overflow-x-auto text-sm text-white/75 md:hidden">
          <Link className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10" href="/it">
            IT 소식
          </Link>
          <Link
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
            href="/community"
          >
            커뮤니티
          </Link>
          <Link
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
            href="/prices"
          >
            가격현황
          </Link>
          <Link className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10" href="/hot">
            핫딜
          </Link>
          <Link
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
            href="/contact"
          >
            문의
          </Link>
        </nav>
      </div>
    </header>
  );
}
