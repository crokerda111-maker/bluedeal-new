import Link from "next/link";
import { PRICE_CATEGORIES } from "../../lib/priceCategories";

export const metadata = {
  title: "가격현황 | BLUEDEAL",
  description: "PC 부품/본체 가격현황",
};

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10 hover:text-white"
    >
      {children}
    </Link>
  );
}

export default function PricesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip href="/prices">전체</Chip>
          {PRICE_CATEGORIES.map((c) => (
            <Chip key={c.key} href={`/prices/${c.key}`}>
              {c.shortTitle}
            </Chip>
          ))}
        </div>
      </section>

      {children}
    </div>
  );
}
