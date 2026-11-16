const PROFILE_KEY = "bluedeal_profile_v1";

export type Profile = {
  nickname: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Browser-only fallback: no profile is retained across server requests.
const tabProfiles = new WeakMap<Window, Profile>();

function readProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !("nickname" in parsed) || typeof parsed.nickname !== "string") return null;
    return { nickname: parsed.nickname.trim().slice(0, 20) };
  } catch {
    return null;
  }
}

export function getProfile(): Profile | null {
  if (!isBrowser()) return null;
  const current = tabProfiles.get(window);
  if (current) return current;
  try { return readProfile(window.localStorage.getItem(PROFILE_KEY)); }
  catch { return null; }
}

export function getNickname(fallback = "게스트"): string {
  const p = getProfile();
  const nick = p?.nickname?.trim();
  return nick ? nick : fallback;
}

export function setNickname(nickname: string): boolean {
  if (!isBrowser()) return false;
  const clean = nickname.trim().slice(0, 20);
  const payload: Profile = { nickname: clean };
  tabProfiles.set(window, payload);
  let persisted = false;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(payload));
    persisted = true;
  } catch { /* Keep the current tab usable when persistence is unavailable. */ }
  // 같은 탭에서도 반응하도록 커스텀 이벤트
  window.dispatchEvent(new CustomEvent("bluedeal_profile_changed"));
  return persisted;
}

export function onProfileChanged(handler: () => void): () => void {
  if (!isBrowser()) return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PROFILE_KEY && e.key !== null) return;
    try { if (e.storageArea !== window.localStorage) return; }
    catch { return; }
    tabProfiles.delete(window);
    handler();
  };
  const onCustom = () => handler();
  window.addEventListener("storage", onStorage);
  window.addEventListener("bluedeal_profile_changed", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("bluedeal_profile_changed", onCustom);
  };
}
