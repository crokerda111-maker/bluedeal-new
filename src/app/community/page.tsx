import Link from "next/link";
import { COMMUNITY_BOARDS } from "../../lib/boardConfig";

export default function CommunityHomePage() {
  return (
    <div className="space-y-8">
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">커뮤니티</h1>
        <p className="mt-2 text-sm text-white/70">
          리뷰/하드웨어/오버클럭/이슈공유/자료실/핫딜 제보 게시판입니다. 질문/후기/팁을 자유롭게 공유해 주세요.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {COMMUNITY_BOARDS.map((b) => (
          <Link
            key={b.slug}
            href={`/community/${b.slug}`}
            className="bd-surface-md p-6 hover:bg-white/10"
          >
            <div className="text-lg font-semibold">{b.title}</div>
            <div className="mt-2 text-sm text-white/70">{b.description}</div>
            <div className="mt-4 text-[12px] text-white/50">글 보기 →</div>
          </Link>
        ))}
      </section>

      <section className="bd-surface-md p-6">
        <div className="text-sm text-white/70">
          <div className="font-semibold text-white">이용 안내</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>글 작성 시 말머리를 선택하면 분류/검색이 쉬워집니다.</li>
            <li>출처/참고 링크는 새 창으로 열립니다.</li>
            <li>개인정보(실명/연락처 등)는 가급적 공유하지 마세요.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
