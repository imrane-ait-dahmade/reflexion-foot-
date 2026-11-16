import { NextResponse } from "next/server";
import { endpoints } from "@/lib/api/endpoints";
import type { LoginRequest, TokenResponse } from "@/lib/api/types";
import { assertCsrf, CsrfError } from "@/lib/server/auth/csrf";
import { setStaffAuthCookies } from "@/lib/server/auth/set-staff-cookies";
import {
  ServerFastApiError,
  serverFastApiFetch,
} from "@/lib/server/backend/fastapi";

export async function POST(request: Request) {
  try {
    await assertCsrf(request);
    const body = (await request.json()) as LoginRequest;
    if (!body?.email || !body?.password) {
      return NextResponse.json(
        { error: "Email and password required." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const tokens = await serverFastApiFetch<TokenResponse>(endpoints.auth.login, {
      method: "POST",
      body: {
        email: String(body.email).trim(),
        password: String(body.password),
      },
    });

    await setStaffAuthCookies(tokens);

    // Never return JWT material to the browser.
    return NextResponse.json(
      {
        user: tokens.user,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
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
      return NextResponse.json(
        { error: err.message },
        { status: err.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Login failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
