"use client";

import { createContext, useContext, type ReactNode } from "react";
import MemberEntry from "./MemberEntry";
import { useMemberSession } from "./MemberSession";
import NicknameEditor from "./NicknameEditor";
import { useNickname } from "../lib/useNickname";

const WriterName = createContext<string | null>(null);
const WriterLoginEnabled = createContext(false);

export function MemberWritingAvailability({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <WriterLoginEnabled.Provider value={enabled}>{children}</WriterLoginEnabled.Provider>;
}

export function useWriterNickname() {
  const memberName = useContext(WriterName);
  const localName = useNickname();
  return memberName ?? localName;
}

export function WriterNicknameEditor() {
  const nickname = useContext(WriterName);
  return nickname ? null : <NicknameEditor />;
}

export default function MemberWriteGate({ nextPath, enabled, children }: { nextPath: string; enabled?: boolean; children: ReactNode }) {
  const inherited = useContext(WriterLoginEnabled);
  const { status } = useMemberSession();
  if (status?.state === "disabled") return children;
  if (status?.admin || status?.state === "ready") {
    return <WriterName.Provider value={status.state === "ready" ? status.nickname : null}>{children}</WriterName.Provider>;
  }
  if (!(enabled ?? inherited) && status?.state !== "nickname" && status?.state !== "suspended") {
    return <WriterName.Provider value="비회원">{children}</WriterName.Provider>;
  }
  return <div className="bd-surface-md p-4 sm:p-6"><MemberEntry nextPath={nextPath} mode="write" /></div>;
}
