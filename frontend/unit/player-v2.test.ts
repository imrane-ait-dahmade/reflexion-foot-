import { describe, expect, it } from "vitest";
import { mapPlayerProgress } from "@/lib/sessions/player-v2";
import type { PlayerSessionProgressResponse } from "@/lib/api/types";

describe("mapPlayerProgress", () => {
  it("maps FastAPI progress to play hub view", () => {
    const progress = {
      session_id: "s1",
      session_title: "Session #2026-001",
      session_status: "in_progress",
      participation_status: "in_progress",
      current_display_order: 1,
      completed_count: 1,
      remaining_count: 1,
      exercises: [
        {
          session_exercise_id: "e1",
          cognitive_test_id: "t1",
          display_order: 0,
          slug: "visual-tracking",
          name: "Suivi",
          attempt_status: "completed",
          completed: true,
        },
        {
          session_exercise_id: "e2",
          cognitive_test_id: "t2",
          display_order: 1,
          slug: "reaction-time",
          name: "Réaction",
          attempt_status: null,
          completed: false,
        },
      ],
    } as PlayerSessionProgressResponse;

    const view = mapPlayerProgress(progress, "ABC123");
    expect(view.session.code).toBe("ABC123");
    expect(view.nextExercise).toBe("reaction-time");
    expect(view.completedCount).toBe(1);
    expect(view.allDone).toBe(false);
  });
});
