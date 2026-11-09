import { describe, expect, it } from "vitest";
import {
  applySelection,
  initialSearchState,
  type SearchState,
} from "@/lib/tests/sequential-visual-search/engine";
import {
  circleSlots,
  layoutForSession,
  SEQUENTIAL_TOTAL,
  shuffleNumbers,
} from "@/lib/tests/sequential-visual-search/layout";
import { studyForSlug } from "@/lib/ai-analysis/study-references";
import { metricCatalog, numericMetrics } from "@/lib/ai-analysis/metrics-context";
import {
  buildSequentialResult,
  sequentialHeadline,
  sequentialResultLines,
  sequentialSubmissionError,
} from "@/lib/tests/sequential-visual-search/result";

const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4222-8222-222222222222";

function play(numbers: number[], times: number[] = []) {
  let state = initialSearchState();
  numbers.forEach((number, index) => {
    state = applySelection(state, number, times[index] ?? (index + 1) * 100).state;
  });
  return state;
}

function ordered(errorsAt?: { before: number; value: number }[]) {
  const clicks: number[] = [];
  for (let number = 1; number <= SEQUENTIAL_TOTAL; number += 1) {
    const extra = errorsAt?.filter((item) => item.before === number) ?? [];
    extra.forEach((item) => clicks.push(item.value));
    clicks.push(number);
  }
  return clicks;
}

describe("sequential visual search layout", () => {
  it("contains each number from 1 to 50 once", () => {
    const numbers = shuffleNumbers(SESSION_A);
    expect(numbers).toHaveLength(50);
    expect(new Set(numbers).size).toBe(50);
    expect([...numbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
  });

  it("keeps the same layout for every player in one session", () => {
    expect(layoutForSession(SESSION_A)).toEqual(layoutForSession(SESSION_A));
  });

  it("can give another session a different layout", () => {
    expect(layoutForSession(SESSION_A).map((slot) => slot.number)).not.toEqual(
      layoutForSession(SESSION_B).map((slot) => slot.number),
    );
  });

  it("keeps fixed slots apart and inside the circle", () => {
    const slots = circleSlots();
    expect(slots).toHaveLength(50);
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThan(10);
      expect(slot.x).toBeLessThan(90);
      expect(slot.y).toBeGreaterThan(10);
      expect(slot.y).toBeLessThan(90);
    }
    let closest = Infinity;
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const dx = slots[i].x - slots[j].x;
        const dy = slots[i].y - slots[j].y;
        closest = Math.min(closest, Math.hypot(dx, dy));
      }
    }
    expect(closest).toBeGreaterThan(8);
  });
});

describe("sequential visual search play", () => {
  it("accepts 1 first and rejects 2 before 1", () => {
    const early = applySelection(initialSearchState(), 2, 100);
    expect(early.kind).toBe("wrong");
    expect(early.state.errors).toBe(1);
    expect(early.state.target).toBe(1);
    const first = applySelection(early.state, 1, 200);
    expect(first.kind).toBe("correct");
    expect(first.state.target).toBe(2);
    expect(first.state.found).toBe(1);
  });

  it("advances only the current target and ignores a second click", () => {
    const first = applySelection(initialSearchState(), 1, 100).state;
    const duplicate = applySelection(first, 1, 150);
    expect(duplicate.kind).toBe("ignored");
    expect(duplicate.state).toEqual(first);
    const second = applySelection(first, 2, 200);
    expect(second.state.target).toBe(3);
    expect(second.state.found).toBe(2);
  });

  it("does not skip a target when clicks arrive in a burst", () => {
    let state = initialSearchState();
    const burst = [1, 3, 2, 2, 4];
    const kinds = burst.map((number, index) => {
      const outcome = applySelection(state, number, (index + 1) * 20);
      state = outcome.state;
      return outcome.kind;
    });
    expect(kinds).toEqual(["correct", "wrong", "correct", "ignored", "wrong"]);
    expect(state.target).toBe(3);
    expect(state.found).toBe(2);
    expect(state.errors).toBe(2);
    expect(state.completed).toBe(false);
  });

  it("completes only after 1 through 50 and freezes the time", () => {
    const finished = play(ordered());
    expect(finished.completed).toBe(true);
    expect(finished.found).toBe(50);
    expect(finished.completionTimeMs).toBe(5000);
    const after = applySelection(finished, 50, 99999);
    expect(after.kind).toBe("ignored");
    expect(after.state.completionTimeMs).toBe(5000);
    const partial = play([1, 2, 3]);
    expect(buildSequentialResult(partial)).toBeNull();
  });

  it("stores time, errors and accuracy for the right player without a speed score", () => {
    const finished = play(ordered([{ before: 4, value: 9 }]));
    const result = buildSequentialResult(finished);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.duration).toBe(finished.completionTimeMs);
    expect(result.errors).toBe(1);
    expect(result.correctAnswers).toBe(50);
    expect(result.accuracy).toBeCloseTo((50 / 51) * 100, 1);
    expect(result.score).toBe(Math.round(result.accuracy));
    expect(result.metrics.completionStatus).toBe("completed");
    const saved = {
      sessionPlayerId: "player-a",
      sessionId: SESSION_A,
      testSlug: "sequential-visual-search" as const,
      ...result,
    };
    expect(saved.sessionPlayerId).toBe("player-a");
    expect(saved.sessionId).toBe(SESSION_A);
    expect(sequentialSubmissionError({
      score: result.score,
      accuracy: result.accuracy,
      correctAnswers: result.correctAnswers,
      errors: result.errors,
      durationMs: result.duration,
      metrics: result.metrics,
    })).toBeNull();
    expect(sequentialSubmissionError({
      ...result,
      durationMs: result.duration,
      metrics: { ...result.metrics, completionStatus: "abandoned" },
    })).toBe("Exercice incomplet.");
  });

  it("lets two players finish the same layout independently", () => {
    const layout = layoutForSession(SESSION_A);
    const playerA = play(ordered());
    const playerB = play(ordered([{ before: 1, value: 8 }]));
    expect(layoutForSession(SESSION_A)).toEqual(layout);
    expect(playerA.errors).toBe(0);
    expect(playerB.errors).toBe(1);
    expect(playerA.completionTimeMs).not.toBe(playerB.completionTimeMs);
  });
});

describe("coach display", () => {
  it("shows time, errors and accuracy instead of a speed score", () => {
    const state: SearchState = {
      target: 51,
      found: 50,
      errors: 2,
      completed: true,
      completionTimeMs: 82500,
    };
    const result = buildSequentialResult(state);
    if (!result) throw new Error("expected result");
    const lines = sequentialResultLines({
      errors: result.errors,
      accuracy: result.accuracy,
      durationMs: result.duration,
      completedAt: "2026-11-09T18:05:00.000Z",
      metrics: result.metrics,
    });
    expect(lines?.map((line) => line.label)).toEqual([
      "Temps",
      "Erreurs",
      "Précision",
      "Nombres",
      "Terminé",
    ]);
    expect(sequentialHeadline(result.metrics)).toBe("82.5 s");
    expect(studyForSlug("sequential-visual-search")?.useRule).toContain(
      "Ne compare le temps",
    );
    const catalog = metricCatalog([
      {
        testResultId: "r1",
        testSlug: "sequential-visual-search",
        score: result.score,
        accuracy: result.accuracy,
        correctAnswers: 50,
        errors: result.errors,
        averageReactionMs: 0,
        bestReactionMs: 0,
        durationMs: result.duration,
        metrics: numericMetrics(result.metrics),
        completedAt: "2026-11-09T18:05:00.000Z",
      },
    ]);
    expect(catalog.map((item) => item.key)).toContain("completionTimeMs");
    expect(lines?.find((line) => line.label === "Erreurs")?.value).toBe("2");
  });
});
