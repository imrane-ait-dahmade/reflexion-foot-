/**
 * Server-only FastAPI origin for BFF routes.
 * Prefer FASTAPI_PROXY_TARGET / server env — never expose JWT secrets here.
 */

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getServerFastApiBaseUrl(): string {
  const fromEnv =
    process.env.FASTAPI_PROXY_TARGET?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";
  if (fromEnv) return trimTrailingSlash(fromEnv);
  return "http://127.0.0.1:8000";
}

export const BFF_API_TIMEOUT_MS = 30_000;
