import { beforeEach, describe, expect, it, vi } from "vitest";
import { authService } from "@/lib/api/auth.service";
import { exercisesService } from "@/lib/api/exercises.service";
import { playersService } from "@/lib/api/players.service";
import { reportsService } from "@/lib/api/reports.service";
import { resultsService } from "@/lib/api/results.service";
import { sessionsService } from "@/lib/api/sessions.service";
import { tokenStore } from "@/lib/api/token-store";

const fetchMock = vi.fn();

describe("api services", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    tokenStore.clearAll();
    fetchMock.mockReset();
  });

  it("authService.login stores staff tokens", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "a1",
          refresh_token: "r1",
          token_type: "bearer",
          expires_in: 900,
          user: {
            id: "u1",
            full_name: "Ada",
            email: "ada@example.com",
            is_active: true,
            roles: ["coach"],
            permissions: ["sessions.view"],
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await authService.login({
      email: "ada@example.com",
      password: "password12",
    });

    expect(result.access_token).toBe("a1");
    expect(tokenStore.getStaffAccessToken()).toBe("a1");
    expect(tokenStore.getStaffRefreshToken()).toBe("r1");
  });

  it("playersService.list hits the players collection", async () => {
    tokenStore.setStaffTokens("tok", "ref");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ items: [], total: 0, page: 1, page_size: 20 }),
        { status: 200 },
      ),
    );

    const list = await playersService.list({ page: 1, search: "amine" });
    expect(list.total).toBe(0);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/players");
    expect(String(url)).toContain("search=amine");
  });

  it("sessionsService.playerJoin stores player token", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "player-jwt",
          token_type: "bearer",
          expires_in: 14400,
          session_id: "s1",
          player_id: "p1",
          session_player_id: "sp1",
          session_title: "Séance",
        }),
        { status: 200 },
      ),
    );

    await sessionsService.playerJoin({
      personal_code: "ABCD",
      session_code: "XY12",
    });

    expect(tokenStore.getPlayerAccessToken()).toBe("player-jwt");
  });

  it("exercisesService lists cognitive tests", async () => {
    tokenStore.setStaffTokens("tok", "ref");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: "1", slug: "reaction-time", name: "RT", description: null, category: "vision", is_active: true }]), {
        status: 200,
      }),
    );

    const tests = await exercisesService.listCognitiveTests();
    expect(tests[0].slug).toBe("reaction-time");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/cognitive-tests");
  });

  it("resultsService delegates to player complete exercise", async () => {
    tokenStore.setPlayerAccessToken("player-jwt");
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          session_id: "s1",
          session_title: "Séance",
          session_status: "in_progress",
          participation_status: "in_progress",
          current_display_order: 1,
          exercises: [],
          completed_count: 1,
          remaining_count: 0,
        }),
        { status: 200 },
      ),
    );

    const progress = await resultsService.submitPlayerExercise("ex-1", {
      score: 80,
      accuracy: 80,
      response_time_ms: 400,
      result_data: {},
    });

    expect(progress.completed_count).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/v1/player/session/exercises/ex-1/complete",
    );
  });

  it("reportsService is explicitly unavailable", () => {
    expect(() => reportsService.unavailable()).toThrow(/not exposed/i);
  });
});
