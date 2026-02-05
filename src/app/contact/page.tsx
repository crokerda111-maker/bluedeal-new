import Link from "next/link";
import { INQUIRY_BOARDS } from "../../lib/boardConfig";

export default function ContactHomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">문의</h1>
        <p className="mt-2 text-sm text-white/70">
          문의는 공개/비공개 게시판으로 분리했습니다. (MVP: 브라우저 localStorage 저장)
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {INQUIRY_BOARDS.map((b) => (
          <Link
            key={b.slug}
            href={`/contact/${b.slug}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:bg-white/10"
          >
            <div className="text-lg font-semibold">{b.title}</div>
            <div className="mt-2 text-sm text-white/70">{b.description}</div>
            <div className="mt-4 text-[12px] text-white/50">게시판 열기 →</div>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        <div className="font-semibold text-white">운영 팁</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>공개 문의: 오류 제보, 기능 제안, 제휴 문의 등</li>
          <li>비공개 문의: 개인정보/견적/민감한 내용</li>
          <li>실제 운영 단계에서는 VPS/DB 연동으로 저장/관리 기능을 붙이면 됩니다.</li>
        </ul>
      </section>
    </div>
  );
}
