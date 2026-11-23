import Link from "next/link";
import { pageMetadata } from "../../lib/site";
import { getMeta } from "../../lib/prices";
import { getRegisteredOutboundLink } from "../../lib/affiliate";
import { getStoredAffiliateCodes } from "../../lib/affiliateStore";
import affiliateProducts from "../../content/affiliate-products.json";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("블루딜 소개·가격 안내 | BLUEDEAL", "블루딜의 가격 확인 방식, 정보 출처와 제휴 링크 운영 원칙을 안내합니다.", "/about");

export default async function AboutPage() {
  const [meta, stored] = await Promise.all([getMeta(), getStoredAffiliateCodes(["coupang-shop", "aliexpress-offer"])]);
  const coupang = stored.get("coupang-shop") ?? getRegisteredOutboundLink("coupang-shop");
  const aliexpress = stored.get("aliexpress-offer") ?? getRegisteredOutboundLink("aliexpress-offer");
  const aliProduct = aliexpress && affiliateProducts.find(product => product.originalUrl === aliexpress.originalUrl);
  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">블루딜 소개</h1>
        <p className="mt-3 leading-relaxed text-white/75">블루딜은 완본체를 고를 때 CPU와 그래픽카드의 급, 기본 부품의 실제 모델과 배송비를 한눈에 비교할 수 있게 정리합니다. 반본체와 개별 부품 가격, IT 소식도 함께 제공합니다.</p>
        <Link prefetch={false} className="mt-3 inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4" href="/prices/fullpc#fullpc-picks">오늘의 완본체 베스트 보기</Link>
      </section>
      <section id="operation" className="bd-surface-md scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold">운영·문의 안내</h2>
        <div className="mt-3 space-y-3 text-sm leading-7 text-white/80">
          <p>완본체를 검토할 때 CPU·GPU와 메모리 용량을 먼저 맞춰 봅니다. 메인보드·파워·쿨러 등은 확인한 정확한 모델과 부품 점수의 근거를 함께 공개합니다. 같은 부품의 개별 구매 비용과 조립·Windows·보증 조건을 대조할 수 있을 때 실제 절약률을 안내합니다.</p>
          <p>상품 주문·결제·배송·교환은 구매하신 판매처의 안내를 따라주세요. 블루딜에 표시된 구성이나 가격의 정정 요청은 판매처 주소와 선택 옵션을 함께 보내주시면 확인하는 데 도움이 됩니다.</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 text-sm text-cyan-200">
          <Link prefetch={false} className="inline-flex min-h-11 items-center underline" href="/contact/write?vis=private">운영팀에 비공개 문의</Link>
          <Link prefetch={false} className="inline-flex min-h-11 items-center underline" href="/privacy">개인정보처리방침</Link>
        </div>
      </section>
      <section id="prices" className="bd-surface-md p-6">
        <h2 className="text-xl font-semibold">가격을 읽는 방법</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-white/75">
          <li>가격표에는 선택한 판매 상품의 확인 시점 가격을 표시합니다. 전체 시장의 최저가를 보장하지 않습니다.</li>
          <li>상품가와 기본 배송비를 구분하고, 배송비 포함 금액과 지역 추가비·할인 조건을 함께 안내합니다. 쿠폰·카드·회원 조건이 있는 가격을 일반 판매가로 취급하지 않습니다.</li>
          <li>실제 확인 시각은 한국 표준시(KST)로 표시합니다. 확인 후 24시간이 지나면 재확인 안내를 표시하며, 구매 시점의 가격·재고·배송 조건은 판매처에서 다시 확인해야 합니다.</li>
          <li>24시간 변동과 7일·30일 관측 최저는 블루딜에 쌓인 상품가 기록 기준입니다. 비교 기록이나 필요한 기록 기간이 없으면 ‘기록 대기’로 표시합니다. 관측 사이의 변동은 반영되지 않을 수 있습니다.</li>
          <li>가격표 갱신은 <b className="text-white">{meta.schedule}</b> 기준입니다. 각각의 판매가에는 해당 판매 페이지를 실제로 확인한 시각을 표시합니다.</li>
        </ul>
        <Link className="mt-5 inline-block text-sm text-cyan-200 hover:underline" href="/prices">가격현황 보기 →</Link>
      </section>
      <section id="affiliate" className="bd-surface-md scroll-mt-24 p-6">
        <h2 className="text-xl font-semibold">정보와 제휴 링크</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/75">
          <p>제품 사양은 제조사 공식 자료를 우선 확인하고, 판매 가격과 배송 조건은 해당 판매처에서 확인합니다. 가격표의 ‘공식 사양’과 ‘판매처 보기’에서 출처를 확인할 수 있습니다.</p>
          <p>일부 구매 링크를 통해 구매하면 블루딜이 수수료를 받을 수 있습니다. 메인에서는 제휴 연결이 확인된 판매처를 대상으로 추천하고, 가격과 구성 평가에는 동일한 기준을 적용합니다.</p>
          <p>직접 사용하지 않은 제품을 사용해 본 것처럼 소개하지 않습니다. 확인되지 않은 사양이나 조건은 추정하지 않고 미확인으로 표시합니다.</p>
          <p>잘못된 정보·오래된 가격·상품 추가 요청은 <Link className="text-cyan-200 hover:underline" href="/contact/write">문의 게시판</Link>으로 알려주세요.</p>
        </div>
      </section>
      {coupang || aliexpress ? (
        <section className="bd-surface-md p-6" aria-labelledby="affiliate-title">
          <h2 id="affiliate-title" className="text-xl font-semibold">제휴 판매처 안내</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">이 글에는 제휴 링크가 포함되어 있습니다. 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {coupang ? <div className="rounded-xl border border-white/15 bg-[#060B1A]/40 p-4">
              <h3 className="font-semibold">쿠팡</h3>
              <p className="mt-2 text-sm leading-6 text-white/75">쿠팡 메인 페이지에서 원하는 상품을 직접 검색할 수 있습니다.</p>
              <p role="note" className="mt-3 text-sm font-medium leading-6 text-cyan-100">이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
              <a href="/go/coupang-shop" target="_blank" rel="sponsored noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">쿠팡으로 이동 ↗<span className="sr-only"> (새 창)</span></a>
            </div> : null}
            {aliexpress ? <div className="rounded-xl border border-white/15 bg-[#060B1A]/40 p-4">
              <h3 className="font-semibold">알리익스프레스</h3>
              {aliProduct ? <div className="mt-3 space-y-2">
                <h4 className="font-semibold leading-6">{aliProduct.name}</h4>
                <p className="text-sm leading-6 text-white/85">선택 옵션: {aliProduct.option}</p>
                <p className="text-xs leading-5 text-white/65">상품 정보 확인: {aliProduct.checkedAt}</p>
              </div> : <p className="mt-2 text-sm leading-6 text-white/75">블루딜에 등록된 알리익스프레스 제휴 페이지로 이동합니다.</p>}
              <p className="mt-2 text-sm leading-6 text-white/75">상품·옵션·배송 조건과 최종 결제 금액은 이동한 화면에서 확인해 주세요.</p>
              <p role="note" className="mt-3 text-sm leading-6 text-white/75">제휴 링크를 통한 구매로 블루딜이 수수료를 받을 수 있습니다.</p>
              <a href="/go/aliexpress-offer" target="_blank" rel="sponsored noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 hover:bg-cyan-300/20">{aliProduct ? "알리 상품 보러가기" : "알리 제휴 페이지로 이동"} ↗<span className="sr-only"> (새 창)</span></a>
            </div> : null}
          </div>
          <p className="mt-4 text-xs leading-5 text-white/65">판매 가격과 재고는 변동될 수 있습니다. 구매 전에 판매자·상품 옵션·배송비·최종 결제 금액을 확인해 주세요.</p>
        </section>
      ) : null}
    </div>
  );
}
