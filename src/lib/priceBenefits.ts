import type { PriceItem } from "./mockPrices";

type PeriodState = "observed" | "expired" | "upcoming";

/** Promotion dates use Korea time. An undated quote is an observation, never a promise. */
function period(startsOn: string | undefined, endsOn: string | undefined, endsAt: string | undefined, now: number): PeriodState {
  if (endsAt && now >= Date.parse(endsAt)) return "expired";
  if (!endsAt && endsOn && now >= Date.parse(`${endsOn}T00:00:00+09:00`) + 86_400_000) return "expired";
  if (startsOn && now < Date.parse(`${startsOn}T00:00:00+09:00`)) return "upcoming";
  return "observed";
}

export function priceBenefits(item: PriceItem, now: number) {
  return (["instant", "coupon", "card"] as const).flatMap(kind => {
    const amount = item[`${kind}Price`]; const note = item[`${kind}Note`];
    if (typeof amount !== "number" || !note) return [];
    let state = period(item[`${kind}StartsOn`], item[`${kind}EndsOn`], item[`${kind}EndsAt`], now);
    if (kind === "card" && item.cardRequiresCoupon) {
      const couponState = period(item.couponStartsOn, item.couponEndsOn, item.couponEndsAt, now);
      if (couponState !== "observed") state = couponState;
    }
    const starts = [item[`${kind}StartsOn`]];
    const ends = [{ on: item[`${kind}EndsOn`], at: item[`${kind}EndsAt`] }];
    if (kind === "card" && item.cardRequiresCoupon) {
      starts.push(item.couponStartsOn); ends.push({ on: item.couponEndsOn, at: item.couponEndsAt });
    }
    const startsOn = starts.filter((date): date is string => Boolean(date)).sort().at(-1);
    const end = ends.filter(date => date.on || date.at).sort((a, b) =>
      Date.parse(a.at ?? `${a.on}T00:00:00+09:00`) + (a.at ? 0 : 86_400_000) -
      Date.parse(b.at ?? `${b.on}T00:00:00+09:00`) - (b.at ? 0 : 86_400_000))[0];
    return [{ kind, amount, note, state, startsOn, endsOn: end?.on, endsAt: end?.at }];
  });
}
