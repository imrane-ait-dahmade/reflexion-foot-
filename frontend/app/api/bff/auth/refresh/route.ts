import { NextResponse } from "next/server";
import { endpoints } from "@/lib/api/endpoints";
import type { TokenResponse } from "@/lib/api/types";
import { assertCsrf, CsrfError } from "@/lib/server/auth/csrf";
import { getStaffRefreshTokenFromCookies } from "@/lib/server/auth/session";
import {
  clearStaffAuthCookies,
  setStaffAuthCookies,
} from "@/lib/server/auth/set-staff-cookies";
import {
  ServerFastApiError,
  serverFastApiFetch,
} from "@/lib/server/backend/fastapi";

export async function POST(request: Request) {
  try {
    await assertCsrf(request);
    const refresh = await getStaffRefreshTokenFromCookies();
    if (!refresh) {
      return NextResponse.json(
        { error: "No refresh session." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const tokens = await serverFastApiFetch<TokenResponse>(
      endpoints.auth.refresh,
      {
        method: "POST",
        body: { refresh_token: refresh },
      },
    );

    await setStaffAuthCookies(tokens);

    return NextResponse.json(
      {
        user: tokens.user,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof CsrfError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (err instanceof ServerFastApiError) {
      if (err.status === 401) {
        await clearStaffAuthCookies();
      }
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Refresh failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
