import Image from "next/image";
import Link from "next/link";
import { getStoredAffiliateMappings } from "../../lib/affiliateStore";
import { normalizeOutboundUrl } from "../../lib/affiliate";
import { kstDay } from "../../lib/dailyPc";
import { SHOPPING_EVENTS, shoppingEventDates, shoppingEventStatus } from "../../lib/shoppingEvents";

export default async function MonthlyEvents({ now }: { now: number }) {
  const today = kstDay(now);
  const events = SHOPPING_EVENTS.filter(event => (event.announceOn ?? event.startsOn) <= today && today <= event.endsOn);
  const mappings = await getStoredAffiliateMappings(events.map(event => event.officialUrl));

  return (
    <section aria-labelledby="monthly-events-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="monthly-events-title" className="text-xl font-semibold tracking-tight sm:text-2xl">이달의 행사</h2>
        <Link href="/events" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-200 hover:underline">행사 캘린더 →</Link>
      </div>
      {events.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => {
            const affiliate = mappings.get(normalizeOutboundUrl(event.officialUrl) ?? "");
            const directHref = affiliate ? `/go/${affiliate.code}` : event.officialUrl;
            const disclosure = `home-event-${event.id}`;
            return (
              <li key={event.id} className={event.path
                ? "grid gap-4 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#142833] via-[#141e30] to-[#302014] p-4 sm:col-span-full sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)] sm:items-center sm:p-6"
                : "rounded-2xl border border-white/15 bg-slate-950/40 p-4"}>
                <div>
                  <p className="text-xs font-semibold text-amber-200">{shoppingEventDates(event)} · {shoppingEventStatus(event, today)}</p>
                  {affiliate && !event.path ? <p id={disclosure} className="mt-1 text-xs leading-5 text-slate-200">이 링크를 통해 구매하면 블루딜이 수수료를 받을 수 있습니다.</p> : null}
                  {event.path ? (
                    <Link href={event.path} prefetch={false} className="mt-2 inline-block text-lg font-semibold text-white hover:underline sm:text-xl">{event.title} →</Link>
                  ) : (
                    <a href={directHref} rel={affiliate ? "sponsored" : undefined} aria-describedby={affiliate ? disclosure : undefined} className="mt-1 inline-block font-semibold text-white hover:underline">{event.title} →</a>
                  )}
                  <p className="mt-2 text-sm leading-6 text-slate-300">{event.description}</p>
                </div>
                {event.path ? <div>
                  {affiliate ? <p id={disclosure} className="mb-2 text-xs leading-5 text-slate-200">제휴 광고 · 이 링크를 통해 구매하면 블루딜이 수수료를 받을 수 있습니다.</p> : null}
                  <a href={directHref} rel={affiliate ? "sponsored" : undefined} aria-describedby={affiliate ? disclosure : undefined} className="block w-fit max-w-full overflow-hidden rounded-lg outline-offset-4 hover:ring-2 hover:ring-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">
                    <Image src="/gmarket-linkprice-banner-320x100.jpg" width={320} height={100} alt="G마켓 블랙프라이데이 행사관 열기" className="h-auto max-w-full" unoptimized />
                  </a>
                </div> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-white/15 p-4 text-sm text-slate-300">확인한 이번 달 진행·예정 행사는 캘린더에서 볼 수 있습니다.</p>
      )}
    </section>
  );
}
