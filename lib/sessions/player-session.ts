import type { TestSlug } from "@/lib/db/types";

export type PlayerSessionState = {
  code: string;
  sessionId: string;
  sessionPlayerId: string;
  displayName: string;
  exercises: TestSlug[];
};

const STORAGE_KEY = "fvl-player-session";

/** Cached so useSyncExternalStore getSnapshot stays referentially stable. */
let cachedRaw: string | null | undefined;
let cachedValue: PlayerSessionState | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function readSnapshot(): PlayerSessionState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = null;
    return null;
  }
  try {
    cachedValue = JSON.parse(raw) as PlayerSessionState;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function savePlayerSession(state: PlayerSessionState) {
  const raw = JSON.stringify(state);
  sessionStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedValue = state;
  notify();
}

export function loadPlayerSession(): PlayerSessionState | null {
  return readSnapshot();
}

export function clearPlayerSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  cachedRaw = null;
  cachedValue = null;
  notify();
}

/** Subscribe to in-tab player session changes for useSyncExternalStore. */
export function subscribePlayerSession(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Server snapshot for useSyncExternalStore — always null. */
export function getServerPlayerSession(): PlayerSessionState | null {
  return null;
}
