export const metadata = {
  title: "이용약관 | BLUEDEAL",
};

export default function TermsPage() {
  return (
    <main className="bd-container py-10">
      <div className="bd-surface-md p-6 md:p-8">
        <h1 className="text-xl font-semibold text-white">이용약관</h1>
        <p className="mt-2 text-sm text-white/60">시행일: 2026-02-07</p>

        <div className="prose prose-invert mt-6 max-w-none prose-p:text-white/80 prose-li:text-white/80">
          <p>
            본 약관은 BLUEDEAL(이하 “서비스”)가 제공하는 기능을 이용함에 있어 서비스와 이용자 간의 권리,
            의무 및 책임사항을 규정합니다.
          </p>

          <h2>1. 정의</h2>
          <ul>
            <li>“회원”은 본 약관에 동의하고 계정을 생성한 자를 말합니다.</li>
            <li>“게시물”은 회원이 서비스에 게시한 글/댓글/이미지 등을 말합니다.</li>
          </ul>

          <h2>2. 회원가입 및 계정</h2>
          <ul>
            <li>회원은 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.</li>
            <li>계정 관리 책임은 회원에게 있으며, 부정 사용이 의심될 경우 즉시 문의해 주세요.</li>
          </ul>

          <h2>3. 서비스 이용</h2>
          <ul>
            <li>서비스는 커뮤니티/정보 제공을 목적으로 합니다.</li>
            <li>서비스는 운영상 필요에 따라 일부 기능을 변경/중단할 수 있습니다.</li>
          </ul>

          <h2>4. 게시물의 관리</h2>
          <ul>
            <li>회원은 관련 법령 및 커뮤니티 가이드에 따라 게시물을 작성해야 합니다.</li>
            <li>
              다음과 같은 게시물은 사전 통지 없이 삭제/차단될 수 있습니다: 불법 정보, 타인 비방/혐오,
              개인정보 노출, 스팸/광고, 저작권 침해 등
            </li>
          </ul>

          <h2>5. 책임 제한</h2>
          <p>
            서비스는 천재지변, 장애, 제3자 공격 등 불가항력 사유로 인한 서비스 중단에 대해 책임을 지지
            않습니다. 또한 회원 간 거래/분쟁에 서비스는 개입하지 않습니다.
          </p>

          <h2>6. 준거법 및 분쟁</h2>
          <p>본 약관은 대한민국 법령을 준거로 하며, 분쟁이 발생할 경우 관할 법원에 따릅니다.</p>

          <hr />
          <p className="text-xs text-white/60">
            ※ 본 문서는 MVP 단계의 기본 템플릿이며, 실제 운영 정책/법률 자문에 맞춰 수정이 필요할 수 있습니다.
          </p>
        </div>
      </div>
    </main>
  );
}
