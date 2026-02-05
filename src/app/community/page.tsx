import Link from "next/link";
import { COMMUNITY_BOARDS } from "../../lib/boardConfig";

export default function CommunityHomePage() {
  return (
    <div className="space-y-8">
      <section className="bd-surface-md p-6">
        <h1 className="text-2xl font-semibold tracking-tight">커뮤니티</h1>
        <p className="mt-2 text-sm text-white/70">
          리뷰/하드웨어/오버클럭/이슈공유/자료실 게시판입니다. (MVP: 브라우저 localStorage 저장)
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
          <div className="font-semibold text-white">운영 노트</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>지금 단계는 구색/흐름 확인이 목적입니다.</li>
            <li>글 저장을 전체 공개(공유)로 운영하려면 VPS API/DB 연동이 필요합니다.</li>
            <li>작성자 닉네임은 상단에서 설정한 값(로컬)을 기본으로 사용합니다.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
