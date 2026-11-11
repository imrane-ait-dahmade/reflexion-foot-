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

  const isPublicCoachAuth =
    pathname === "/coach/login" || pathname === "/coach/register";
  const isCoachArea =
    pathname === "/coach" || pathname.startsWith("/coach/sessions");

  // Already signed in: skip auth forms without waiting for the page RSC.
  if (isPublicCoachAuth && hasCoachCookie) {
    return NextResponse.redirect(new URL("/coach", request.url));
  }

  if (isCoachArea && !hasCoachCookie) {
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
    "/coach/login",
    "/coach/register",
    "/coach/sessions/:path*",
    "/tests",
    "/tests/:path*",
    "/exercises",
    "/exercises/:path*",
  ],
};
