const PROFILE_KEY = "bluedeal_profile_v1";

export type Profile = {
  nickname: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getProfile(): Profile | null {
  if (!isBrowser()) return null;
  const parsed = safeJsonParse<Profile>(window.localStorage.getItem(PROFILE_KEY));
  if (!parsed || typeof parsed.nickname !== "string") return null;
  return parsed;
}

export function getNickname(fallback = "게스트"): string {
  const p = getProfile();
  const nick = p?.nickname?.trim();
  return nick ? nick : fallback;
}

export function setNickname(nickname: string): void {
  if (!isBrowser()) return;
  const clean = nickname.trim().slice(0, 20);
  const payload: Profile = { nickname: clean };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(payload));
  // 같은 탭에서도 반응하도록 커스텀 이벤트
  window.dispatchEvent(new CustomEvent("bluedeal_profile_changed"));
}

export function onProfileChanged(handler: () => void): () => void {
  if (!isBrowser()) return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROFILE_KEY) handler();
  };
  const onCustom = () => handler();
  window.addEventListener("storage", onStorage);
  window.addEventListener("bluedeal_profile_changed", onCustom as any);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("bluedeal_profile_changed", onCustom as any);
  };
}
