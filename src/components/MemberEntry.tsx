"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { useMemberSession } from "./MemberSession";
import { POST_LIMITS } from "../lib/postInput";
import { formatKoreanDate } from "../lib/postStorage";

const primary = "inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:opacity-60";
const link = "inline-flex min-h-11 items-center text-sm text-cyan-200 underline underline-offset-4";
const field = "min-h-11 max-w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-base text-white focus-visible:outline-2 focus-visible:outline-cyan-300";

export default function MemberEntry({ nextPath, mode, callbackFailed = false }: {
  nextPath: string;
  mode: "login" | "signup" | "account" | "write";
  callbackFailed?: boolean;
}) {
  const { status, busy, refresh, mutate, error } = useMemberSession();
  const [nickname, setNickname] = useState("");
  const [danger, setDanger] = useState(false);
  const [left, setLeft] = useState(false);
  const fieldId = useId();

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate("POST", { nickname });
  }

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await mutate("POST", { action: "withdraw" })) {
      setDanger(false);
      setLeft(true);
    }
  }

  const registered = (status?.state === "ready" && status.nickname !== null) || (status?.state === "suspended" && status.registered);
  const accountName = status?.state === "ready" || status?.state === "suspended" ? status.nickname : null;
  const needsGoogle = status?.state === "login";
  const isWrite = mode === "write";
  return <div className="space-y-4" aria-busy={busy}>
    {!status && <p role="status" className="text-sm text-white/75">계정 상태 확인 중</p>}
    {status?.state === "disabled" && <p className="text-sm text-white/80">Google 로그인 연결을 준비 중입니다.</p>}
    {status?.state === "unavailable" && <>
      <p role="alert" className="text-sm text-red-200">계정 정보를 확인하지 못했습니다.</p>
      <button type="button" className={primary} onClick={refresh}>다시 시도</button>
    </>}
    {needsGoogle && <>
      {left && <p role="status" className="text-sm text-cyan-200">회원 탈퇴를 완료했습니다.</p>}
      <p className="text-sm leading-6 text-white/80">
        {isWrite ? "글을 쓰려면 Google로 로그인해 주세요." : mode === "signup" ? "Google 계정을 선택하고 블루딜에서 사용할 닉네임을 정해 주세요." : "블루딜에 연결한 Google 계정으로 로그인하세요."}
      </p>
      <a className={primary} href={(isWrite ? "/login?next=" : "/api/member/google?next=") + encodeURIComponent(nextPath)}>
        {isWrite ? "로그인" : mode === "signup" ? "Google로 회원가입" : "Google로 로그인"}
      </a>
      {callbackFailed && <p role="alert" className="text-sm text-red-200">Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.</p>}
    </>}
    {status?.state === "nickname" && <form className="space-y-3" onSubmit={signup}>
      {status.conflict ? <p className="text-sm text-amber-100">기존 닉네임이 다른 회원과 겹칩니다. 앞으로 사용할 새 닉네임을 정해 주세요.</p> : null}
      <label htmlFor={fieldId} className="block text-sm font-semibold">게시글에 표시할 닉네임</label>
      <input id={fieldId} className={field + " w-full"} value={nickname} maxLength={POST_LIMITS.authorName}
        onChange={event => setNickname(event.target.value)} required autoComplete="nickname" />
      <p className="text-xs leading-5 text-white/70">닉네임은 공개됩니다. 20자 이내로 입력해 주세요. 대소문자·공백·일부 구분 기호만 다른 이름도 같은 닉네임으로 처리합니다.</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primary} disabled={busy || !nickname.trim()}>가입 완료</button>
        <button type="button" className={link} disabled={busy} onClick={() => void mutate("DELETE")}>다른 Google 계정 사용</button>
      </div>
    </form>}
    {status?.state === "suspended" && <>
      <p role="status" className="text-sm text-white/90">{formatKoreanDate(status.until)}까지 글쓰기 제재 중입니다.</p>
      <Link href="/contact/write?vis=private" className={link}>비공개 문의</Link>
    </>}
    {registered && !isWrite && <>
      {accountName && <div className="rounded-xl border border-white/15 bg-white/5 p-4">
        <div className="text-xs text-white/70">닉네임</div>
        <p className="mt-1 break-words font-semibold">{accountName}</p>
      </div>}
      {mode !== "account" && <Link href={nextPath === "/login" || nextPath === "/signup" ? "/account" : nextPath} className={primary}>{nextPath === "/login" || nextPath === "/signup" ? "내 계정" : "글쓰기로 돌아가기"}</Link>}
      {mode === "account" && <div className="flex flex-wrap gap-3">
        <Link href="/community" className={primary}>커뮤니티 보기</Link>
        <button type="button" className={link} onClick={() => void mutate("DELETE")} disabled={busy}>로그아웃</button>
      </div>}
      {mode === "account" && <div className="border-t border-white/10 pt-3">
        {!danger ? <button type="button" className="min-h-11 text-sm text-red-200 underline underline-offset-4" onClick={() => setDanger(true)}>회원 탈퇴</button>
          : <form className="space-y-3" onSubmit={withdraw}>
            <p className="text-sm leading-6 text-white/80">탈퇴하면 계정과 로그인 세션이 삭제됩니다. 작성한 글과 글에 표시된 닉네임은 게시판에 남습니다. 적용 중인 글쓰기 제재는 종료일까지 이어집니다.</p>
            <label className="flex min-h-11 items-start gap-2 text-sm">
              <input type="checkbox" required className="mt-1 size-4" /> 안내를 확인했으며 회원 탈퇴를 요청합니다.
            </label>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="min-h-11 rounded-xl border border-red-300/30 px-4 text-sm text-red-200 disabled:opacity-60" disabled={busy}>탈퇴 확정</button>
              <button type="button" className={link} onClick={() => setDanger(false)}>취소</button>
            </div>
          </form>}
      </div>}
    </>}
    {status?.state === "suspended" && (!registered || isWrite) &&
      <button type="button" className={link} onClick={() => void mutate("DELETE")} disabled={busy}>로그아웃</button>}
    {isWrite && nextPath === "/contact/write" && status?.state !== "suspended" &&
      <Link href="/contact/write?vis=private" className={link}>비공개 문의</Link>}
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
  </div>;
}
