import { NextResponse } from "next/server";
import { endpoints } from "@/lib/api/endpoints";
import { assertCsrf, CsrfError } from "@/lib/server/auth/csrf";
import {
  getStaffAccessTokenFromCookies,
  getStaffRefreshTokenFromCookies,
} from "@/lib/server/auth/session";
import { clearStaffAuthCookies } from "@/lib/server/auth/set-staff-cookies";
import { serverFastApiFetch } from "@/lib/server/backend/fastapi";

export async function POST(request: Request) {
  try {
    await assertCsrf(request);
  } catch (err) {
    if (err instanceof CsrfError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    throw err;
  }

  const access = await getStaffAccessTokenFromCookies();
  const refresh = await getStaffRefreshTokenFromCookies();

  if (access && refresh) {
    try {
      await serverFastApiFetch(endpoints.auth.logout, {
        method: "POST",
        accessToken: access,
        body: { refresh_token: refresh, all_sessions: false },
      });
    } catch {
      /* still clear cookies */
    }
  }

  await clearStaffAuthCookies();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
