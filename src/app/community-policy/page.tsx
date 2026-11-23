import Link from "next/link";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata(
  "커뮤니티 운영정책 | 블루딜",
  "블루딜 게시판의 광고·도배 금지 기준과 핫딜 작성, 운영 조치, 신고 방법을 안내합니다.",
  "/community-policy",
);

const sectionClass = "space-y-3 border-t border-white/10 pt-5";
const headingClass = "text-lg font-semibold text-white";
const linkClass = "inline-flex min-h-11 items-center text-cyan-200 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-cyan-300";

export default function CommunityPolicyPage() {
  return (
    <article className="bd-surface-md mx-auto max-w-3xl space-y-6 p-5 text-sm leading-7 text-white/85 sm:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">커뮤니티 운영정책</h1>
        <p className="mt-2">블루딜의 게시글, 핫딜, 사용기, 한 줄 이슈에 적용합니다.</p>
        <p className="mt-1 text-xs text-white/70"><time dateTime="2026-11-23">2026년 11월 23일</time> 시행</p>
      </header>

      <section aria-labelledby="advertising-title" className={sectionClass}>
        <h2 id="advertising-title" className={headingClass}>광고·홍보와 도배 금지</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>판매자나 관계자가 상품·매장·서비스를 홍보하거나 구매를 유도하는 글을 금지합니다. 업체가 의뢰한 후기나 대가를 받고 올린 홍보 글도 포함합니다.</li>
          <li>개인의 제휴 링크, 추천인 코드, 가입 리워드 링크, 공동구매 모집, 외부 채널 홍보를 금지합니다.</li>
          <li>같은 내용이나 링크를 반복해서 올리거나 여러 게시판에 도배하는 행위, 여러 계정으로 추천이나 후기를 조작하는 행위를 금지합니다.</li>
        </ul>
      </section>

      <section aria-labelledby="deals-title" className={sectionClass}>
        <h2 id="deals-title" className={headingClass}>핫딜·사용기 작성 기준</h2>
        <p>직접 찾은 핫딜, 사용 경험, 제품 비교와 질문을 올릴 수 있습니다. 핫딜에는 판매처의 상품 주소와 확인한 옵션·가격·배송비를 함께 적어 주세요. 쿠폰이나 카드 조건이 붙으면 적용 대상을 표시해 주세요.</p>
        <p>확인할 수 없는 최저가나 할인율을 단정하지 말아 주세요. 타인의 글과 사진을 사용할 때는 이용 권한과 출처를 확인해 주세요.</p>
        <p>블루딜 운영팀이 게시하는 제휴 콘텐츠에는 수수료 지급 가능성을 안내합니다. 일부 판매처 상품 주소에는 블루딜 제휴 연결이 적용될 수 있습니다.</p>
        <Link href="/about#affiliate" prefetch={false} className={linkClass}>블루딜 제휴 안내</Link>
      </section>

      <section aria-labelledby="safety-title" className={sectionClass}>
        <h2 id="safety-title" className={headingClass}>게시판에서 제한하는 내용</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>욕설·인신공격·혐오·협박, 사칭, 허위 사실 유포</li>
          <li>동의 없이 타인의 연락처·주소·주문정보 등 개인정보를 공개하는 행위</li>
          <li>피싱·악성 파일 링크, 불법 거래, 저작권이나 타인의 권리를 침해하는 내용</li>
        </ul>
      </section>

      <section id="report" aria-labelledby="report-title" className={`${sectionClass} scroll-mt-24`}>
        <h2 id="report-title" className={headingClass}>신고와 운영 조치</h2>
        <p>운영팀은 위반 내용을 확인해 수정을 요청하거나 게시글을 삭제할 수 있습니다. 위반이 반복되거나 피해가 큰 경우 해당 회원 계정의 글쓰기를 제한할 수 있습니다.</p>
        <p>신고, 권리 침해로 인한 삭제 요청, 운영 조치에 대한 이의 제기는 비공개 문의로 접수합니다. 해당 게시글 주소, 문제 되는 내용, 신고 또는 이의 제기 사유를 적어 주세요.</p>
        <Link href="/contact/write?vis=private" prefetch={false} className={linkClass}>비공개로 신고·이의 제기</Link>
      </section>
    </article>
  );
}
