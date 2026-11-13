import { describe, expect, it } from "vitest";
import { readChallenge } from "@/lib/tests/challenge-token";
import { DIGIT_LEVELS, DIGIT_VISIBLE_MS } from "@/lib/tests/digit-memory/config";
import {
  answerDigitSequence,
  beginDigitAttempt,
  revealNextDigit,
  type DigitToken,
} from "@/lib/tests/digit-memory/progress";
import {
  digitSequence,
  gradeDigitSequence,
  sequencesDifferAcrossLevels,
} from "@/lib/tests/digit-memory/sequence";
import { DUAL_LEVELS } from "@/lib/tests/dual-target-tracking/config";
import {
  createOrbs,
  gradeTargetSelection,
  simulateMovement,
  stepOrbs,
  targetPair,
} from "@/lib/tests/dual-target-tracking/motion";
import {
  beginDualAttempt,
  gradeDualRound,
  type DualToken,
} from "@/lib/tests/dual-target-tracking/progress";
import { isTestSlug } from "@/lib/sessions/exercises";

const SECRET = "test-secret";
const SESSION = "11111111-1111-4111-8111-111111111111";

function playDigitLevel(token: string, answer: number[] | "correct", now: number) {
  let current = token;
  let clock = now;
  const revealed: number[] = [];
  for (;;) {
    const step = revealNextDigit(current, SECRET, clock);
    if ("error" in step) throw new Error(step.error);
    revealed.push(step.digit);
    current = step.token;
    clock += DIGIT_VISIBLE_MS;
    if (step.answer) break;
  }
  const response = answer === "correct" ? revealed : answer;
  return { revealed, graded: answerDigitSequence(current, response, SECRET, clock + 500) };
}

describe("digit memory", () => {
  it("builds a valid sequence whose length matches the level", () => {
    DIGIT_LEVELS.forEach((length, index) => {
      const digits = digitSequence("seed-a", index + 1, SECRET);
      expect(digits).toHaveLength(length);
      expect(digits.every((digit) => digit >= 0 && digit <= 9)).toBe(true);
    });
    expect(sequencesDifferAcrossLevels("seed-a", SECRET)).toBe(true);
    expect(digitSequence("seed-a", 8, SECRET)).not.toEqual(digitSequence("seed-b", 8, SECRET));
  });

  it("draws a new sequence for each attempt and keeps it out of the token", () => {
    const first = beginDigitAttempt("player-a", SESSION, 1_000, SECRET);
    const second = beginDigitAttempt("player-b", SESSION, 1_000, SECRET);
    const firstToken = readChallenge<DigitToken>(first, SECRET);
    const secondToken = readChallenge<DigitToken>(second, SECRET);
    expect(firstToken?.seed).toBeTruthy();
    expect(firstToken?.seed).not.toBe(secondToken?.seed);
    const firstPlay = playDigitLevel(first, "correct", 1_000);
    expect(firstPlay.revealed).toEqual(digitSequence(firstToken!.seed, 1, SECRET));
    expect(JSON.stringify(firstToken)).not.toContain(firstPlay.revealed.join(","));
    expect(firstToken && "sequence" in firstToken).toBe(false);
  });

  it("accepts the exact sequence and rejects a position error", () => {
    const expected = [1, 2, 3];
    expect(gradeDigitSequence(expected, [1, 2, 3]).exact).toBe(true);
    const wrong = gradeDigitSequence(expected, [1, 3, 2]);
    expect(wrong.exact).toBe(false);
    expect(wrong.positional).toBe(1);
    expect(wrong.positionErrors).toBe(2);

    const token = beginDigitAttempt("player-a", SESSION, 1_000, SECRET);
    const correct = playDigitLevel(token, "correct", 1_000);
    expect(correct.graded).toMatchObject({ exact: true, finished: false, level: 2 });
    const failed = playDigitLevel(token, [9, 9, 9], 1_000);
    if (!("finished" in failed.graded) || !failed.graded.finished) {
      throw new Error("expected the exercise to stop");
    }
    expect(failed.graded.result.metrics.maximumDigitsMemorized).toBe(0);
    expect(failed.graded.result.metrics.incorrectSequences).toBe(1);
    expect(failed.graded.result.metrics.levelsCompleted).toBe(0);
  });

  it("records the longest correct sequence and refuses an early digit", () => {
    let token = beginDigitAttempt("player-a", SESSION, 1_000, SECRET);
    let now = 1_000;
    for (let level = 1; level <= 2; level += 1) {
      const played = playDigitLevel(token, "correct", now);
      if (!("token" in played.graded) || !played.graded.token || played.graded.finished) {
        throw new Error("expected another level");
      }
      token = played.graded.token;
      now += 20_000;
    }
    const failed = playDigitLevel(token, [0, 0, 0, 0, 0], now);
    if (!("result" in failed.graded) || !failed.graded.result) {
      throw new Error("expected a result");
    }
    expect(failed.graded.result.metrics.maximumDigitsMemorized).toBe(4);
    expect(failed.graded.result.metrics.levelsCompleted).toBe(2);
    const early = revealNextDigit(beginDigitAttempt("player-a", SESSION, 5_000, SECRET), SECRET, 5_000);
    if ("error" in early) throw new Error(early.error);
    const tooSoon = revealNextDigit(early.token, SECRET, 5_000 + 100);
    expect("error" in tooSoon && tooSoon.error).toBe("Trop tôt.");
  });
});

describe("dual target tracking", () => {
  it("creates the configured objects and exactly two stable targets", () => {
    DUAL_LEVELS.forEach((level, index) => {
      const orbs = createOrbs(SESSION, index + 1);
      const targets = targetPair("seed-a", index + 1, SECRET);
      expect(orbs).toHaveLength(level.objects);
      expect(new Set(orbs.map((orb) => orb.id)).size).toBe(level.objects);
      expect(targets).toHaveLength(2);
      expect(targets[0]).not.toBe(targets[1]);
      expect(targetPair("seed-a", index + 1, SECRET)).toEqual(targets);
    });
    const pairs = (seed: string) =>
      DUAL_LEVELS.map((_, index) => targetPair(seed, index + 1, SECRET).join(",")).join("|");
    expect(pairs("seed-a")).not.toBe(pairs("seed-b"));
  });

  it("keeps identities and positions inside the area while moving", () => {
    const start = createOrbs(SESSION, 3);
    const moved = simulateMovement(start, 8000);
    expect(moved.map((orb) => orb.id)).toEqual(start.map((orb) => orb.id));
    for (const orb of moved) {
      expect(orb.x).toBeGreaterThanOrEqual(0.045);
      expect(orb.x).toBeLessThanOrEqual(0.955);
      expect(orb.y).toBeGreaterThanOrEqual(0.045);
      expect(orb.y).toBeLessThanOrEqual(0.955);
    }
    expect(stepOrbs(start, 0.016).map((orb) => orb.id)).toEqual(start.map((orb) => orb.id));
  });

  it("scores both, one, or neither target and rejects a duplicate", () => {
    const targets = targetPair("seed-a", 1, SECRET);
    expect(gradeTargetSelection(targets, [...targets]).both).toBe(true);
    const partial = gradeTargetSelection(targets, [targets[0], 99]);
    expect(partial).toMatchObject({
      correctlyIdentifiedTargets: 1,
      missedTargets: 1,
      incorrectSelections: 1,
      both: false,
    });
    expect(gradeTargetSelection(targets, [80, 81])).toMatchObject({
      correctlyIdentifiedTargets: 0,
      both: false,
    });
    const duplicate = gradeTargetSelection(targets, [targets[0], targets[0]]);
    expect("error" in duplicate && duplicate.error).toBe(
      "Sélectionne deux cibles différentes.",
    );
  });

  it("draws new targets for each attempt and scores each player alone", () => {
    const first = beginDualAttempt("player-a", SESSION, 10_000, SECRET);
    const second = beginDualAttempt("player-b", SESSION, 10_000, SECRET);
    const firstToken = readChallenge<DualToken>(first.token, SECRET);
    const secondToken = readChallenge<DualToken>(second.token, SECRET);
    expect(firstToken?.seed).not.toBe(secondToken?.seed);
    const targets: number[] = first.challenge?.highlightIds ?? [];
    const wrong = [0, 1, 2, 3].filter((id) => !second.challenge?.highlightIds.includes(id)).slice(0, 2);
    const readyAt = 10_000 + 2000 + DUAL_LEVELS[0].durationMs;
    const good = gradeDualRound(first.token, targets, SECRET, readyAt);
    const bad = gradeDualRound(second.token, wrong, SECRET, readyAt);
    expect(good).toMatchObject({ finished: false, correctlyIdentifiedTargets: 2 });
    expect(bad).toMatchObject({ finished: false, correctlyIdentifiedTargets: 0 });
  });
});

describe("catalogue", () => {
  it("registers both new exercises beside the existing ones", () => {
    expect(isTestSlug("digit-memory")).toBe(true);
    expect(isTestSlug("dual-target-tracking")).toBe(true);
    expect(isTestSlug("visual-tracking")).toBe(true);
  });
});
