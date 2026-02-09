import Link from "next/link";
import { notFound } from "next/navigation";
import { DEALS } from "../../../lib/mockDeals";
import SmartLink from "../../../components/SmartLink";

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

      <div className="bd-surface-md p-5">
        <div className="text-sm text-white/70">
          {deal.category} · {deal.store} · {deal.shippingLabel}
        </div>
        <div className="mt-1 text-3xl font-semibold">{deal.priceLabel}</div>

        <div className="mt-3 text-xs text-white/55">
          구매 링크는 새 창으로 열리며, 일부는 제휴 링크일 수 있습니다. 구매가 발생하면 소정의 수수료를 받을 수 있습니다.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <SmartLink
            href={deal.goUrl}
            className="inline-flex items-center justify-center rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
            title="구매 링크(새 창)"
          >
            구매 링크
          </SmartLink>

          <a
            href={deal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
          >
            출처
          </a>
        </div>
      </div>

      <div className="bd-surface-md p-5">
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
