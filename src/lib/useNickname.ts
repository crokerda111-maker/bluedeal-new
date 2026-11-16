"use client";

import { useSyncExternalStore } from "react";
import { getNickname, onProfileChanged } from "./profile";

function getServerNickname(): string {
  return "게스트";
}

export function useNickname(): string {
  return useSyncExternalStore(onProfileChanged, getNickname, getServerNickname);
}
