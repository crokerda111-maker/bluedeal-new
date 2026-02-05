import Link from "next/link";
import { notFound } from "next/navigation";
import { DEALS } from "../../../lib/mockDeals";

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const deal = DEALS.find((d) => d.id === params.id);
  if (!deal) return notFound();

  return (
    <main className="min-h-screen bg-[#060B1A] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/" className="text-sm text-cyan-200 hover:underline">
          ← 홈
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{deal.title}</h1>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/70">
            {deal.store} · {deal.shippingLabel}
          </div>
          <div className="mt-1 text-3xl font-semibold">{deal.priceLabel}</div>

          <div className="mt-3 text-xs text-white/55">
            외부 링크는 제휴 링크(블루딜)로 연결되며 구매 발생 시 소정의 수수료를 받을 수 있습니다.
          </div>

          <div className="mt-4 flex gap-2">
            <Link
              href={deal.goUrl}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              구매 링크(/go)
            </Link>

            <a
              href={deal.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              출처
            </a>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-sm text-white/80">
          {deal.bullets.map((b, i) => (
            <div key={i}>• {b}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
