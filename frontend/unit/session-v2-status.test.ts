import { describe, expect, it } from "vitest";
import { formatSessionStatus } from "@/lib/format";
import {
  canCancelSession,
  isSessionClosedTab,
  isSessionJoinable,
  isSessionOpenTab,
  mapSessionToListItem,
} from "@/lib/sessions/v2-status";
import type { SessionResponse } from "@/lib/api/types";

describe("V2 session status helpers", () => {
  it("maps joinable and tab filters", () => {
    expect(isSessionJoinable("in_progress")).toBe(true);
    expect(isSessionJoinable("draft")).toBe(false);
    expect(isSessionOpenTab("draft")).toBe(true);
    expect(isSessionClosedTab("completed")).toBe(true);
    expect(canCancelSession("cancelled")).toBe(false);
  });

  it("formats V2 statuses for display", () => {
    expect(formatSessionStatus("in_progress")).toBe("ouverte");
    expect(formatSessionStatus("completed")).toBe("terminée");
    expect(formatSessionStatus("cancelled")).toBe("annulée");
  });

  it("maps SessionResponse to list item", () => {
    const session = {
      id: "s1",
      title: "Séance 1",
      session_code: "ABC123",
      status: "in_progress",
      team_id: null,
      created_by: "u1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      players: [
        {
          id: "sp1",
          player_id: "p1",
          status: "completed",
          joined_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "sp2",
          player_id: "p2",
          status: "joined",
          joined_at: "2026-01-01T00:00:00Z",
        },
      ],
      exercises: [
        { id: "e1", cognitive_test_id: "t1", display_order: 0 },
        { id: "e2", cognitive_test_id: "t2", display_order: 1 },
      ],
    } as SessionResponse;

    const item = mapSessionToListItem(session);
    expect(item.code).toBe("ABC123");
    expect(item.exerciseCount).toBe(2);
    expect(item.playerCount).toBe(2);
    expect(item.completedPlayers).toBe(1);
  });
});
