import Link from "next/link";

export const metadata = {
  title: "소개 | BLUEDEAL",
  description: "BLUEDEAL 소개",
};

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">소개</h1>
        <p className="mt-2 text-sm text-white/70">
          BLUEDEAL은 PC 부품/본체 가격현황과 IT 소식, 커뮤니티, 핫딜을 한 곳에 모으는 것을 목표로 하는 MVP입니다.
        </p>
      </section>

      <section className="bd-surface-md p-6 text-sm text-white/70">
        <div className="font-semibold text-white">현재 단계</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>게시판(IT/커뮤니티): 온라인 저장(KV) + KV 미설정 시 샘플 글 fallback</li>
          <li>문의: 브라우저 localStorage 기반(초기 단계)</li>
          <li>가격현황: 정적 JSON 또는 VPS API 연동(환경변수 PRICE_API_BASE)</li>
          <li>핫딜: 샘플 데이터 + /go 리다이렉트(제휴 URL 변환)</li>
        </ul>

        <div className="mt-4">
          <Link className="text-cyan-200 hover:underline" href="/">
            홈으로 돌아가기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
