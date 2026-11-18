import { cookies } from "next/headers";
import type { TokenResponse } from "@/lib/api/types";
import {
  clearCookieOptions,
  CSRF_COOKIE,
  csrfCookieOptions,
  STAFF_ACCESS_COOKIE,
  STAFF_REFRESH_COOKIE,
  staffAccessCookieOptions,
  staffRefreshCookieOptions,
} from "@/lib/server/auth/cookies";
import { generateCsrfToken } from "@/lib/server/auth/csrf";

const REFRESH_MAX_AGE = 60 * 60 * 24 * 14;

export async function setStaffAuthCookies(tokens: TokenResponse) {
  const jar = await cookies();
  jar.set(
    STAFF_ACCESS_COOKIE,
    tokens.access_token,
    staffAccessCookieOptions(tokens.expires_in ?? 900),
  );
  jar.set(
    STAFF_REFRESH_COOKIE,
    tokens.refresh_token,
    staffRefreshCookieOptions(REFRESH_MAX_AGE),
  );
  // Rotate CSRF on login
  jar.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieOptions());
}

export async function clearStaffAuthCookies() {
  const jar = await cookies();
  jar.set(STAFF_ACCESS_COOKIE, "", clearCookieOptions("/"));
  jar.set(STAFF_REFRESH_COOKIE, "", clearCookieOptions("/"));
  // Clear legacy path-scoped refresh cookie from earlier BFF iterations.
  jar.set(STAFF_REFRESH_COOKIE, "", {
    ...clearCookieOptions("/api/bff/auth"),
    httpOnly: true,
  });
}

export async function ensureCsrfCookie(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = generateCsrfToken();
  jar.set(CSRF_COOKIE, token, csrfCookieOptions());
  return token;
}
