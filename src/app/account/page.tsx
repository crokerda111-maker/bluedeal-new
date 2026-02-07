"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "../_components/AuthProvider";

type Tab = "login" | "signup";

export default function AccountPage() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/";

  const { user, loading, login, signup, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) return false;
    if (tab === "signup" && !nickname.trim()) return false;
    return true;
  }, [email, password, nickname, tab]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (tab === "login") {
        const res = await login({ email: email.trim(), password });
        if (!res) throw new Error("로그인 실패 (이메일/비밀번호 확인)");
      } else {
        const res = await signup({ email: email.trim(), password, nickname: nickname.trim() });
        if (!res) throw new Error("회원가입 실패 (이미 가입된 이메일일 수 있음)");
      }
      router.push(returnTo);
    } catch (err: any) {
      setError(err?.message || "실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">계정</h1>
          <p className="mt-1 text-sm text-white/70">
            글/댓글 작성은 로그인 후 가능합니다. (세션 쿠키 방식)
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
            로그인 상태 확인 중...
          </div>
        ) : user ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-sm text-white/70">로그인됨</div>
              <div className="mt-1 text-lg font-semibold">{user.nickname}</div>
              <div className="mt-1 text-sm text-white/60">{user.email}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={logout}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
              >
                로그아웃
              </button>
              <Link
                href={returnTo}
                className="rounded-xl bg-cyan-400/20 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-400/25"
              >
                돌아가기
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setTab("login")}
                className={`rounded-xl px-4 py-2 text-sm ${
                  tab === "login" ? "bg-cyan-400/25 text-cyan-100" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                로그인
              </button>
              <button
                onClick={() => setTab("signup")}
                className={`rounded-xl px-4 py-2 text-sm ${
                  tab === "signup"
                    ? "bg-cyan-400/25 text-cyan-100"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                회원가입
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/60">이메일</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-white/60">비밀번호</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="비밀번호"
                />
              </div>

              {tab === "signup" && (
                <div>
                  <label className="mb-1 block text-xs text-white/60">닉네임</label>
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/40"
                    placeholder="표시될 닉네임"
                  />
                  <p className="mt-1 text-xs text-white/40">* 닉네임은 게시글/댓글 작성자명으로 사용됩니다.</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || busy}
                className={`w-full rounded-xl px-4 py-2 text-sm font-medium ${
                  !canSubmit || busy
                    ? "cursor-not-allowed bg-white/10 text-white/50"
                    : "bg-cyan-400/25 text-cyan-50 hover:bg-cyan-400/30"
                }`}
              >
                {busy ? "처리 중..." : tab === "login" ? "로그인" : "회원가입"}
              </button>

              <div className="pt-2 text-center text-xs text-white/40">
                세션이 유지되지 않으면 브라우저의 쿠키/사이트 데이터 차단 설정을 확인하세요.
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
