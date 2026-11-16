import { afterEach, describe, expect, it, vi } from "vitest";
import {
  csrfCookieOptions,
  staffAccessCookieOptions,
  staffRefreshCookieOptions,
} from "@/lib/server/auth/cookies";
import { csrfTokensMatch, generateCsrfToken } from "@/lib/server/auth/csrf";

describe("auth BFF cookie options", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("marks staff tokens httpOnly", () => {
    expect(staffAccessCookieOptions(900).httpOnly).toBe(true);
    expect(staffRefreshCookieOptions().httpOnly).toBe(true);
    expect(staffRefreshCookieOptions().path).toBe("/api/bff/auth");
  });

  it("keeps CSRF cookie readable for double-submit", () => {
    expect(csrfCookieOptions().httpOnly).toBe(false);
  });

  it("sets SameSite=Lax on auth cookies", () => {
    expect(staffAccessCookieOptions(900).sameSite).toBe("lax");
    expect(staffRefreshCookieOptions().sameSite).toBe("lax");
    expect(csrfCookieOptions().sameSite).toBe("lax");
  });

  it("enables Secure in production NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(staffAccessCookieOptions(900).secure).toBe(true);
    expect(staffRefreshCookieOptions().secure).toBe(true);
    expect(csrfCookieOptions().secure).toBe(true);
  });

  it("disables Secure outside production (local HTTP)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(staffAccessCookieOptions(900).secure).toBe(false);
    expect(staffRefreshCookieOptions().secure).toBe(false);
  });
});

describe("csrf helpers", () => {
  it("accepts matching double-submit tokens", () => {
    const token = generateCsrfToken();
    expect(csrfTokensMatch(token, token)).toBe(true);
    expect(csrfTokensMatch(token, generateCsrfToken())).toBe(false);
  });
});
