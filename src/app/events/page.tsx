import Link from "next/link";
import { getStoredAffiliateMappings } from "../../lib/affiliateStore";
import { normalizeOutboundUrl } from "../../lib/affiliate";
import { kstDay } from "../../lib/dailyPc";
import { SHOPPING_EVENTS, shoppingEventDates, shoppingEventStatus } from "../../lib/shoppingEvents";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata(
  "이달의 행사 캘린더 | PC 부품·완본체 할인 일정 · 블루딜",
  "G마켓·옥션·쿠팡·SSG 등 국내 쇼핑몰의 공식 행사 기간, 할인 대상과 쿠폰 조건을 한국시간 기준으로 확인하세요.",
  "/events",
);

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
async function loadCalendar(searchParams: Promise<{ month?: string | string[] }>) {
  const { month } = await searchParams;
  const today = kstDay(Date.now());
  const selected = typeof month === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  const [year, monthNumber] = selected.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthAt = (offset: number) => new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
  return { today, selected, year, monthNumber, firstWeekday, dayCount, previous: monthAt(-1), next: monthAt(1) };
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const calendar = await loadCalendar(searchParams);
  const firstDate = `${calendar.selected}-01`;
  const lastDate = `${calendar.selected}-${calendar.dayCount}`;
  const events = SHOPPING_EVENTS.filter(event =>
    event.startsOn <= lastDate && event.endsOn >= firstDate && (!event.announceOn || event.announceOn <= calendar.today)
  ).sort((a, b) =>
    Number(a.endsOn < calendar.today) - Number(b.endsOn < calendar.today) || a.endsOn.localeCompare(b.endsOn)
  );
  const mappings = await getStoredAffiliateMappings(events.filter(event => !event.path && event.endsOn >= calendar.today).map(event => event.officialUrl));
  const weekCount = Math.ceil((calendar.firstWeekday + calendar.dayCount) / 7);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">이달의 행사</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">공식 일정과 블루딜에서 확인한 핫딜을 한국시간으로 확인하세요.</p>
      </header>
      <section aria-labelledby="calendar-month" className="rounded-2xl border border-white/15 bg-slate-950/40 p-3 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="calendar-month" className="text-lg font-bold sm:text-xl">{calendar.year}년 {calendar.monthNumber}월</h2>
          <nav aria-label="캘린더 월 이동" className="flex flex-wrap gap-2 text-sm">
            {calendar.previous.startsWith("20") ? <Link className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10" href={`/events?month=${calendar.previous}`}>← 이전 달</Link> : null}
            <Link className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10" href="/events">이번 달</Link>
            {calendar.next.startsWith("20") ? <Link className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10" href={`/events?month=${calendar.next}`}>다음 달 →</Link> : null}
          </nav>
        </div>
        <table className="w-full table-fixed border-collapse text-center" aria-labelledby="calendar-month">
          <thead><tr>{weekdays.map(day => <th key={day} scope="col" className="pb-2 text-xs font-medium text-slate-300 sm:text-sm">{day}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: weekCount }, (_, week) => (
              <tr key={week}>
                {weekdays.map((weekday, index) => {
                  const day = week * 7 + index - calendar.firstWeekday + 1;
                  if (day < 1 || day > calendar.dayCount) return <td key={weekday} className="border border-white/10 bg-white/[0.02]" />;
                  const date = calendar.selected + "-" + String(day).padStart(2, "0");
                  const scheduled = events.filter(event => event.startsOn <= date && date <= event.endsOn);
                  return (
                    <td key={weekday} className={`border border-white/10 align-top ${scheduled.length ? "bg-amber-200/10" : ""}`}>
                      <div className="min-h-12 px-0.5 py-1 sm:min-h-16">
                        <time dateTime={date} aria-current={date === calendar.today ? "date" : undefined} className={`block text-sm ${date === calendar.today ? "font-bold text-cyan-200" : "text-slate-300"}`}>{day}</time>
                        {scheduled.slice(0, 2).map(event => (
                          <a key={event.id} href={`#${event.id}`} aria-label={`${calendar.monthNumber}월 ${day}일 ${event.title}`} className="block truncate text-[10px] leading-5 text-amber-100 hover:underline sm:text-xs">{event.store}</a>
                        ))}
                        {scheduled.length > 2 ? <a href="#calendar-events-title" aria-label={`${calendar.monthNumber}월 ${day}일 행사 ${scheduled.length}개, 월간 목록 보기`} className="block text-[10px] text-cyan-200 hover:underline sm:text-xs">+{ scheduled.length - 2 }</a> : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="calendar-events-title">
        <h2 id="calendar-events-title" className="text-xl font-semibold">{calendar.monthNumber}월 행사 목록</h2>
        {events.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {events.map(event => {
              const status = shoppingEventStatus(event, calendar.today);
              const affiliate = status === "종료" ? undefined : mappings.get(normalizeOutboundUrl(event.officialUrl) ?? "");
              const disclosure = `event-disclosure-${event.id}`;
              return (
                <li key={event.id} id={event.id} className="scroll-mt-20 rounded-2xl border border-white/15 bg-slate-950/40 p-4">
                  <p className="text-xs font-semibold text-amber-200">{shoppingEventDates(event)} · {status}</p>
                  <h3 className="mt-1 font-semibold text-white">{event.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{event.description}</p>
                  {event.paymentOffer ? (
                    <div className="mt-3 border-t border-white/10 pt-3 text-sm leading-6 text-slate-300">
                      <p className="font-medium text-white">{event.paymentOffer.summary}</p>
                      <p>{event.paymentOffer.conditions} 결제 전 적용 여부를 확인하세요.</p>
                      <a href={event.paymentOffer.sourceUrl} className="inline-flex min-h-8 items-center text-cyan-200 underline underline-offset-4">{event.paymentOffer.sourceLabel}</a>
                    </div>
                  ) : null}
                  {affiliate ? <p id={disclosure} className="mt-2 text-xs leading-5 text-slate-200">이 링크를 통해 구매하면 블루딜이 수수료를 받을 수 있습니다.</p> : null}
                  {event.path ? (
                    <Link href={event.path} prefetch={false} className="mt-2 inline-flex min-h-8 items-center text-sm text-cyan-200 underline underline-offset-4">행사 상세 보기</Link>
                  ) : (
                    <a href={affiliate ? `/go/${affiliate.code}` : event.officialUrl} rel={affiliate ? "sponsored" : undefined} aria-describedby={affiliate ? disclosure : undefined} className="mt-2 inline-flex min-h-8 items-center text-sm text-cyan-200 underline underline-offset-4">공식 행사 안내</a>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-3 rounded-2xl border border-white/15 p-4 text-sm text-slate-300">이 달에 등록된 행사 일정이 없습니다.</p>}
      </section>
    </div>
  );
}
