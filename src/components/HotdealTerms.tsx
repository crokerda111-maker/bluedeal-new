import { useEffect, useId, useState } from "react";
import { formatKoreanDate } from "../lib/postStorage";
import { hotdealPrice, isActiveHotdeal, isRecommendedHotdeal } from "../lib/hotdeal";
import type { Post } from "../lib/postTypes";
import PostContentLink from "./PostContentLink";

function AffiliateLinkInfo() {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative shrink-0"
      onPointerEnter={event => { if (event.pointerType === "mouse") setOpen(true); }}
      onPointerLeave={event => { if (event.pointerType === "mouse") setOpen(false); }}
    >
      <button
        type="button"
        aria-label="상품 링크 이용 안내"
        aria-controls={id}
        aria-expanded={open}
        onClick={event => {
          const pointerType = (event.nativeEvent as PointerEvent).pointerType;
          setOpen(previous => pointerType === "mouse" ? true : !previous);
        }}
        onKeyDown={event => {
          if (event.key === "Escape" && open) {
            setOpen(false);
            event.stopPropagation();
          }
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-cyan-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        <span aria-hidden="true" className="text-base">ⓘ</span>
      </button>
      <span
        id={id}
        hidden={!open}
        className="absolute left-0 top-full z-10 w-[min(15rem,65vw)] rounded-lg border border-white/20 bg-slate-950 p-2.5 text-xs font-normal leading-relaxed text-slate-100 shadow-lg"
      >
        이 글의 구매 링크를 이용하시면, 제휴사 조건에 따라 블루딜이 수수료를 받아요.
      </span>
    </span>
  );
}

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
  const href = typeof post.extra?.dealLink === "string" && /^\/go\/[\w-]{2,64}$/.test(post.extra.dealLink) ? post.extra.dealLink : "";
  const affiliate = href && post.linkInfo?.affiliateHrefs.includes(href);
  const store = typeof post.extra?.store === "string" ? post.extra.store : null;
  const active = isActiveHotdeal(deal, now);
  const evidence = isRecommendedHotdeal(deal, now) ? deal.priceEvidence : undefined;
  const evidenceLabel = evidence?.basis === "history" ? "최근 30일 가격 기록" : evidence?.basis === "market" ? "다른 판매처 공개 가격" : "기존 가격 기록·다른 판매처 공개 가격";
  const row = "grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-baseline gap-x-3 px-3 py-2.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:px-4";
  const label = "font-medium text-slate-300";

  return (
    <div className="mt-4 text-sm text-slate-200">
      <dl aria-label="핫딜 구매 정보" className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/5">
        {store ? <div className={row}><dt className={label}>판매처</dt><dd>{store}</dd></div> : null}
        {href ? (
          <div className={row}>
            <dt className={"flex items-center gap-0.5 " + label}>
              <span className="whitespace-nowrap">상품 링크</span>{affiliate ? <AffiliateLinkInfo /> : null}
            </dt>
            <dd className="break-keep"><PostContentLink href={href} info={post.linkInfo} showAffiliateBadge={false}>판매처에서 상품 보기</PostContentLink></dd>
          </div>
        ) : null}
        <div className={row}><dt className={label}>옵션</dt><dd className="[overflow-wrap:anywhere]">{deal.option}</dd></div>
        <div className={row}>
          <dt className={label}>{deal.sourceReview ? active ? "외부 소개가" : "이전 소개가" : active ? "확인 가격" : "이전 확인가"}</dt>
          <dd>
            <strong className="text-base text-cyan-100">{deal.price.toLocaleString("ko-KR")}원</strong>
            {!active ? <span className="ml-2 text-xs text-slate-300">가격 재확인 필요</span> : null}
          </dd>
        </div>
        <div className={row}>
          <dt className={label}>배송비</dt>
          <dd>{deal.shipping ? deal.shipping.toLocaleString("ko-KR") + "원" : "무료"}</dd>
        </div>
        {deal.shipping ? <div className={row}><dt className={label}>배송비 포함</dt><dd>{hotdealPrice(post)}</dd></div> : null}
        <div className={row}><dt className={label}>구매 조건</dt><dd className="[overflow-wrap:anywhere]">{deal.conditions}</dd></div>
        {evidence ? <div className={row}><dt className={label}>가격 근거</dt><dd>배송비 포함 비교 최저가 {evidence.low.toLocaleString("ko-KR")}원 · {evidenceLabel} {evidence.count}건</dd></div> : null}
      </dl>
      <p className="mt-2 text-xs text-slate-300">정보 확인 {formatKoreanDate(deal.checkedAt)} · 결제 화면에서 최종 가격과 재고를 확인하세요.</p>
      {evidence && deal.lowestIn30Days ? <p className="mt-2 text-xs text-slate-300">쿠팡 동일 옵션 · 최근 30일간 비교한 {deal.lowestIn30Days.observations}개 가격 중 최저</p> : null}
      {deal.coupangTrackedLow ? <p className="mt-2 text-xs text-slate-300">
        <PostContentLink href={deal.coupangTrackedLow.url} info={post.linkInfo}>로우차트 가격 이력</PostContentLink>
        {" · "}{formatKoreanDate(deal.coupangTrackedLow.checkedAt)}에 동일 옵션의 관측 최저 상품가를 확인했습니다. 배송비는 위의 판매처 확인 기준입니다.
      </p> : null}
    </div>
  );
}
