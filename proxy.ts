import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isCoachArea =
    pathname === "/coach" || pathname.startsWith("/coach/sessions");
  const isPublicCoachAuth =
    pathname.startsWith("/coach/login") ||
    pathname.startsWith("/coach/register");

  if (isCoachArea && !isPublicCoachAuth && !getSessionCookie(request)) {
    const loginUrl = new URL("/coach/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/coach", "/coach/sessions/:path*"],
};
