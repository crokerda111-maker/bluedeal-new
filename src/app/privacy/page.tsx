import Link from "next/link";
import { pageMetadata } from "../../lib/site";

export const metadata = pageMetadata("개인정보처리방침 | BLUEDEAL", "블루딜의 계정 및 문의 정보 처리 안내", "/privacy");

export default function PrivacyPage() {
  return <article className="bd-surface-md mx-auto max-w-3xl space-y-6 p-5 text-sm leading-7 text-white/85 sm:p-8">
    <header>
      <h1 className="text-2xl font-semibold text-white">개인정보처리방침</h1>
      <p className="mt-2">블루딜은 회원 인증, 게시판 운영과 문의 처리를 위해 필요한 정보를 처리합니다.</p>
    </header>
    <section>
      <h2 className="font-semibold text-white">회원가입과 글쓰기</h2>
      <p>Google 로그인으로 계정을 확인합니다. Google의 계정 식별값을 블루딜 내부 식별값으로 변환하고, 사용자가 입력한 닉네임과 연결합니다. 게시글 작성 시 닉네임이 공개됩니다. Google 이메일과 비밀번호는 블루딜 회원 정보로 저장하지 않습니다. 블루딜 로그인 쿠키는 최대 7일간 유효합니다.</p>
    </section>
    <section>
      <h2 className="font-semibold text-white">탈퇴와 제재 기록</h2>
      <p>내 계정에서 탈퇴하면 회원 정보와 작성자 연결을 삭제하고 로그인 세션을 무효화합니다. 탈퇴 전에 게시한 글과 글에 표시된 닉네임은 게시판에 남습니다. 기존 로그인 세션을 무효화하는 기록은 최대 7일 뒤 파기합니다. 진행 중인 글쓰기 제재의 재가입 우회를 막는 내부 식별값과 제재 종료일은 제재 기간 동안 보관한 뒤 파기합니다.</p>
    </section>
    <section>
      <h2 className="font-semibold text-white">문의와 개인정보 관련 요청</h2>
      <p>문의 내용을 확인하고 필요한 경우 회신하기 위해 문의에 기재한 내용과 이메일을 처리합니다. 개인정보가 포함된 내용은 비공개 문의로 보내 주세요. 개인정보의 열람·정정·삭제·처리정지 요청과 개인정보 관련 문의는 <Link href="/contact/write?vis=private" className="text-cyan-200 underline underline-offset-4">블루딜 비공개 문의</Link>로 접수할 수 있습니다.</p>
    </section>
  </article>;
}
