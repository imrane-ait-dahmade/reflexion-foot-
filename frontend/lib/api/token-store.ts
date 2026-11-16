/**
 * Token storage for FastAPI JWT auth (staff + player).
 * Independent from Better Auth (V1 coach cookies).
 * Uses localStorage in the browser; in-memory fallback for SSR/tests.
 */

const STAFF_ACCESS_KEY = "ccf_v2_staff_access";
const STAFF_REFRESH_KEY = "ccf_v2_staff_refresh";
const PLAYER_ACCESS_KEY = "ccf_v2_player_access";

const memory = new Map<string, string>();

export type AuthScope = "staff" | "player";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read(key: string): string | null {
  if (canUseStorage()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      /* private mode — fall through */
    }
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);

  if (!canUseStorage()) return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode — memory still holds the value */
  }
}

export const tokenStore = {
  getStaffAccessToken(): string | null {
    return read(STAFF_ACCESS_KEY);
  },
  getStaffRefreshToken(): string | null {
    return read(STAFF_REFRESH_KEY);
  },
  setStaffTokens(accessToken: string, refreshToken: string) {
    write(STAFF_ACCESS_KEY, accessToken);
    write(STAFF_REFRESH_KEY, refreshToken);
  },
  clearStaffTokens() {
    write(STAFF_ACCESS_KEY, null);
    write(STAFF_REFRESH_KEY, null);
  },

  getPlayerAccessToken(): string | null {
    return read(PLAYER_ACCESS_KEY);
  },
  setPlayerAccessToken(accessToken: string) {
    write(PLAYER_ACCESS_KEY, accessToken);
  },
  clearPlayerAccessToken() {
    write(PLAYER_ACCESS_KEY, null);
  },

  getAccessToken(scope: AuthScope): string | null {
    return scope === "staff"
      ? this.getStaffAccessToken()
      : this.getPlayerAccessToken();
  },

  clearAll() {
    this.clearStaffTokens();
    this.clearPlayerAccessToken();
  },
};
