import { cookies } from "next/headers";
import { endpoints } from "@/lib/api/endpoints";
import type { UserResponse } from "@/lib/api/types";
import {
  STAFF_ACCESS_COOKIE,
  STAFF_REFRESH_COOKIE,
} from "@/lib/server/auth/cookies";
import {
  ServerFastApiError,
  serverFastApiFetch,
} from "@/lib/server/backend/fastapi";

export async function getStaffAccessTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STAFF_ACCESS_COOKIE)?.value ?? null;
}

export async function getStaffRefreshTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(STAFF_REFRESH_COOKIE)?.value ?? null;
}

export async function getStaffUserFromCookies(): Promise<UserResponse | null> {
  const access = await getStaffAccessTokenFromCookies();
  if (!access) return null;
  try {
    return await serverFastApiFetch<UserResponse>(endpoints.auth.me, {
      accessToken: access,
    });
  } catch (err) {
    if (err instanceof ServerFastApiError && err.status === 401) {
      return null;
    }
    throw err;
  }
}
