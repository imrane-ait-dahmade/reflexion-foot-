import { NextRequest, NextResponse } from "next/server";
import { STAFF_ACCESS_COOKIE } from "@/lib/auth-bff/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasStaffSession = Boolean(request.cookies.get(STAFF_ACCESS_COOKIE)?.value);

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
  if (pathname === "/" && hasStaffSession) {
    return NextResponse.redirect(new URL("/coach", request.url));
  }

  const isPublicCoachAuth =
    pathname === "/coach/login" || pathname === "/coach/register";
  const isCoachArea =
    pathname === "/coach" ||
    pathname.startsWith("/coach/sessions") ||
    pathname.startsWith("/coach/players");

  if (isPublicCoachAuth && hasStaffSession) {
    return NextResponse.redirect(new URL("/coach", request.url));
  }

  if (isCoachArea && !hasStaffSession) {
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
    "/coach/players",
    "/coach/players/:path*",
    "/tests",
    "/tests/:path*",
    "/exercises",
    "/exercises/:path*",
  ],
};
