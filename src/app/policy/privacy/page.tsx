export const metadata = {
  title: "개인정보처리방침 | BLUEDEAL",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="bd-container py-10">
      <div className="bd-surface-md p-6 md:p-8">
        <h1 className="text-xl font-semibold text-white">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-white/60">시행일: 2026-02-07</p>

        <div className="prose prose-invert mt-6 max-w-none prose-p:text-white/80 prose-li:text-white/80">
          <p>
            BLUEDEAL(이하 “서비스”)는 이용자의 개인정보를 중요하게 생각하며, 관련 법령을 준수합니다. 본
            방침은 서비스 이용과 회원가입 과정에서 수집/이용되는 개인정보의 항목, 목적, 보관 기간 등을
            설명합니다.
          </p>

          <h2>1. 수집하는 개인정보 항목</h2>
          <ul>
            <li>
              회원가입 시: 이메일, 비밀번호(서버에 안전하게 저장/처리), 닉네임
            </li>
            <li>
              서비스 이용 시: 접속 로그, IP, 쿠키/세션 정보, 기기/브라우저 정보(서비스 품질 개선 목적)
            </li>
            <li>
              게시물 작성 시: 게시글/댓글 내용 및 첨부 정보(선택)
            </li>
          </ul>

          <h2>2. 개인정보 이용 목적</h2>
          <ul>
            <li>회원 식별 및 계정 관리(가입/로그인/로그아웃)</li>
            <li>게시글/댓글 등 커뮤니티 기능 제공</li>
            <li>서비스 운영, 보안, 부정 이용 방지</li>
            <li>문의 응대 및 고객지원</li>
          </ul>

          <h2>3. 보관 및 이용 기간</h2>
          <ul>
            <li>원칙적으로 회원 탈퇴 시 지체 없이 파기합니다.</li>
            <li>다만, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관할 수 있습니다.</li>
          </ul>

          <h2>4. 제3자 제공 및 처리위탁</h2>
          <p>
            서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 법령에 근거가 있거나
            이용자의 사전 동의가 있는 경우에 한해 제공될 수 있습니다.
          </p>

          <h2>5. 이용자의 권리</h2>
          <ul>
            <li>개인정보 열람, 정정, 삭제, 처리정지 요청</li>
            <li>회원 탈퇴(계정 삭제) 요청</li>
          </ul>

          <h2>6. 개인정보 보호책임자</h2>
          <p>
            개인정보 관련 문의는 아래 채널로 연락해 주세요. (운영 초기에는 문의 페이지를 통해 접수하도록
            구성할 수 있습니다.)
          </p>

          <h2>7. 고지의 의무</h2>
          <p>
            본 방침은 법령/서비스 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지 등을 통해 안내합니다.
          </p>

          <hr />
          <p className="text-xs text-white/60">
            ※ 본 문서는 MVP 단계의 기본 템플릿이며, 실제 운영 정책/법률 자문에 맞춰 수정이 필요할 수 있습니다.
          </p>
        </div>
      </div>
    </main>
  );
}
