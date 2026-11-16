import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { ApiError, isApiError } from "@/lib/api/errors";
import { tokenStore } from "@/lib/api/token-store";

const fetchMock = vi.fn();

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    tokenStore.clearAll();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses JSON success responses", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, id: "1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const data = await apiRequest<{ ok: boolean; id: string }>("/api/v1/health-like", {
      auth: "none",
    });

    expect(data).toEqual({ ok: true, id: "1" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(init.headers.Accept).toBe("application/json");
  });

  it("serializes JSON bodies and attaches staff bearer tokens", async () => {
    tokenStore.setStaffTokens("access-abc", "refresh-xyz");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "u1" }), { status: 201 }),
    );

    await apiRequest("/api/v1/users", {
      method: "POST",
      auth: "staff",
      body: { email: "a@b.com", password: "password1" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer access-abc");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.com",
      password: "password1",
    });
  });

  it("maps FastAPI error bodies to ApiError", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Missing bearer token", code: "auth" }), {
        status: 401,
      }),
    );

    await expect(
      apiRequest("/api/v1/auth/me", { auth: "staff", skipRefreshRetry: true }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "authentication_error",
      message: "Missing bearer token",
      backendCode: "auth",
    });
  });

  it("maps network failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    try {
      await apiRequest("/api/v1/sessions", { auth: "none" });
      expect.fail("should throw");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect((error as ApiError).code).toBe("network_error");
    }
  });

  it("refreshes staff access token once on 401", async () => {
    tokenStore.setStaffTokens("old-access", "refresh-token");

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "expired" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            token_type: "bearer",
            expires_in: 900,
            user: {
              id: "1",
              full_name: "Coach",
              email: "c@example.com",
              is_active: true,
              roles: ["coach"],
              permissions: [],
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );

    const data = await apiRequest<{ items: unknown[] }>("/api/v1/sessions", {
      auth: "staff",
    });

    expect(data).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStore.getStaffAccessToken()).toBe("new-access");
    expect(tokenStore.getStaffRefreshToken()).toBe("new-refresh");
    const lastInit = fetchMock.mock.calls[2][1];
    expect(lastInit.headers.Authorization).toBe("Bearer new-access");
  });

  it("sends FormData without forcing JSON content-type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ total_rows: 1 }), { status: 200 }),
    );
    const formData = new FormData();
    formData.append("file", new Blob(["x"]), "players.xlsx");

    await apiRequest("/api/v1/players/import/preview", {
      method: "POST",
      auth: "staff",
      formData,
      accessToken: "tok",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(formData);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});
