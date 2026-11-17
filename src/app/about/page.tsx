import Link from "next/link";
import { pageMetadata } from "../../lib/site";
import { getMeta } from "../../lib/prices";
import { getRegisteredOutboundLink } from "../../lib/affiliate";
import affiliateProducts from "../../content/affiliate-products.json";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata("블루딜 소개·가격 안내 | BLUEDEAL", "블루딜의 가격 확인 방식, 정보 출처와 제휴 링크 운영 원칙을 안내합니다.", "/about");

export default async function AboutPage() {
  const meta = await getMeta();
  const coupang = getRegisteredOutboundLink("coupang-shop");
  const aliexpress = getRegisteredOutboundLink("aliexpress-offer");
  const aliProduct = aliexpress && affiliateProducts.find(product => product.originalUrl === aliexpress.originalUrl);
  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">블루딜 소개</h1>
        <p className="mt-3 leading-relaxed text-white/75">블루딜은 PC 부품 가격과 배송 조건, IT 소식, 하드웨어 커뮤니티와 핫딜을 한곳에서 정리합니다. 구매를 결정하기 전에 제품과 조건을 확인할 수 있도록 정보를 제공합니다.</p>
      </section>
      <section id="prices" className="bd-surface-md p-6">
        <h2 className="text-xl font-semibold">가격을 읽는 방법</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-white/75">
          <li>가격표에는 선택한 판매 상품의 확인 시점 가격을 표시합니다. 전체 시장의 최저가를 보장하지 않습니다.</li>
          <li>상품가와 기본 배송비를 구분하고, 배송비 포함 금액과 지역 추가비·할인 조건을 함께 안내합니다. 쿠폰·카드·회원 조건이 있는 가격을 일반 판매가로 취급하지 않습니다.</li>
          <li>실제 확인 시각은 한국 표준시(KST)로 표시합니다. 확인 후 24시간이 지나면 재확인 안내를 표시하며, 구매 시점의 가격·재고·배송 조건은 판매처에서 다시 확인해야 합니다.</li>
          <li>24시간 변동과 7일·30일 관측 최저는 블루딜에 쌓인 상품가 기록 기준입니다. 비교 기록이나 필요한 기록 기간이 없으면 ‘기록 대기’로 표시합니다. 관측 사이의 변동은 반영되지 않을 수 있습니다.</li>
          <li>현재 갱신 방식: <b className="text-white">{meta.schedule}</b>. 파일 생성 시각과 실제 가격 확인 시각을 구분합니다.</li>
        </ul>
        <Link className="mt-5 inline-block text-sm text-cyan-200 hover:underline" href="/prices">가격현황 보기 →</Link>
      </section>
      <section className="bd-surface-md p-6">
        <h2 className="text-xl font-semibold">정보와 제휴 링크</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/75">
          <p>제품 사양은 제조사 공식 자료를 우선 확인하고, 판매 가격과 배송 조건은 해당 판매처에서 확인합니다. 가격표의 ‘공식 사양’과 ‘판매처 보기’에서 출처를 확인할 수 있습니다.</p>
          <p>일부 링크는 제휴 링크일 수 있으며, 링크를 통해 구매가 이루어지면 블루딜이 일정 수수료를 받을 수 있습니다. 제휴 여부가 제품의 사실 정보와 평가 기준을 바꾸지 않도록 운영합니다.</p>
          <p>직접 사용하지 않은 제품을 사용해 본 것처럼 소개하지 않습니다. 확인되지 않은 사양이나 조건은 추정하지 않고 미확인으로 표시합니다.</p>
          <p>잘못된 정보·오래된 가격·상품 추가 요청은 <Link className="text-cyan-200 hover:underline" href="/contact/write">문의 게시판</Link>으로 알려주세요.</p>
        </div>
      </section>
      {coupang || aliexpress ? (
        <section id="affiliate" className="bd-surface-md p-6" aria-labelledby="affiliate-title">
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
