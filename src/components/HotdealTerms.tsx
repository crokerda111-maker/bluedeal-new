import { useEffect, useState } from "react";
import { formatKoreanDate } from "../lib/postStorage";
import { hotdealPrice, isActiveHotdeal } from "../lib/hotdeal";
import type { Post } from "../lib/postTypes";
import PostContentLink from "./PostContentLink";

export default function HotdealTerms({ post }: { post: Post }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const clock = () => setNow(Date.now());
    const timer = window.setInterval(clock, 30_000);
    const initial = window.setTimeout(clock, 0);
    return () => { window.clearInterval(timer); window.clearTimeout(initial); };
  }, []);
  const deal = post.hotdeal;
  if (!deal) return null;
  const href = typeof post.extra?.dealLink === "string" ? post.extra.dealLink : "";
  const active = isActiveHotdeal(deal, now);

  return (
    <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-white/80">
      <p className="font-semibold text-white">{deal.option}</p>
      <p className="mt-2">
        <strong className="text-xl text-cyan-100">{hotdealPrice(post)}</strong>
        {" · "}{active ? "배송비 포함 확인가" : "이전 확인가 · 가격 재확인 필요"}
      </p>
      <p className="mt-1">상품가 {deal.price.toLocaleString("ko-KR")}원 · 배송비 {deal.shipping.toLocaleString("ko-KR")}원</p>
      <p className="mt-2">{deal.conditions}</p>
      <p className="mt-2 text-xs text-white/70">판매처 확인 {formatKoreanDate(deal.checkedAt)} · 결제 화면에서 최종 가격을 확인하세요.</p>
      {deal.lowestIn30Days ? <p className="mt-2 text-xs text-white/70">쿠팡 동일 옵션 · 최근 30일간 비교한 {deal.lowestIn30Days.observations}개 가격 중 최저</p> : null}
      {href && post.linkInfo?.affiliateHrefs.includes(href) ? (
        <div className="mt-3"><PostContentLink href={href} info={post.linkInfo}>제휴 링크로 판매처 보기</PostContentLink></div>
      ) : null}
    </div>
  );
}
