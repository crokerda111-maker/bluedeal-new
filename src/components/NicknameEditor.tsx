"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { setNickname } from "../lib/profile";
import { useNickname } from "../lib/useNickname";

export default function NicknameEditor({ header = false }: { header?: boolean }) {
  const nickname = useNickname();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; temporary: boolean } | null>(null);

  useEffect(() => {
    if (!open || !dialog.current || dialog.current.open) return;
    dialog.current.showModal();
    input.current?.focus();
  }, [open]);

  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };

  const save = (value: string) => {
    const persisted = setNickname(value);
    setFeedback({
      message: persisted ? "닉네임을 저장했습니다." : "브라우저에 저장할 수 없어 닉네임을 현재 페이지에만 적용했습니다. 새로고침하면 초기화됩니다.",
      temporary: !persisted,
    });
    close();
  };

  return <>
    <button
      ref={trigger}
      type="button"
      aria-haspopup="dialog"
      aria-label={header ? `닉네임 설정, 현재 ${nickname}` : undefined}
      title={header ? "닉네임 설정" : undefined}
      className={header
        ? "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
        : "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"}
      onClick={() => { setDraft(nickname === "게스트" ? "" : nickname); setError(null); setFeedback(null); setOpen(true); }}
    >
      {header ? <>
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-300/80" />
        <span className="max-w-[72px] truncate sm:max-w-[120px]">{nickname}</span>
        <span className="hidden text-white/70 sm:inline">설정</span>
      </> : "닉네임 변경"}
    </button>
    {feedback && !feedback.temporary ? <span role="status" className="sr-only">{feedback.message}</span> : null}
    {feedback?.temporary ? createPortal(
      <div role="status" className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-xl border border-amber-300/30 bg-[#0B1428] p-4 text-sm leading-relaxed text-amber-100 shadow-xl">
        <p>{feedback.message}</p>
        <button type="button" aria-label="닉네임 알림 닫기" className="shrink-0 px-2" onClick={() => setFeedback(null)}>닫기</button>
      </div>, document.body,
    ) : null}
    {open ? createPortal(
      <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-help`}
        onClose={() => { setOpen(false); trigger.current?.focus(); }}
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          if (event.shiftKey && event.target === input.current) {
            event.preventDefault();
            resetButton.current?.focus();
          } else if (!event.shiftKey && event.target === resetButton.current) {
            event.preventDefault();
            input.current?.focus();
          }
        }}
        className="m-auto max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl border border-white/20 bg-[#0B1428] p-5 text-white shadow-2xl backdrop:bg-slate-950/80 sm:p-6">
        <h2 id={`${id}-title`} className="text-xl font-semibold">닉네임 설정</h2>
        <p id={`${id}-help`} className="mt-2 text-sm leading-relaxed text-white/75">글 작성 시 사용할 이름을 입력하세요. 최대 20자이며 이 브라우저에 저장됩니다.</p>
        <form method="dialog" className="mt-5 space-y-4" onSubmit={event => {
          event.preventDefault();
          event.stopPropagation();
          if (!draft.trim()) { setError("닉네임을 입력하거나 게스트로 초기화해 주세요."); return; }
          save(draft);
        }}>
          <label className="block text-sm text-white/85" htmlFor={`${id}-input`}>닉네임</label>
          <input ref={input} id={`${id}-input`} value={draft} onChange={event => setDraft(event.target.value)} required maxLength={20}
            autoComplete="nickname" className="w-full rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-base text-white" />
          {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">저장</button>
            <button type="button" className="rounded-xl border border-white/20 px-4 py-2 text-sm" onClick={close}>취소</button>
            <button ref={resetButton} type="button" className="rounded-xl px-3 py-2 text-sm text-white/75 underline underline-offset-4" onClick={() => save("")}>게스트로 초기화</button>
          </div>
        </form>
      </dialog>, document.body,
    ) : null}
  </>;
}
