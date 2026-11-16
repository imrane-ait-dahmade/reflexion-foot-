import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/server/auth/cookies";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function csrfTokensMatch(cookieToken: string, headerToken: string): boolean {
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(hashToken(cookieToken));
  const b = Buffer.from(hashToken(headerToken));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Validate double-submit CSRF for mutating BFF auth routes.
 * Safe methods skip validation.
 */
export async function assertCsrf(request: Request): Promise<void> {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const jar = await cookies();
  const cookieToken = jar.get(CSRF_COOKIE)?.value ?? "";
  const headerToken = request.headers.get(CSRF_HEADER) ?? "";
  if (!csrfTokensMatch(cookieToken, headerToken)) {
    throw new CsrfError();
  }
}

export class CsrfError extends Error {
  readonly status = 403;
  constructor() {
    super("Invalid CSRF token");
    this.name = "CsrfError";
  }
}
