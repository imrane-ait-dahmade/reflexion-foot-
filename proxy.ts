import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCoachCookie = Boolean(getSessionCookie(request));

  // Free tests are disabled — players must join with a session code.
  if (
    pathname === "/tests" ||
    pathname.startsWith("/tests/") ||
    pathname === "/exercises" ||
    pathname.startsWith("/exercises/")
  ) {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  // Logged-in coaches skip the public home without a database round-trip.
  if (pathname === "/" && hasCoachCookie) {
    return NextResponse.redirect(new URL("/coach", request.url));
  }

  const isCoachArea =
    pathname === "/coach" || pathname.startsWith("/coach/sessions");
  const isPublicCoachAuth =
    pathname.startsWith("/coach/login") ||
    pathname.startsWith("/coach/register");

  if (isCoachArea && !isPublicCoachAuth && !hasCoachCookie) {
    const loginUrl = new URL("/coach/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/coach",
    "/coach/sessions/:path*",
    "/tests",
    "/tests/:path*",
    "/exercises",
    "/exercises/:path*",
  ],
};
