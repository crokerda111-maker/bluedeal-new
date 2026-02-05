import Link from "next/link";
import { notFound } from "next/navigation";
import { DEALS } from "../../../lib/mockDeals";

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const deal = DEALS.find((d) => d.id === params.id);
  if (!deal) return notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-sm">
        <Link href="/hot" className="text-cyan-200 hover:underline">
          ← 핫딜로
        </Link>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm text-white/70">
          {deal.category} · {deal.store} · {deal.shippingLabel}
        </div>
        <div className="mt-1 text-3xl font-semibold">{deal.priceLabel}</div>

        <div className="mt-3 text-xs text-white/55">
          외부 링크는 제휴 링크(블루딜)로 연결될 수 있으며 구매 발생 시 소정의 수수료를 받을 수 있습니다.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm font-semibold">요약</div>
        <div className="mt-3 space-y-2 text-sm text-white/80">
          {deal.bullets.map((b, i) => (
            <div key={i}>• {b}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
