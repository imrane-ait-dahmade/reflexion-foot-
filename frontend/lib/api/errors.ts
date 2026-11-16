/**
 * Typed FastAPI client errors.
 * Backend AppError handlers typically return `{ detail: string, code?: string }`.
 * FastAPI validation errors may return `{ detail: ValidationIssue[] | string }`.
 */

export type ApiErrorCode =
  | "validation_error"
  | "authentication_error"
  | "authorization_error"
  | "not_found"
  | "conflict"
  | "server_error"
  | "network_error"
  | "timeout"
  | "unknown";

export type ValidationIssue = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
  [key: string]: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly backendCode: string | null;
  readonly details: unknown;

  constructor(options: {
    message: string;
    status: number;
    code: ApiErrorCode;
    backendCode?: string | null;
    details?: unknown;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.backendCode = options.backendCode ?? null;
    this.details = options.details ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function mapStatusToCode(status: number): ApiErrorCode {
  if (status === 401) return "authentication_error";
  if (status === 403) return "authorization_error";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_error";
  if (status >= 500) return "server_error";
  return "unknown";
}

type BackendErrorBody = {
  detail?: unknown;
  code?: unknown;
};

function detailToMessage(detail: unknown): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const parts = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const msg = (item as ValidationIssue).msg;
          return typeof msg === "string" ? msg : null;
        }
        return null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  return "Request failed";
}

export function apiErrorFromResponse(
  status: number,
  body: unknown,
  fallbackMessage?: string,
): ApiError {
  const payload =
    body && typeof body === "object" ? (body as BackendErrorBody) : null;
  const message =
    (payload ? detailToMessage(payload.detail) : null) ||
    fallbackMessage ||
    `HTTP ${status}`;
  const backendCode =
    payload && typeof payload.code === "string" ? payload.code : null;

  return new ApiError({
    message,
    status,
    code: mapStatusToCode(status),
    backendCode,
    details: payload?.detail ?? body,
  });
}

export function networkApiError(cause?: unknown): ApiError {
  const message =
    cause instanceof Error && cause.name === "AbortError"
      ? "Request timed out or was cancelled"
      : "Network error — cannot reach the API";
  return new ApiError({
    message,
    status: 0,
    code: cause instanceof Error && cause.name === "AbortError" ? "timeout" : "network_error",
    details: cause instanceof Error ? cause.message : cause,
  });
}
