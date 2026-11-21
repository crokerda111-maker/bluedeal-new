import type { PriceItem } from "./mockPrices";

type PeriodState = "observed" | "expired" | "upcoming";

/** Promotion dates use Korea time. An undated quote is an observation, never a promise. */
function period(startsOn: string | undefined, endsOn: string | undefined, now: number): PeriodState {
  if (endsOn && now >= Date.parse(`${endsOn}T00:00:00+09:00`) + 86_400_000) return "expired";
  if (startsOn && now < Date.parse(`${startsOn}T00:00:00+09:00`)) return "upcoming";
  return "observed";
}

export function priceBenefits(item: PriceItem, now: number) {
  return (["coupon", "card"] as const).flatMap(kind => {
    const amount = item[`${kind}Price`]; const note = item[`${kind}Note`];
    if (typeof amount !== "number" || !note) return [];
    let state = period(item[`${kind}StartsOn`], item[`${kind}EndsOn`], now);
    if (kind === "card" && item.cardRequiresCoupon) {
      const couponState = period(item.couponStartsOn, item.couponEndsOn, now);
      if (couponState !== "observed") state = couponState;
    }
    const starts = [item[`${kind}StartsOn`]];
    const ends = [item[`${kind}EndsOn`]];
    if (kind === "card" && item.cardRequiresCoupon) {
      starts.push(item.couponStartsOn); ends.push(item.couponEndsOn);
    }
    const startsOn = starts.filter((date): date is string => Boolean(date)).sort().at(-1);
    const endsOn = ends.filter((date): date is string => Boolean(date)).sort().at(0);
    return [{ kind, amount, note, state, startsOn, endsOn }];
  });
}
