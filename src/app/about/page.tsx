import Link from "next/link";

export const metadata = {
  title: "소개 | BLUEDEAL",
  description: "BLUEDEAL 서비스 소개",
};

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">소개</h1>
        <p className="mt-2 text-sm text-white/70">
          BLUEDEAL은 PC 부품/완제품 가격 흐름과 IT 소식, 커뮤니티, 핫딜을 한 곳에서 정리해 <b>딜 판단</b>을 빠르게 돕는
          사이트입니다.
        </p>
      </section>

      <section className="bd-surface-md p-6 text-sm text-white/70">
        <div className="font-semibold text-white">서비스 특징</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>가격현황: 매일 09:00 / 17:00 업데이트</li>
          <li>핫딜: 카테고리별 정리 · 구매/출처 링크는 새 창에서 열림</li>
          <li>커뮤니티: 질문/후기/자료 공유</li>
          <li>문의: 오탈자·누락·제휴/광고 문의 접수</li>
        </ul>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/60">
          외부 링크는 새 창으로 열리며, 일부 링크는 제휴 링크일 수 있습니다.
        </div>

        <div className="mt-4">
          <Link className="text-cyan-200 hover:underline" href="/">
            홈으로 돌아가기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
