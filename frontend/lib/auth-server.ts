/**
 * Server-side coach session via FastAPI Auth BFF (httpOnly cookies).
 * Replaces Better Auth + Drizzle `users` lookup for page/API guards.
 */

import { endpoints } from "@/lib/api/endpoints";
import type { TokenResponse, UserResponse } from "@/lib/api/types";
import {
  getStaffAccessTokenFromCookies,
  getStaffRefreshTokenFromCookies,
} from "@/lib/server/auth/session";
import {
  clearStaffAuthCookies,
  setStaffAuthCookies,
} from "@/lib/server/auth/set-staff-cookies";
import {
  ServerFastApiError,
  serverFastApiFetch,
} from "@/lib/server/backend/fastapi";

/** Roles allowed to use the coach UI (not plain `staff` alone). */
const COACH_AREA_ROLES = new Set(["coach", "admin"]);

export type CoachRecord = {
  /** FastAPI staff user id (UUID string). Not a Drizzle V1 id. */
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
};

export type CoachAuth = {
  user: UserResponse;
  coach: CoachRecord;
};

function toCoachRecord(user: UserResponse): CoachRecord {
  return {
    id: String(user.id),
    displayName: user.full_name,
    email: user.email,
    isActive: user.is_active,
    roles: user.roles ?? [],
    permissions: user.permissions ?? [],
  };
}

function isCoachAreaUser(user: UserResponse): boolean {
  if (!user.is_active) return false;
  return (user.roles ?? []).some((role) => COACH_AREA_ROLES.has(role));
}

async function refreshStaffSession(): Promise<UserResponse | null> {
  const refresh = await getStaffRefreshTokenFromCookies();
  if (!refresh) return null;
  try {
    const tokens = await serverFastApiFetch<TokenResponse>(endpoints.auth.refresh, {
      method: "POST",
      body: { refresh_token: refresh },
    });
    await setStaffAuthCookies(tokens);
    return tokens.user;
  } catch {
    await clearStaffAuthCookies();
    return null;
  }
}

async function loadStaffUser(): Promise<UserResponse | null> {
  const access = await getStaffAccessTokenFromCookies();
  if (!access) return null;

  try {
    return await serverFastApiFetch<UserResponse>(endpoints.auth.me, {
      accessToken: access,
    });
  } catch (err) {
    if (err instanceof ServerFastApiError && err.status === 401) {
      return refreshStaffSession();
    }
    throw err;
  }
}

/**
 * Authenticated FastAPI staff user allowed in the coach area, or null.
 * Does not use Better Auth or Neon/Drizzle.
 * Soft-fails (null) on backend/network errors so public pages never crash.
 */
export async function requireCoach(): Promise<CoachAuth | null> {
  try {
    const user = await loadStaffUser();
    if (!user || !isCoachAreaUser(user)) return null;
    return { user, coach: toCoachRecord(user) };
  } catch {
    return null;
  }
}

/** @deprecated Use requireCoach().user — kept for transitional imports. */
export async function getAuthSession() {
  const auth = await requireCoach();
  if (!auth) return null;
  return { user: auth.user };
}
