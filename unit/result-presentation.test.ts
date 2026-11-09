import { describe, expect, it } from "vitest";
import { exerciseGuides } from "@/lib/ai-analysis/exercise-guides";
import { metricCatalog, numericMetrics } from "@/lib/ai-analysis/metrics-context";
import { analysisPayload } from "@/lib/ai-analysis/analysis-prompts";
import { buildContext } from "@/lib/ai-analysis/analysis-context";
import { correctPlayer, SCANNING_SEQUENCES } from "@/lib/tests/football-visual-scanning/answers";
import { authorizeResult } from "@/lib/tests/results/authorize";
import {
  OVERALL_UNAVAILABLE,
  presentResult,
  sessionOverview,
  UNAVAILABLE,
} from "@/lib/tests/results/present";
import { buildVisualTrackingResult } from "@/lib/tests/scoring";

const stored = {
  score: 0,
  accuracy: 0,
  correctAnswers: 0,
  errors: 0,
  averageReactionMs: 0,
  bestReactionMs: 0,
  durationMs: 0,
  metrics: {} as Record<string, unknown>,
};

describe("exercise result routing", () => {
  it("keeps 50/50 on sequential search and nowhere else", () => {
    const sequential = presentResult({
      ...stored,
      testSlug: "sequential-visual-search",
      score: 93,
      accuracy: 92.6,
      correctAnswers: 50,
      errors: 4,
      durationMs: 210852,
      metrics: {
        numbersFound: 50,
        totalNumbers: 50,
        completionTimeMs: 210852,
        completionStatus: "completed",
        scoringVersion: "sequential-time-1",
      },
    });
    const digits = presentResult({
      ...stored,
      testSlug: "digit-memory",
      score: 5,
      accuracy: 83.3,
      correctAnswers: 15,
      errors: 1,
      durationMs: 45425,
      metrics: {
        scoringVersion: "digit-memory-1",
        levelsCompleted: 3,
        completionStatus: "completed",
        completionTimeMs: 45425,
        incorrectSequences: 1,
        totalCorrectDigits: 15,
        totalDigitsPresented: 18,
        maximumDigitsMemorized: 5,
      },
    });
    const dual = presentResult({
      ...stored,
      testSlug: "dual-target-tracking",
      score: 90,
      accuracy: 90,
      correctAnswers: 9,
      errors: 1,
      durationMs: 78339,
      metrics: {
        targetCount: 10,
        missedTargets: 1,
        scoringVersion: "dual-target-1",
        completeSuccess: false,
        completionStatus: "completed",
        completionTimeMs: 78339,
        movementDurationMs: 42000,
        incorrectSelections: 1,
        identificationTimeMs: 26339,
        difficultyLevelReached: 5,
        correctlyIdentifiedTargets: 9,
      },
    });

    expect(sequential.headline).toBe("50/50");
    expect(sequential.primaryLabel).toBe("Nombres trouvés");
    expect(digits.headline).toBe("5 chiffres");
    expect(digits.lines.map((line) => line.label).join(" ")).not.toContain("Nombres");
    expect(digits.lines.map((line) => line.value)).not.toContain("50/50");
    expect(dual.headline).toBe("9/10");
    expect(dual.lines.map((line) => line.value)).not.toContain("50/50");
  });

  it("uses each exercise's own primary indicator", () => {
    expect(
      presentResult({
        ...stored,
        testSlug: "visual-tracking",
        score: 32,
        accuracy: 100,
        correctAnswers: 4,
        durationMs: 30000,
        metrics: { targetsFound: 4, wrongClicks: 0 },
      }).headline,
    ).toBe("4 cibles");
    expect(
      presentResult({
        ...stored,
        testSlug: "visual-memory",
        score: 58,
        accuracy: 78.9,
        correctAnswers: 30,
        errors: 8,
        durationMs: 30000,
        metrics: { correctCells: 30, roundsCompleted: 6 },
      }).primaryLabel,
    ).toBe("Cases retenues");
    expect(
      presentResult({
        ...stored,
        testSlug: "reaction-time",
        score: 35,
        accuracy: 90.9,
        correctAnswers: 10,
        errors: 1,
        averageReactionMs: 450,
        bestReactionMs: 320,
        durationMs: 31313,
        metrics: { attempts: 10, falseStarts: 1 },
      }).headline,
    ).toBe("450 ms");
    expect(
      presentResult({
        ...stored,
        testSlug: "peripheral-vision",
        correctAnswers: 15,
        errors: 3,
        averageReactionMs: 407,
        accuracy: 83.3,
        metrics: { wrongAnswers: 0, missed: 3, leftAccuracy: 83.3, rightAccuracy: 83.3 },
      }).primaryLabel,
    ).toBe("Stimuli détectés");
    expect(
      presentResult({
        ...stored,
        testSlug: "football-visual-scanning",
        score: 78,
        accuracy: 77.8,
        correctAnswers: 7,
        errors: 2,
        bestReactionMs: 1400,
        durationMs: 40000,
        metrics: {},
      }).headline,
    ).toBe("7/9");
  });

  it("shows unavailable instead of an invented default", () => {
    const view = presentResult({
      ...stored,
      testSlug: "digit-memory",
      metrics: { scoringVersion: "digit-memory-1", completionStatus: "completed" },
    });
    expect(view.headline).toBe(UNAVAILABLE);
    expect(view.lines.find((line) => line.label === "Suite maximale retenue")?.value).toBe(
      UNAVAILABLE,
    );
    const tracking = presentResult({
      ...stored,
      testSlug: "visual-tracking",
      metrics: { demo: true },
      score: 84,
      correctAnswers: 18,
      accuracy: 81.8,
    });
    expect(tracking.completionStatus).toBe("Démonstration");
    expect(tracking.lines.find((line) => line.label === "Score enregistré")?.value).toBe(
      "Non revérifié",
    );
    expect(tracking.lines.find((line) => line.label === "Cibles manquées")?.value).toBe(
      UNAVAILABLE,
    );
  });

  it("does not invent a session average", () => {
    const overview = sessionOverview(3, 3, 3);
    expect(overview.overall).toBe(OVERALL_UNAVAILABLE);
    expect(overview.completionLabel).toBe("3/9");
    expect("average" in overview).toBe(false);
  });
});

describe("server score authority", () => {
  it("recalculates visual tracking and ignores a client score", () => {
    const reactionTimes = [500, 700, 900];
    const expected = buildVisualTrackingResult({
      reactionTimes,
      wrongClicks: 1,
      duration: 30000,
    });
    const saved = authorizeResult({
      testSlug: "visual-tracking",
      score: 100,
      accuracy: 100,
      correctAnswers: 99,
      errors: 0,
      metrics: { reactionTimes, wrongClicks: 1 },
    });
    expect(saved.ok && saved.result.score).toBe(expected.score);
    expect(saved.ok && saved.result.correctAnswers).toBe(3);
    expect(saved.ok && saved.result.accuracy).toBe(expected.accuracy);
  });

  it("rejects a tracking payload without the raw times", () => {
    expect(
      authorizeResult({
        testSlug: "visual-tracking",
        score: 10,
        accuracy: 50,
        correctAnswers: 1,
        errors: 1,
        metrics: { targetsFound: 1, wrongClicks: 1 },
      }).ok,
    ).toBe(false);
  });

  it("grades football scanning from the tracking coordinates", () => {
    const attempts = SCANNING_SEQUENCES.map((sequence, index) => ({
      index,
      playerId: index === 0 ? "not-a-player" : correctPlayer(sequence).playerId,
      responseMs: 3000,
    }));
    attempts[0] = { index: 0, playerId: correctPlayer(SCANNING_SEQUENCES[0]).playerId, responseMs: 3000 };
    const first = authorizeResult({
      testSlug: "football-visual-scanning",
      score: 0,
      accuracy: 0,
      correctAnswers: 0,
      errors: 9,
      metrics: { attempts },
    });
    expect(first.ok && first.result.correctAnswers).toBe(9);
    const missed = authorizeResult({
      testSlug: "football-visual-scanning",
      score: 100,
      accuracy: 100,
      correctAnswers: 9,
      errors: 0,
      metrics: {
        attempts: SCANNING_SEQUENCES.map((_, index) => ({
          index,
          playerId: null,
          responseMs: 12000,
        })),
      },
    });
    expect(missed.ok && missed.result.correctAnswers).toBe(0);
    expect(missed.ok && missed.result.errors).toBe(9);
    expect(missed.ok && missed.result.durationMs).toBe(9 * 12000);
  });

  it("rejects peripheral counts that do not add up", () => {
    expect(
      authorizeResult({
        testSlug: "peripheral-vision",
        score: 100,
        accuracy: 100,
        correctAnswers: 2,
        errors: 0,
        metrics: {
          reactionTimes: [250, 250],
          wrongAnswers: 0,
          missed: 0,
          leftTrials: 1,
          leftCorrect: 1,
          rightTrials: 1,
          rightCorrect: 0,
        },
      }).ok,
    ).toBe(false);
  });
});

describe("analysis metric contract", () => {
  it("describes every exercise without calling a model", () => {
    const guides = exerciseGuides([
      "digit-memory",
      "dual-target-tracking",
      "sequential-visual-search",
      "reaction-time",
      "football-visual-scanning",
    ]);
    expect(guides["digit-memory"]).toContain("longueur");
    expect(guides["dual-target-tracking"]).toContain("9/10");
    expect(guides["sequential-visual-search"]).toContain("50");
    expect(guides["reaction-time"]).toContain("millisecondes");
    expect(guides["football-visual-scanning"]).toContain("neuf");
    const metrics = numericMetrics({ questionTimes: [1200, 12000], missed: 1 });
    expect(metrics.questionTime1).toBe(1200);
    expect(metricCatalog([
      {
        testResultId: "r",
        testSlug: "football-visual-scanning",
        score: 0,
        accuracy: 0,
        correctAnswers: 0,
        errors: 1,
        averageReactionMs: 0,
        bestReactionMs: 0,
        durationMs: 12000,
        metrics,
        completedAt: "2026-11-09T18:00:00.000Z",
      },
    ]).some((item) => item.key === "questionTime2" && item.meaning.includes("12 secondes"))).toBe(true);
  });

  it("puts the same guides in the analysis payload", () => {
    const context = buildContext(
      {
        sessionId: "s",
        sessionPlayerId: "p",
        displayName: "Joueur",
        assigned: ["digit-memory"],
        results: [
          {
            id: "r",
            testSlug: "digit-memory",
            score: 5,
            accuracy: 83.3,
            correctAnswers: 15,
            errors: 1,
            averageReactionMs: 0,
            bestReactionMs: 0,
            durationMs: 45425,
            metrics: { maximumDigitsMemorized: 5, scoringVersion: "digit-memory-1" },
            completedAt: "2026-11-09T18:00:00.000Z",
          },
        ],
        history: [],
      },
      "test",
      "r",
    );
    if ("eligible" in context) throw new Error(context.reason);
    const payload = analysisPayload(context);
    expect(payload.exerciseGuides["digit-memory"]).toContain("pas une note sur 100");
  });
});
