"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { COMMUNITY_BOARDS } from "../../lib/boardConfig";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";
import NicknameEditor from "../../components/NicknameEditor";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

const mobileLinks = [
  { href: "/products", label: "상품목록" },
  { href: "/it", label: "IT 소식" },
  { href: "/prices", label: "가격현황" },
  { href: "/community/hotdeal", label: "핫딜" },
  { href: "/community", label: "커뮤니티" },
  { href: "/contact", label: "문의" },
];

function sectionActive(pathname: string, href: string) {
  if (href === "/community" && pathname.startsWith("/community/hotdeal")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const trigger = useRef<HTMLAnchorElement>(null);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          trigger.current?.focus();
          setOpen(false);
        }
      }}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <Link
        ref={trigger}
        aria-expanded={open}
        aria-controls={menuId}
        className="hover:text-white"
        href={href}
        onClick={() => {
          // 상위 메뉴 클릭(페이지 이동) 시, 드롭다운이 남아있지 않도록 닫기
          setOpen(false);
        }}
      >
        {label}
      </Link>

      {/*
        Hover 유지 + 클릭 시 닫힘:
        - pt-2로 "마우스 이동 갭" 제거
        - 드롭다운 내부 링크를 클릭하면 setOpen(false)로 즉시 닫힘
      */}
      <div
        id={menuId}
        hidden={!open}
        className="absolute left-0 top-full z-50 w-56 pt-2"
      >
        <div
          className="bd-surface-md bg-[#060B1A]/95 p-2 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.7)]"
          onClickCapture={(e) => {
            // 드롭다운 항목(링크) 클릭 시 닫기
            const t = e.target as HTMLElement | null;
            if (t?.closest("a")) setOpen(false);
          }}
        >
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
      className="flex items-center rounded-xl px-4 py-2 text-sm text-white/80 hover:bg-white/8 hover:text-white"
    >
      <span className="w-full text-left">{children}</span>
    </Link>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();

  const communityItems = useMemo(() => COMMUNITY_BOARDS, []);
  const priceItems = useMemo(() => PRICE_CATEGORIES, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060B1A]/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="블루딜 홈">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-cyan-200/90 to-blue-500/90 shadow-[0_12px_30px_-14px_rgba(59,130,246,0.7)]">
              <div
                className="absolute inset-0 bg-white/20 motion-safe:animate-[sheen_2.8s_ease-in-out_infinite]"
              />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold tracking-tight">BLUEDEAL</div>
              <div className="truncate text-[11px] text-white/60 sm:text-xs">IT · 커뮤니티 · 가격 · 핫딜</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="주요 메뉴" className="hidden items-center gap-5 text-sm text-white/75 lg:flex">
            <Link className="hover:text-white" href="/products">상품목록</Link>
            <Dropdown label="IT 소식" href="/it">
              <div className="px-4 py-2 text-xs text-white/70">바로가기</div>
              <DropItem href="/it?section=news">뉴스</DropItem>
              <DropItem href="/it?section=pick">곰선생 추천픽</DropItem>
            </Dropdown>

            <Dropdown label="가격현황" href="/prices">
              <div className="px-4 py-2 text-xs text-white/70">카테고리</div>
              <DropItem href="/prices">전체 보기</DropItem>
              <DropItem href="/evaluate">PC 구매 판단 · 시험 운영</DropItem>
              <div className="my-2 h-px bg-white/10" />
              {priceItems.map((c) => (
                <DropItem key={c.key} href={`/prices/${c.key}`}>
                  {c.shortTitle}
                </DropItem>
              ))}
            </Dropdown>

            <Link className="hover:text-white" href="/community/hotdeal">
              핫딜
            </Link>

            <Dropdown label="커뮤니티" href="/community">
              <div className="px-4 py-2 text-xs text-white/70">바로가기</div>
              <DropItem href="/community">커뮤니티 홈</DropItem>
              <div className="my-2 h-px bg-white/10" />
              {communityItems.map((b) => (
                <DropItem key={b.key} href={`/community/${b.slug}`}>
                  {b.title}
                </DropItem>
              ))}
            </Dropdown>

            <Link className="hover:text-white" href="/contact">
              문의
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <NicknameEditor header />
          </div>
        </div>

        <nav aria-label="모바일 주요 메뉴" className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:hidden">
          {mobileLinks.map(({ href, label }) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
              className={cn("inline-flex min-h-11 min-w-0 items-center justify-center whitespace-nowrap rounded-xl border px-1 text-[11px] min-[360px]:text-xs",
                sectionActive(pathname, href) ? "border-cyan-300/40 bg-cyan-300/15 font-semibold text-cyan-100" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10")}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
