import { NextResponse } from "next/server";
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

async function tryRefresh(): Promise<UserResponse | null> {
  const refresh = await getStaffRefreshTokenFromCookies();
  if (!refresh) return null;
  try {
    const tokens = await serverFastApiFetch<TokenResponse>(
      endpoints.auth.refresh,
      {
        method: "POST",
        body: { refresh_token: refresh },
      },
    );
    await setStaffAuthCookies(tokens);
    return tokens.user;
  } catch {
    await clearStaffAuthCookies();
    return null;
  }
}

export async function GET() {
  const access = await getStaffAccessTokenFromCookies();
  if (!access) {
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const user = await serverFastApiFetch<UserResponse>(endpoints.auth.me, {
      accessToken: access,
    });
    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof ServerFastApiError && err.status === 401) {
      const user = await tryRefresh();
      if (user) {
        return NextResponse.json(
          { user },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      return NextResponse.json(
        { user: null },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const message =
      err instanceof Error ? err.message : "Unable to load staff session.";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
