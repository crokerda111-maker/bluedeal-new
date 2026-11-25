import Link from "next/link";
import { GMARKET_BLACK_FRIDAY as event } from "../../lib/gmarketBlackFriday";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata(
  "이달의 행사 캘린더 | PC 부품·완본체 할인 일정 · 블루딜",
  "국내 쇼핑몰의 행사 일정을 한국시간으로 확인하세요. G마켓 블랙프라이데이 공식 기간과 상품별 핫딜·구매 조건을 확인할 수 있습니다.",
  "/events",
);

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const koreanDay = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

async function loadCalendar(searchParams: Promise<{ month?: string | string[] }>) {
  const { month } = await searchParams;
  const now = new Date();
  const today = koreanDay.format(now);
  const selected = typeof month === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) ? month : today.slice(0, 7);
  const [year, monthNumber] = selected.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthAt = (offset: number) => new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
  return { now: now.getTime(), today, selected, year, monthNumber, firstWeekday, dayCount, previous: monthAt(-1), next: monthAt(1) };
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const calendar = await loadCalendar(searchParams);
  const hasEvent = calendar.selected === event.month;
  const status = calendar.now >= event.endsAt ? "종료" : calendar.now < event.startsAt ? "예정" : "진행";
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
                  const scheduled = hasEvent && (event.days as readonly number[]).includes(day);
                  return (
                    <td key={weekday} className={`border border-white/10 ${scheduled ? "bg-amber-200/10" : ""}`}>
                      {scheduled ? (
                        <Link href={event.path} aria-label={`${calendar.monthNumber}월 ${day}일 G마켓 블랙프라이데이`} className="flex min-h-12 flex-col items-center justify-center px-0.5 py-1 text-amber-100 hover:bg-amber-200/15 sm:min-h-16">
                          <time dateTime={date} className="font-bold">{day}</time><span className="text-[10px] sm:text-xs">G마켓</span>
                        </Link>
                      ) : <time dateTime={date} aria-current={date === calendar.today ? "date" : undefined} className={`flex min-h-12 items-center justify-center text-sm sm:min-h-16 ${date === calendar.today ? "font-bold text-cyan-200" : "text-slate-300"}`}>{day}</time>}
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
        {hasEvent ? (
          <Link href={event.path} prefetch={false} className="mt-3 block rounded-2xl border border-amber-400/25 bg-amber-200/5 p-4 hover:bg-amber-200/10 sm:p-6">
            <span className="block text-xs font-semibold text-amber-200">{event.dates} · {status}</span>
            <span className="mt-1 block font-semibold text-white">{event.title} →</span>
            <span className="mt-2 block text-sm text-slate-300">공식 행사관과 확인한 G마켓 핫딜</span>
          </Link>
        ) : <p className="mt-3 rounded-2xl border border-white/15 p-4 text-sm text-slate-300">이 달에 등록된 행사 일정이 없습니다.</p>}
      </section>
    </div>
  );
}
