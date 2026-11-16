"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRICE_CATEGORIES } from "../lib/priceCategories";

const categories = [{ href: "/prices", label: "전체" }, ...PRICE_CATEGORIES.map(category => ({ href: `/prices/${category.key}`, label: category.shortTitle }))];

export default function PriceCategoryNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="가격 카테고리" className="bd-surface-md p-3">
      <div className="bd-scroll-row flex items-center gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {categories.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border px-3 text-sm ${pathname === href ? "border-cyan-300/40 bg-cyan-300/15 font-semibold text-cyan-100" : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"}`}>
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
