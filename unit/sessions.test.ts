import { describe, expect, it, vi } from "vitest";
import { canAcceptResult, isJoinable } from "@/lib/sessions/access";
import { generateSessionCode } from "@/lib/sessions/code";
import { SESSION_DURATION_MS, SESSION_SUBMIT_GRACE_MS } from "@/lib/sessions/config";
import {
  clearPlayerSession,
  getServerPlayerSession,
  loadPlayerSession,
  savePlayerSession,
  type PlayerSessionState,
} from "@/lib/sessions/player-session";

const now = new Date("2026-11-03T18:00:00.000Z").getTime();

describe("session access", () => {
  it("lets a player join only an active session that has not ended", () => {
    expect(
      isJoinable({ status: "active", endsAt: new Date(now + 1000) }, now),
    ).toBe(true);
    expect(isJoinable({ status: "active", endsAt: null }, now)).toBe(true);
    expect(
      isJoinable({ status: "active", endsAt: new Date(now - 1) }, now),
    ).toBe(false);
    expect(
      isJoinable({ status: "closed", endsAt: new Date(now + 1000) }, now),
    ).toBe(false);
    expect(
      isJoinable({ status: "draft", endsAt: new Date(now + 1000) }, now),
    ).toBe(false);
  });

  it("accepts a late result only inside the grace window", () => {
    const ended = new Date(now - SESSION_SUBMIT_GRACE_MS + 1000);
    const tooLate = new Date(now - SESSION_SUBMIT_GRACE_MS - 1);

    expect(canAcceptResult({ status: "active", endsAt: ended }, now)).toBe(true);
    expect(canAcceptResult({ status: "active", endsAt: tooLate }, now)).toBe(false);
    expect(
      canAcceptResult({ status: "closed", endsAt: null, updatedAt: ended }, now),
    ).toBe(true);
    expect(
      canAcceptResult(
        { status: "closed", endsAt: null, updatedAt: tooLate },
        now,
      ),
    ).toBe(false);
    expect(canAcceptResult({ status: "draft", endsAt: null }, now)).toBe(false);
    expect(
      isJoinable(
        { status: "active", endsAt: null, archivedAt: new Date(now) },
        now,
      ),
    ).toBe(false);
    expect(
      canAcceptResult(
        { status: "active", endsAt: null, archivedAt: new Date(now) },
        now,
      ),
    ).toBe(false);
  });

  it("keeps a session open for four hours", () => {
    expect(SESSION_DURATION_MS).toBe(4 * 60 * 60 * 1000);
  });
});

describe("session code", () => {
  it("uses only unambiguous characters", () => {
    for (let i = 0; i < 40; i += 1) {
      const code = generateSessionCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(code).not.toMatch(/[IO01]/);
    }
    expect(generateSessionCode(4)).toHaveLength(4);
  });
});

describe("player session storage", () => {
  it("saves, reloads the same object, and clears the code", () => {
    const memory = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
    });

    clearPlayerSession();
    expect(loadPlayerSession()).toBeNull();
    expect(getServerPlayerSession()).toBeNull();

    const state: PlayerSessionState = {
      code: "K7MQ2P",
      sessionId: "session-1",
      sessionPlayerId: "player-1",
      displayName: "Amine",
      exercises: ["visual-tracking", "football-visual-scanning"],
    };
    savePlayerSession(state);

    const first = loadPlayerSession();
    const second = loadPlayerSession();
    expect(first).toEqual(state);
    expect(second).toBe(first);

    clearPlayerSession();
    expect(loadPlayerSession()).toBeNull();
    vi.unstubAllGlobals();
  });
});
