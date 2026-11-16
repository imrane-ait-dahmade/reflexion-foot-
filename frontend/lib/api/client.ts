/**
 * Centralized FastAPI HTTP client (native fetch).
 * Auth: Bearer JWT for staff (`auth`) or player session (`player`).
 */

import {
  DEFAULT_API_TIMEOUT_MS,
  getApiBaseUrl,
} from "@/lib/api/config";
import { endpoints } from "@/lib/api/endpoints";
import {
  ApiError,
  apiErrorFromResponse,
  networkApiError,
} from "@/lib/api/errors";
import { tokenStore, type AuthScope } from "@/lib/api/token-store";
import type { RefreshRequest, TokenResponse } from "@/lib/api/types";

export type ApiAuthMode = AuthScope | "none";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body (ignored when formData is set). */
  body?: unknown;
  /** Multipart body (e.g. Excel import). */
  formData?: FormData;
  query?: Record<
    string,
    string | number | boolean | null | undefined
  >;
  auth?: ApiAuthMode;
  /** Override bearer token for this request. */
  accessToken?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Skip one automatic staff refresh retry on 401. */
  skipRefreshRetry?: boolean;
};

function buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
  const base = getApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const origin =
    base ||
    (typeof window !== "undefined"
      ? window.location.origin
      : DEFAULT_API_FALLBACK_ORIGIN);
  const url = path.startsWith("http")
    ? new URL(path)
    : new URL(normalized, `${origin}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

const DEFAULT_API_FALLBACK_ORIGIN = "http://127.0.0.1:3000";

function mergeSignals(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  external?.addEventListener("abort", onAbort);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    },
  };
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshStaffAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokenStore.getStaffRefreshToken();
    if (!refreshToken) return null;

    const payload: RefreshRequest = { refresh_token: refreshToken };
    const { signal, cleanup } = mergeSignals(undefined, DEFAULT_API_TIMEOUT_MS);
    try {
      const response = await fetch(buildUrl(endpoints.auth.refresh), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      });
      const data = await parseBody(response);
      if (!response.ok) {
        tokenStore.clearStaffTokens();
        return null;
      }
      const tokens = data as TokenResponse;
      tokenStore.setStaffTokens(tokens.access_token, tokens.refresh_token);
      return tokens.access_token;
    } catch {
      return null;
    } finally {
      cleanup();
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    formData,
    query,
    auth = "none",
    accessToken,
    headers: extraHeaders,
    signal,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    skipRefreshRetry = false,
  } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };

  const token =
    accessToken === undefined
      ? auth === "none"
        ? null
        : tokenStore.getAccessToken(auth)
      : accessToken;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: BodyInit | undefined;
  if (formData) {
    requestBody = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const { signal: abortSignal, cleanup } = mergeSignals(signal, timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: requestBody,
        signal: abortSignal,
      });
    } catch (cause) {
      throw networkApiError(cause);
    }

    if (
      response.status === 401 &&
      auth === "staff" &&
      !skipRefreshRetry &&
      !path.includes("/auth/refresh") &&
      !path.includes("/auth/login")
    ) {
      const next = await refreshStaffAccessToken();
      if (next) {
        return apiRequest<T>(path, {
          ...options,
          accessToken: next,
          skipRefreshRetry: true,
        });
      }
    }

    const data = await parseBody(response);
    if (!response.ok) {
      throw apiErrorFromResponse(response.status, data);
    }
    return data as T;
  } finally {
    cleanup();
  }
}

/** Convenience helpers */
export const apiClient = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body" | "formData">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "POST", body }),

  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(
    path: string,
    options?: Omit<ApiRequestOptions, "method" | "body" | "formData">,
  ) => apiRequest<T>(path, { ...options, method: "DELETE" }),

  postForm: <T>(
    path: string,
    formData: FormData,
    options?: Omit<ApiRequestOptions, "method" | "body" | "formData">,
  ) => apiRequest<T>(path, { ...options, method: "POST", formData }),
};

export { ApiError };
