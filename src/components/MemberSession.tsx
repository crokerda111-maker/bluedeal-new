"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { WriterStatus } from "../lib/memberWrite";

type MemberState = WriterStatus & { admin?: boolean };
type Context = {
  status: MemberState | null;
  busy: boolean;
  refresh: () => void;
  mutate: (method: "POST" | "DELETE", data?: Record<string, unknown>) => Promise<boolean>;
  error: string;
};
const Session = createContext<Context | null>(null);

export function MemberSession({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [status, setStatus] = useState<MemberState | null>(enabled ? null : { state: "disabled" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const pending = useRef(false);

  const refresh = useCallback(() => {
    if (!enabled || pending.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    fetch("/api/member", { cache: "no-store", signal: controller.signal })
      .then(res => res.ok ? res.json() as Promise<MemberState> : { state: "unavailable" } as const)
      .then(data => {
        if (!controller.signal.aborted) setStatus(data);
      }).catch(() => {
        if (!controller.signal.aborted) setStatus({ state: "unavailable" });
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const resume = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", resume);
    const sync = (event: StorageEvent) => { if (event.key === "bluedeal_member_changed") refresh(); };
    window.addEventListener("storage", sync);
    return () => {
      request.current?.abort();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("storage", sync);
    };
  }, [enabled, refresh]);

  async function mutate(method: "POST" | "DELETE", data?: Record<string, unknown>): Promise<boolean> {
    if (!enabled || pending.current) return false;
    pending.current = true;
    request.current?.abort();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/member", {
        method,
        ...(data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "계정 정보를 처리하지 못했습니다.");
      setStatus(result as MemberState);
      try { window.localStorage.setItem("bluedeal_member_changed", String(Date.now())); } catch { /* Other tabs refresh on focus. */ }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "계정 정보를 처리하지 못했습니다.");
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <Session.Provider value={{ status, busy, refresh, mutate, error }}>{children}</Session.Provider>;
}

export function useMemberSession(): Context {
  const session = useContext(Session);
  if (!session) throw new Error("MemberSession provider is missing.");
  return session;
}
