import Image from "next/image";
import Link from "next/link";
import { getStoredAffiliateMappings } from "../../lib/affiliateStore";
import { GMARKET_BLACK_FRIDAY as event } from "../../lib/gmarketBlackFriday";

export default async function MonthlyEvents({ now }: { now: number }) {
  const visibleEvent = now >= event.trackingStartsAt && now < event.endsAt;
  const mappings = visibleEvent ? await getStoredAffiliateMappings([event.officialUrl]) : undefined;
  const affiliate = mappings?.get(event.officialUrl);

  return (
    <section aria-labelledby="monthly-events-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="monthly-events-title" className="text-xl font-semibold tracking-tight sm:text-2xl">이달의 행사</h2>
        <Link href="/events" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 hover:underline">행사 캘린더 →</Link>
      </div>
      {visibleEvent ? (
        <div className="grid gap-5 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#142833] via-[#141e30] to-[#302014] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)] sm:items-center sm:p-6">
          <div>
            <p className="text-sm font-semibold text-amber-200">{event.dates} · {now < event.startsAt ? "행사 예고" : "행사 기간"}</p>
            <Link href={event.path} prefetch={false} className="mt-2 inline-block text-lg font-semibold tracking-tight text-white hover:underline sm:text-xl">{event.title} →</Link>
            <p className="mt-2 text-sm leading-6 text-slate-300">PC 부품·완본체·주변기기·식품 핫딜과 할인 조건을 확인하세요.</p>
          </div>
          <div>
            {affiliate ? <p id="gmarket-banner-disclosure" className="mb-2 text-xs leading-5 text-slate-200">제휴 광고 · 이 링크를 통해 구매하면 블루딜이 수수료를 받을 수 있습니다.</p> : null}
            <a href={affiliate ? `/go/${affiliate.code}` : event.officialUrl} rel={affiliate ? "sponsored" : undefined} aria-describedby={affiliate ? "gmarket-banner-disclosure" : undefined} className="block w-fit max-w-full overflow-hidden rounded-lg outline-offset-4 hover:ring-2 hover:ring-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
              <Image src="/gmarket-linkprice-banner-320x100.jpg" width={320} height={100} alt="G마켓 공식 배너 · 블랙프라이데이 행사관 열기" className="h-auto max-w-full" unoptimized />
            </a>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-white/15 p-4 text-sm text-slate-300">확인한 이번 달 진행·예정 행사는 캘린더에서 볼 수 있습니다.</p>
      )}
    </section>
  );
}
