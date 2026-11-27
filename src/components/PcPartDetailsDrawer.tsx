"use client";

import { useId, useRef, type ReactNode } from "react";

export default function PcPartDetailsDrawer({ part, model, children }: { part: string; model: string; children: ReactNode }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  return <>
    <button type="button" ref={trigger} aria-label={`${part} 자세히`} aria-haspopup="dialog" aria-controls={id}
      onClick={() => dialog.current?.showModal()}
      className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-cyan-200 underline underline-offset-4 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
      자세히
    </button>
    <dialog id={id} ref={dialog} aria-labelledby={id + "-title"} onClose={() => trigger.current?.focus()}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-xl overflow-hidden border-l border-white/15 bg-[#0e1b30] text-white shadow-2xl backdrop:bg-slate-950/75 open:flex open:flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-white/15 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <h4 id={id + "-title"} className="text-lg font-semibold">{part} 상세</h4>
          <p className="mt-1 break-words text-sm leading-6 text-white/75">{model}</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()}
          className="min-h-11 shrink-0 rounded-lg border border-white/25 px-3 text-sm text-cyan-100 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200">
          닫기
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">{children}</div>
    </dialog>
  </>;
}
