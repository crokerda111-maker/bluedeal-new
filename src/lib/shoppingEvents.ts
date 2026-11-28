import { GMARKET_BLACK_FRIDAY } from "./gmarketBlackFriday";

const ALIEXPRESS_BLACK_FRIDAY_ANNOUNCEMENT = "https://www.prnewswire.com/kr/news-releases/uC54CuB9ACuC775uC2A4uD504uB808uC2A4u002Cu002DuAD11uAD70uC81Cu002DuC5F4uAE30u002DuC787uB294u002Du0027uBE14uB799uD504uB77CuC774uB370uC774u0027-302944740.html";

const KB_ALIEXPRESS_PAYMENT_CONDITIONS = "개인 신용·체크카드 기존 보유 고객 대상. 기업·BC카드, K-VENUE와 간편결제는 제외됩니다. USD로 직접 결제해야 하며 배송비·세금 등을 뺀 상품금액을 기준으로 합니다. 기간 중 알리 ID당 1회 적용되며 다른 프로모션 코드와 중복되지 않습니다. 예산 소진 시 일찍 종료될 수 있습니다.";

const ALIEXPRESS_BLACK_FRIDAY_PAYMENT_OFFERS = [
  {
    summary: "대상 롯데 Visa · 100달러 이상 결제 시 30달러 즉시할인",
    conditions: "공식 안내의 카드번호 앞 6자리에 해당하는 개인 신용카드로 해외배송 상품을 USD로 직접 결제해야 합니다. 알리 ID당 기간 내 1회 선착순. K-VENUE와 간편결제는 제외되며 다른 쿠폰·할인과 중복되지 않습니다.",
    sourceLabel: "롯데 Visa 공식 조건",
    sourceUrl: "https://www.lottecard.co.kr/app/LPBNFDA_V300.lc?bigTabGubun=2&evnBultSeq=11379&evnCtgSeq=9999",
  },
  {
    summary: "롯데 Mastercard · 100달러 이상 결제 시 15달러 즉시할인",
    conditions: "롯데 Mastercard 개인 신용카드로 해외배송 상품을 USD로 직접 결제해야 합니다. 알리 ID당 기간 내 1회 선착순. K-VENUE와 간편결제는 제외되며 다른 쿠폰·할인과 중복되지 않습니다.",
    sourceLabel: "롯데 Mastercard 공식 조건",
    sourceUrl: "https://www.lottecard.co.kr/app/LPBNFDA_V300.lc?bigTabGubun=2&evnBultSeq=11377&evnCtgSeq=9999",
  },
  {
    summary: "KB국민 Visa · 150달러 이상 결제 시 22달러 즉시할인",
    conditions: KB_ALIEXPRESS_PAYMENT_CONDITIONS,
    sourceLabel: "KB국민 Visa 공식 조건",
    sourceUrl: "https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001?eventNum=1002171&mainCC=a",
  },
  {
    summary: "KB국민 UnionPay · 100달러 이상 결제 시 16달러 즉시할인",
    conditions: KB_ALIEXPRESS_PAYMENT_CONDITIONS,
    sourceLabel: "KB국민 UnionPay 공식 조건",
    sourceUrl: "https://card.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001?eventNum=1002433&mainCC=a",
  },
  {
    summary: "KB국민 Mastercard · 100달러 이상 결제 시 15달러 즉시할인",
    conditions: `${KB_ALIEXPRESS_PAYMENT_CONDITIONS} Maestro 카드도 제외됩니다.`,
    sourceLabel: "KB국민 Mastercard 공식 조건",
    sourceUrl: "https://mapps.kbcard.com/BON/DVIEW/HBBMCXCRVNEC0001?eventNum=1002354&mainCC=a",
  },
] as const;

const ALIEXPRESS_BLACK_FRIDAY_PAYMENT = {
  period: "11월 19일~12월 3일",
  checkedOn: "2026. 11. 28.",
  offers: ALIEXPRESS_BLACK_FRIDAY_PAYMENT_OFFERS,
};

export type ShoppingEvent = {
  id: string;
  store: string;
  title: string;
  description: string;
  officialUrl: string;
  startsOn: string;
  endsOn: string;
  path?: string;
  announceOn?: string;
  payment?: {
    period: string;
    checkedOn: string;
    offers: readonly { summary: string; conditions: string; sourceLabel: string; sourceUrl: string }[];
  };
};

export const SHOPPING_EVENTS: readonly ShoppingEvent[] = [
  {
    id: "gmarket-black-friday",
    store: "G마켓",
    title: GMARKET_BLACK_FRIDAY.title,
    description: "PC 부품·완본체·주변기기·식품 핫딜과 할인 조건을 확인하세요.",
    officialUrl: GMARKET_BLACK_FRIDAY.officialUrl,
    startsOn: "2026-11-26",
    endsOn: "2026-11-30",
    announceOn: "2026-11-25",
    path: GMARKET_BLACK_FRIDAY.path,
  },
  {
    id: "auction-black-friday",
    store: "옥션",
    title: "옥션 11월 블랙프라이데이",
    description: "디지털·가전과 해외직구 기획전. 상품별 중복쿠폰과 카드 조건은 행사관에서 확인하세요.",
    officialUrl: "https://m.auction.co.kr/n/showroom/160",
    startsOn: "2026-11-26",
    endsOn: "2026-11-30",
  },
  {
    id: "coupang-digital-black-friday",
    store: "쿠팡",
    title: "쿠팡 가전·디지털 블랙프라이데이",
    description: "가전·디지털 기획전. 라이브 방송과 추가 할인은 일정과 상품에 따라 달라집니다.",
    officialUrl: "https://news.coupang.com/archives/68557/",
    startsOn: "2026-11-16",
    endsOn: "2026-11-29",
  },
  {
    id: "coupang-rocket-black-friday",
    store: "쿠팡 직구",
    title: "쿠팡 로켓직구 블랙프라이데이",
    description: "해외직구 가전·주변기기·식품 등. 배송비와 구매 조건은 상품별로 확인하세요.",
    officialUrl: "https://news.coupang.com/archives/68921/",
    startsOn: "2026-11-23",
    endsOn: "2026-12-01",
  },
  {
    id: "ssg-weekly-flyer",
    store: "SSG",
    title: "SSG 이번 주 전단행사",
    description: "신선식품, 간편식과 생활용품 행사. 할인 대상과 배송 조건은 상품별로 확인하세요.",
    officialUrl: "https://www.ssg.com/plan/planShop.ssg?dispCmptId=6000125592",
    startsOn: "2026-11-26",
    endsOn: "2026-12-02",
  },
  {
    id: "ssg-cj-festa",
    store: "SSG CJ",
    title: "SSG CJ 브랜드 FESTA",
    description: "대상 상품 3만 원 이상 구매 시 7천 원 장바구니 쿠폰. 행사 중 ID당 1회 다운로드할 수 있습니다.",
    officialUrl: "https://event.ssg.com/eventDetail.ssg?nevntId=1000000024730&domainSiteNo=6005",
    startsOn: "2026-11-19",
    endsOn: "2026-12-02",
  },
  {
    id: "ohou-kitchen-black-friday",
    store: "오늘의집",
    title: "오늘의집 집요한세일 블랙프라이데이 주방편",
    description: "조리도구·주방 수납 기획전. 선착순 쿠폰은 소진될 수 있습니다.",
    officialUrl: "https://events.ohou.se/promotion-pages/100525",
    startsOn: "2026-11-16",
    endsOn: "2026-11-30",
  },
  {
    id: "aliexpress-black-friday-bestsellers",
    store: "알리",
    title: "알리익스프레스 블랙프라이데이 베스트셀러",
    description: "연말 인기 상품 기획전. 쿠폰과 결제 할인은 상품 및 결제수단별 적용 조건을 확인하세요.",
    officialUrl: ALIEXPRESS_BLACK_FRIDAY_ANNOUNCEMENT,
    payment: ALIEXPRESS_BLACK_FRIDAY_PAYMENT,
    startsOn: "2026-11-27",
    endsOn: "2026-11-30",
  },
  {
    id: "aliexpress-choice-december",
    store: "알리",
    title: "알리익스프레스 12월 초이스데이",
    description: "블랙프라이데이의 마지막 해외직구 특가전입니다. 할인 적용 여부는 선택한 상품의 결제 화면에서 확인하세요.",
    officialUrl: ALIEXPRESS_BLACK_FRIDAY_ANNOUNCEMENT,
    payment: ALIEXPRESS_BLACK_FRIDAY_PAYMENT,
    startsOn: "2026-12-01",
    endsOn: "2026-12-03",
    announceOn: "2026-11-19",
  },
  {
    id: "11st-black-friday",
    store: "11번가",
    title: "11번가 해외직구·명품 블랙프라이데이",
    description: "해외직구·명품 기획전. 발급이 끝난 명품 쿠폰과 결제수단별 할인 가능 여부를 행사관에서 구분해 확인하세요.",
    officialUrl: "https://plan.11st.co.kr/plan/front/exhibitions/2243991/detail",
    startsOn: "2026-11-24",
    endsOn: "2026-11-30",
  },
  {
    id: "11st-grand-november",
    store: "11번가",
    title: "11번가 11월 그랜드십일절",
    description: "타임딜과 장바구니 쿠폰을 운영한 11월 행사입니다.",
    officialUrl: "https://plan.11st.co.kr/plan/mobile/exhibitions/2242545/detail",
    startsOn: "2026-11-01",
    endsOn: "2026-11-11",
  },
];

export function shoppingEventStatus(event: ShoppingEvent, today: string) {
  return today > event.endsOn ? "종료" : today < event.startsOn ? "예정" : "진행";
}

export function shoppingEventDates({ startsOn, endsOn }: ShoppingEvent) {
  const dateLabel = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
  if (startsOn === endsOn) return dateLabel(startsOn);
  return `${dateLabel(startsOn)}~${startsOn.slice(0, 7) === endsOn.slice(0, 7) ? `${Number(endsOn.slice(8))}일` : dateLabel(endsOn)}`;
}
