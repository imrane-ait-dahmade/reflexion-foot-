import { NextResponse } from "next/server";
import { ensureCsrfCookie } from "@/lib/server/auth/set-staff-cookies";

/** Issue / refresh the readable CSRF cookie for BFF mutating calls. */
export async function GET() {
  const token = await ensureCsrfCookie();
  return NextResponse.json(
    { csrf_token: token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
