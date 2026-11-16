/**
 * FastAPI backend configuration for Cognitif Connexion Foot V2.
 * Public base URL only — never put secrets in NEXT_PUBLIC_* vars.
 */

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

/** Default local FastAPI URL (uvicorn). Overridden by NEXT_PUBLIC_API_URL. */
export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

/**
 * API origin for `lib/api` fetch calls.
 * In the browser, default to same-origin so Next.js can rewrite `/api/v1/*`
 * to FastAPI (see `next.config.ts`) and avoid CORS without changing the backend.
 * Set `NEXT_PUBLIC_API_DIRECT=true` to call `NEXT_PUBLIC_API_URL` directly.
 */
export function getApiBaseUrl(): string {
  const direct =
    process.env.NEXT_PUBLIC_API_DIRECT?.trim().toLowerCase() === "true";
  if (typeof window !== "undefined" && !direct) {
    return "";
  }
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return DEFAULT_API_BASE_URL;
}

/** API v1 prefix — mirrors backend `API_V1_PREFIX` default. */
export const API_V1_PREFIX = "/api/v1";

export function getApiV1BaseUrl(): string {
  return `${getApiBaseUrl()}${API_V1_PREFIX}`;
}

/** Default request timeout (ms). */
export const DEFAULT_API_TIMEOUT_MS = 30_000;
