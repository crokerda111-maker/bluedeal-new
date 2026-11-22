import type { PriceItem } from "../lib/mockPrices";
import SmartLink from "./SmartLink";
import { priceFreshness } from "../lib/priceFilters";
import { priceBenefits } from "../lib/priceBenefits";

export function formatPriceTime(ts?: string) {
  if (!ts) return "확인 전";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "확인 전";
  return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) + " KST";
}

export function fmtWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value) + "원";
}

export function PriceAmount({ item, now }: { item: PriceItem; now: number }) {
  const shippingFee = item.shippingFee;
  const freshness = priceFreshness(item, now);
  return (
    <div>
      {item.condition === "refurbished" ? <div className="mb-2 text-xs font-semibold text-amber-200">리퍼·벌크 · 보증기간 별도 확인</div> : null}
      {item.availability === "out-of-stock" ? <div className="mb-2 text-xs font-semibold text-amber-200">품절 상품의 이전 가격 기록</div> : null}
      <div className="text-lg font-semibold text-white">{fmtWon(item.price)}</div>
      {item.instantPrice || item.couponPrice || item.cardPrice ? <div className="text-xs text-white/65">{item.instantPrice ? "조건부 할인 적용 전 상품가" : "쿠폰·카드 적용 전 상품가"}</div> : null}
      <div className="mt-1 text-xs text-white/70">
        {typeof shippingFee === "number" ? (shippingFee === 0 ? "기본 배송비 무료" : `기본 배송비 ${fmtWon(shippingFee)}`) : "배송비 판매처 확인"}
      </div>
      {typeof shippingFee === "number" ? <div className="mt-1 text-xs text-cyan-200">배송비 포함 {fmtWon(item.price + shippingFee)}</div> : null}
      {item.shippingNote ? <div className="mt-1 text-xs text-white/60">{item.shippingNote}</div> : null}
      {item.priceNote ? <div className="mt-2 max-w-xs text-xs leading-relaxed text-white/70">{item.priceNote}</div> : null}
      {priceBenefits(item, now).map(benefit => <details key={benefit.kind} className="mt-3 max-w-xs rounded-lg border border-cyan-200/20 p-2 text-xs leading-6">
        <summary className="cursor-pointer text-cyan-100">{benefit.state === "expired" ? "종료된 혜택 기록 · " : benefit.state === "upcoming" ? "시작 전 혜택 기록 · " : "조건부 "}{benefit.kind === "instant" ? "즉시할인가" : benefit.kind === "coupon" ? "쿠폰가" : item.cardRequiresCoupon ? "쿠폰+카드가" : "카드가"} {fmtWon(benefit.amount)} · 조건 보기</summary>
        <p className="mt-2 text-white/80">{benefit.note}</p>
        <p className="mt-2 text-white/65">{benefit.startsOn ? `${benefit.startsOn}부터 · ` : ""}{benefit.endsAt ? `${formatPriceTime(benefit.endsAt)} 종료` : benefit.endsOn ? `${benefit.endsOn}까지 (KST)` : "종료일 미확인 · 판매처 재확인"}</p>
        {benefit.kind === "card" && item.cardRequiresCoupon ? <p className="text-amber-100">쿠폰 발급·유효기간도 함께 충족해야 합니다.</p> : null}
        <p className="text-white/65">배송비 별도 · 확인 시점 표시가 · 개인별 적용은 결제 전 확인</p>
      </details>)}
      <div className="mt-2 text-xs text-white/60">확인 {formatPriceTime(item.checkedAt || item.updatedAt)}</div>
      {freshness === "stale" ? <div className="mt-2 text-xs text-amber-200">확인 후 24시간 경과 · 판매처 가격 재확인</div> : null}
      {freshness === "unknown" ? <div className="mt-2 text-xs text-amber-200">가격 확인 시각 미확인</div> : null}
      <div className="mt-1 text-xs text-white/60">{item.availability === "out-of-stock" ? `${item.availabilityCheckedAt ? `품절 확인 ${formatPriceTime(item.availabilityCheckedAt)}` : "품절 확인일 미기록"} · 재입고 여부 판매처 확인` : item.availability === "in-stock" ? "확인 시점 판매 중 · 현재 재고는 판매처 확인" : "재고는 판매처에서 확인해 주세요"}</div>
    </div>
  );
}

export function PurchaseLink({ item, affiliate }: { item: PriceItem; affiliate: boolean }) {
  if (!item.goCode) return <span className="text-xs text-white/60">판매처 링크 준비 중</span>;
  return (
    <div className="space-y-1"><SmartLink
      className="inline-flex min-h-11 items-center whitespace-nowrap rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      href={`/go/${item.goCode}`}
      rel={affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer"}
      title={`${item.name} 판매처 보기 (새 창)`}
    >
      판매처 보기 ↗
    </SmartLink><div className="text-xs text-white/65">{affiliate ? "제휴 링크" : "일반 링크"}</div></div>
  );
}
