"use client";

import { useEffect, useState } from "react";
import { formatKoreanDate } from "../lib/postStorage";

type Suspension = { available: false } | { available: true; until: string | null };

export default function MemberSuspension({ postId }: { postId: string }) {
  const url = "/api/admin/member-suspension/" + encodeURIComponent(postId);
  const [status, setStatus] = useState<Suspension>();
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal }).then(res => {
      if (!res.ok) throw new Error("Could not load suspension");
      return res.json() as Promise<Suspension>;
    }).then(data => {
      if (!controller.signal.aborted) setStatus(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError("작성자 제재 상태를 확인하지 못했습니다.");
    });
    return () => controller.abort();
  }, [url]);

  async function change(method: "PUT" | "DELETE") {
    if (busy || !confirm(method === "PUT" ? "이 작성자의 글쓰기를 " + days + "일간 제한할까요?" : "이 작성자의 글쓰기 제한을 해제할까요?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        ...(method === "PUT" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.available) throw new Error(data.error || "작성자 제재 상태를 변경하지 못했습니다.");
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "작성자 제재 상태를 변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!status?.available) return error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null;
  const button = "min-h-11 rounded-xl border border-white/20 px-3 text-sm text-white hover:bg-white/10 disabled:opacity-60";
  return <section className="bd-surface-md space-y-3 p-4 sm:p-6" aria-label="작성자 제재" aria-busy={busy}>
    <h2 className="text-base font-semibold">작성자 글쓰기 제재</h2>
    <p role="status" className="text-sm text-white/80">{status.until ? formatKoreanDate(status.until) + "까지 제한 중" : "현재 글쓰기 가능"}</p>
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        기간
        <select value={days} onChange={event => setDays(Number(event.target.value))}
          className="min-h-11 rounded-xl border border-white/20 bg-slate-900 px-3 text-white" disabled={busy}>
          {[1, 7, 30].map(day => <option key={day} value={day}>{day}일</option>)}
        </select>
      </label>
      <button type="button" onClick={() => void change("PUT")} className={button} disabled={busy}>{status.until ? "기간 변경" : "글쓰기 제한"}</button>
      {status.until ? <button type="button" onClick={() => void change("DELETE")} className={button} disabled={busy}>제재 해제</button> : null}
    </div>
    {error ? <p role="alert" className="text-sm text-red-200">{error}</p> : null}
  </section>;
}
