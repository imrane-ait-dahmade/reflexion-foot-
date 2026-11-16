import {
  BFF_API_TIMEOUT_MS,
  getServerFastApiBaseUrl,
} from "@/lib/server/backend/config";

export type ServerFastApiOptions = {
  method?: string;
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  formData?: FormData;
};

export class ServerFastApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ServerFastApiError";
    this.status = status;
    this.details = details ?? null;
  }
}

function buildUrl(path: string): string {
  const base = getServerFastApiBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${base}/`).toString();
}

export async function serverFastApiFetch<T>(
  path: string,
  options: ServerFastApiOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    accessToken,
    signal,
    timeoutMs = BFF_API_TIMEOUT_MS,
    formData,
  } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let requestBody: BodyInit | undefined;
  if (formData) {
    requestBody = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    let response: Response;
    try {
      response = await fetch(buildUrl(path), {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (cause) {
      throw new ServerFastApiError(
        503,
        cause instanceof Error ? cause.message : "FastAPI unreachable",
      );
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const detail =
        data && typeof data === "object" && data !== null && "detail" in data
          ? (data as { detail: unknown }).detail
          : data;
      const message =
        typeof detail === "string"
          ? detail
          : `FastAPI error (${response.status})`;
      throw new ServerFastApiError(response.status, message, data);
    }

    return data as T;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
