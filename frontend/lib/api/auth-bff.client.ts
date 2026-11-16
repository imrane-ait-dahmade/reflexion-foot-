/**
 * Browser client for the Auth BFF (httpOnly cookies).
 * Does NOT store JWTs in localStorage — tokens stay on the server response Set-Cookie.
 * Parallel to `authService` until cutover is approved.
 */

import type { UserResponse } from "@/lib/api/types";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/auth-bff/constants";

export type BffAuthSession = {
  user: UserResponse;
  expires_in: number;
  token_type: string;
};

function readCsrfFromDocument(): string {
  if (typeof document === "undefined") return "";
  const prefix = `${CSRF_COOKIE}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!match) return "";
  return decodeURIComponent(match.slice(prefix.length));
}

async function ensureCsrf(): Promise<string> {
  const existing = readCsrfFromDocument();
  if (existing) return existing;
  const res = await fetch("/api/bff/auth/csrf", { credentials: "same-origin" });
  const data = (await res.json()) as { csrf_token?: string };
  return data.csrf_token ?? readCsrfFromDocument();
}

async function bffFetch<T>(
  path: string,
  init: RequestInit & { csrf?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.csrf) {
    const token = await ensureCsrf();
    headers.set(CSRF_HEADER, token);
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : `BFF error ${response.status}`,
    );
  }
  return data;
}

/** Opt-in BFF auth helpers — Better Auth + localStorage authService remain default. */
export const authBffClient = {
  ensureCsrf,

  login(email: string, password: string): Promise<BffAuthSession> {
    return bffFetch<BffAuthSession>("/api/bff/auth/login", {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ email, password }),
    });
  },

  refresh(): Promise<BffAuthSession> {
    return bffFetch<BffAuthSession>("/api/bff/auth/refresh", {
      method: "POST",
      csrf: true,
    });
  },

  async logout(): Promise<void> {
    await bffFetch<{ ok: boolean }>("/api/bff/auth/logout", {
      method: "POST",
      csrf: true,
    });
  },

  me(): Promise<{ user: UserResponse | null }> {
    return bffFetch<{ user: UserResponse | null }>("/api/bff/auth/me", {
      method: "GET",
    });
  },
};
