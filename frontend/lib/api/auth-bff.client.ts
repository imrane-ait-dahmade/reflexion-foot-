/**
 * Browser client for the Auth BFF (httpOnly cookies + tokenStore for apiClient).
 */

import type { UserResponse } from "@/lib/api/types";
import { notifyStaffTokenChange } from "@/lib/api/staff-token-events";
import { tokenStore } from "@/lib/api/token-store";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/auth-bff/constants";

export type BffAuthSession = {
  user: UserResponse;
  expires_in: number;
  token_type: string;
  access_token: string;
  refresh_token: string;
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

function hydrateTokenStore(session: BffAuthSession) {
  tokenStore.setStaffTokens(session.access_token, session.refresh_token);
  notifyStaffTokenChange();
}

/** Primary coach auth client (FastAPI BFF). */
export const authBffClient = {
  ensureCsrf,

  async login(email: string, password: string): Promise<BffAuthSession> {
    const session = await bffFetch<BffAuthSession>("/api/bff/auth/login", {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ email, password }),
    });
    hydrateTokenStore(session);
    return session;
  },

  async register(
    fullName: string,
    email: string,
    password: string,
  ): Promise<BffAuthSession> {
    const session = await bffFetch<BffAuthSession>("/api/bff/auth/register", {
      method: "POST",
      csrf: true,
      body: JSON.stringify({
        full_name: fullName,
        email,
        password,
      }),
    });
    hydrateTokenStore(session);
    return session;
  },

  async refresh(): Promise<BffAuthSession> {
    const session = await bffFetch<BffAuthSession>("/api/bff/auth/refresh", {
      method: "POST",
      csrf: true,
    });
    hydrateTokenStore(session);
    return session;
  },

  async logout(): Promise<void> {
    try {
      await bffFetch<{ ok: boolean }>("/api/bff/auth/logout", {
        method: "POST",
        csrf: true,
      });
    } finally {
      tokenStore.clearStaffTokens();
      notifyStaffTokenChange();
    }
  },

  me(): Promise<{ user: UserResponse | null }> {
    return bffFetch<{ user: UserResponse | null }>("/api/bff/auth/me", {
      method: "GET",
    });
  },
};
