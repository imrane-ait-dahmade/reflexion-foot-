import {
  CSRF_COOKIE,
  CSRF_HEADER,
  STAFF_ACCESS_COOKIE,
  STAFF_REFRESH_COOKIE,
} from "@/lib/auth-bff/constants";

export {
  CSRF_COOKIE,
  CSRF_HEADER,
  STAFF_ACCESS_COOKIE,
  STAFF_REFRESH_COOKIE,
};

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function staffAccessCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, maxAgeSeconds),
  };
}

export function staffRefreshCookieOptions(
  maxAgeSeconds = 60 * 60 * 24 * 14,
): CookieOptions {
  // Path `/` so RSC `requireCoach()` can rotate after access JWT expiry
  // (browser would not send a path-scoped `/api/bff/auth` cookie on `/coach`).
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, maxAgeSeconds),
  };
}

export function csrfCookieOptions(maxAgeSeconds = 60 * 60 * 8): CookieOptions {
  return {
    httpOnly: false,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, maxAgeSeconds),
  };
}

export function clearCookieOptions(path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path,
    maxAge: 0,
  };
}
