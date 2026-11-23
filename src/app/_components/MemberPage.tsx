import Link from "next/link";
import MemberEntry from "../../components/MemberEntry";
import { writerReturnPath } from "../../lib/memberWrite";

const titles = { login: "로그인", signup: "회원가입", account: "내 계정" } as const;

export default async function MemberPage({ mode, searchParams }: {
  mode: keyof typeof titles;
  searchParams?: Promise<{ google?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = mode === "login" && typeof params?.next === "string" ? writerReturnPath(params.next) : "/" + mode;
  return <div className="mx-auto max-w-md">
    <section className="bd-surface-md p-5 sm:p-7" aria-labelledby="member-page-title">
      <h1 id="member-page-title" className="mb-5 text-2xl font-semibold tracking-tight">{titles[mode]}</h1>
      <MemberEntry mode={mode} nextPath={nextPath} callbackFailed={params?.google === "error"} />
      <div className="mt-6 flex flex-wrap items-center gap-x-4 border-t border-white/10 pt-2 text-sm">
        {mode !== "login" && <Link className="inline-flex min-h-11 items-center text-cyan-200 hover:underline" href="/login">로그인</Link>}
        {mode !== "signup" && <Link className="inline-flex min-h-11 items-center text-cyan-200 hover:underline" href="/signup">회원가입</Link>}
        <Link className="inline-flex min-h-11 items-center text-white/75 hover:underline" href="/privacy">개인정보처리방침</Link>
      </div>
    </section>
  </div>;
}
