import { describe, expect, it, vi } from "vitest";
import { buildContext, playerFinished } from "@/lib/ai-analysis/analysis-context";
import { analysisPayload } from "@/lib/ai-analysis/analysis-prompts";
import { cohortPosition } from "@/lib/ai-analysis/cohort";
import {
  orchestratePlayerResult,
  type AnalysisStore,
} from "@/lib/ai-analysis/analysis-orchestrator";
import type { PlayerBundle } from "@/lib/ai-analysis/analysis-context";
import { coachOwnsPlayer, resetRetryWindow, textDirection } from "@/lib/ai-analysis/permissions";
import { parseReportContent } from "@/lib/ai-analysis/schemas";
import { isCompleteResult, sameScoringRules } from "@/lib/ai-analysis/metrics-context";
import type { ReportContent, ReportType, StoredReport } from "@/lib/ai-analysis/types";

function result(
  id: string,
  slug: string,
  score = 70,
  metrics: Record<string, unknown> = {},
) {
  return {
    id,
    testSlug: slug,
    score,
    accuracy: score,
    correctAnswers: 7,
    errors: 3,
    averageReactionMs: 400,
    bestReactionMs: 250,
    durationMs: 12000,
    metrics,
    completedAt: "2026-11-03T18:00:00.000Z",
  };
}

function bundle(
  id: string,
  assigned: string[],
  results: ReturnType<typeof result>[],
  history: PlayerBundle["history"] = [],
): PlayerBundle {
  return {
    sessionId: "session-1",
    sessionPlayerId: id,
    displayName: id,
    assigned,
    results,
    history,
  };
}

function sample(type: ReportType): ReportContent {
  const observation = {
    title: "Lecture du score",
    explanation: "Le score enregistré est utilisé tel quel.",
    evidence_metric_keys: ["score"],
    interpretation: "neutral" as const,
    priority: null,
  };
  const recommendation = {
    title: "Jeu réduit",
    objective: "Repérer plus tôt le joueur libre.",
    practical_exercise: "Quatre contre quatre, annoncer le joueur libre avant la passe.",
    duration_or_repetitions: "4 x 3 minutes",
    related_metric_keys: ["score"],
    coaching_notes: "Lié uniquement au score enregistré.",
  };
  const fr = {
    executive_summary: "Résumé pour l'entraîneur.",
    what_was_assessed: "Exercice visuel de football.",
    performance_observations: [observation],
    strengths: [],
    development_areas: [],
    training_recommendations: [recommendation],
    coach_action_plan: ["Revoir une situation au tableau."],
    limitations: [
      "Les données disponibles ne permettent pas encore de tirer une conclusion suffisamment fiable.",
    ],
  };
  return {
    report_type: type,
    confidence: "low",
    confidence_reason: "Une seule tentative.",
    fr,
    ar: {
      ...fr,
      executive_summary: "ملخص للمدرب.",
      what_was_assessed: "تمرين بصري في كرة القدم.",
      performance_observations: [
        {
          ...observation,
          title: "قراءة النتيجة",
          explanation: "تُستخدم النتيجة المسجلة كما هي.",
        },
      ],
      training_recommendations: [
        {
          ...recommendation,
          title: "لعب مصغر",
          objective: "التعرف مبكراً على اللاعب الحر.",
          practical_exercise: "أربعة ضد أربعة، مع تسمية اللاعب الحر قبل التمرير.",
          coaching_notes: "مرتبط بالنتيجة المسجلة فقط.",
        },
      ],
      coach_action_plan: ["مراجعة وضعية على السبورة."],
      limitations: [
        "المعطيات المتوفرة لا تسمح بعد باستخلاص نتيجة موثوقة بما يكفي.",
      ],
    },
  };
}

function memory(players: Record<string, PlayerBundle>) {
  const reports: StoredReport[] = [];
  const store: AnalysisStore = {
    async loadPlayer(id) {
      return players[id] ?? null;
    },
    async findReport(key) {
      return (
        reports.find(
          (item) =>
            item.sessionPlayerId === key.sessionPlayerId &&
            item.sessionId === key.sessionId &&
            item.reportType === key.reportType &&
            item.testResultId === key.testResultId,
        ) ?? null
      );
    },
    async claim(key) {
      const existing = await this.findReport(key);
      if (existing) {
        existing.status = "processing";
        return existing;
      }
      const created: StoredReport = {
        id: `report-${reports.length + 1}`,
        sessionId: key.sessionId,
        sessionPlayerId: key.sessionPlayerId,
        testResultId: key.testResultId,
        reportType: key.reportType,
        status: "processing",
        reportData: null,
        model: null,
        promptVersion: null,
        inputTokens: 0,
        outputTokens: 0,
        errorCode: null,
        generatedAt: null,
      };
      reports.push(created);
      return created;
    },
    async complete(id, data, usage) {
      const row = reports.find((item) => item.id === id);
      if (!row) return;
      row.status = "completed";
      row.reportData = data;
      row.model = usage.model;
      row.inputTokens = usage.inputTokens;
      row.outputTokens = usage.outputTokens;
    },
    async fail(id, errorCode) {
      const row = reports.find((item) => item.id === id);
      if (!row) return;
      row.status = "failed";
      row.errorCode = errorCode;
    },
    async markIneligible(key, reason) {
      const existing = await this.findReport(key);
      if (existing) {
        existing.status = "not_eligible";
        existing.reportData = { reason };
        return;
      }
      reports.push({
        id: `report-${reports.length + 1}`,
        sessionId: key.sessionId,
        sessionPlayerId: key.sessionPlayerId,
        testResultId: key.testResultId,
        reportType: key.reportType,
        status: "not_eligible",
        reportData: { reason },
        model: null,
        promptVersion: null,
        inputTokens: 0,
        outputTokens: 0,
        errorCode: null,
        generatedAt: null,
      });
    },
  };
  return { reports, store };
}

function deps(
  store: AnalysisStore,
  generate: ReturnType<typeof vi.fn>,
  enabled = true,
) {
  return { store, generate, enabled };
}

describe("AI analysis orchestration", () => {
  it("creates a test report after a valid result and keeps both languages", async () => {
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [result("r1", "reaction-time")]),
    });
    const generate = vi.fn(async (context: { reportType: ReportType }) => ({
      parsed: sample(context.reportType),
      model: "test-model",
      inputTokens: 10,
      outputTokens: 20,
    }));
    await orchestratePlayerResult("a", deps(store, generate));
    const testReport = reports.find((item) => item.reportType === "test");
    expect(testReport?.status).toBe("completed");
    expect(testReport?.reportData && "fr" in testReport.reportData).toBe(true);
    if (testReport?.reportData && "fr" in testReport.reportData) {
      expect(testReport.reportData.fr.executive_summary.length).toBeGreaterThan(5);
      expect(testReport.reportData.ar.executive_summary).toContain("ملخص");
    }
  });

  it("does not create a report for an invalid result", async () => {
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [result("r1", "reaction-time", 140)]),
    });
    const generate = vi.fn();
    await orchestratePlayerResult("a", deps(store, generate));
    expect(reports).toHaveLength(0);
    expect(generate).not.toHaveBeenCalled();
    expect(isCompleteResult(result("r1", "reaction-time", 140))).toBe(false);
  });

  it("creates a session report only when that player finished every assigned test", async () => {
    const done = memory({
      a: bundle("a", ["reaction-time"], [result("r1", "reaction-time")]),
    });
    const generate = vi.fn(async (context: { reportType: ReportType }) => ({
      parsed: sample(context.reportType),
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
    }));
    await orchestratePlayerResult("a", deps(done.store, generate));
    expect(done.reports.some((item) => item.reportType === "session")).toBe(true);

    const partial = memory({
      b: bundle("b", ["reaction-time", "visual-memory"], [
        result("r2", "reaction-time"),
      ]),
    });
    await orchestratePlayerResult("b", deps(partial.store, generate));
    expect(partial.reports.some((item) => item.reportType === "session")).toBe(false);
    expect(playerFinished(["reaction-time", "visual-memory"], ["reaction-time"])).toBe(
      false,
    );
  });

  it("keeps players independent inside the same session", async () => {
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [result("ra", "reaction-time")]),
      b: bundle("b", ["reaction-time", "visual-memory"], [
        result("rb", "reaction-time"),
      ]),
    });
    const generate = vi.fn(async (context: { reportType: ReportType }) => ({
      parsed: sample(context.reportType),
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
    }));
    await orchestratePlayerResult("a", deps(store, generate));
    expect(reports.every((item) => item.sessionPlayerId === "a")).toBe(true);
    await orchestratePlayerResult("b", deps(store, generate));
    expect(reports.filter((item) => item.sessionPlayerId === "b")).toHaveLength(1);
    expect(
      reports.find((item) => item.sessionPlayerId === "b")?.reportType,
    ).toBe("test");
  });

  it("does not duplicate a report when the same result is submitted again", async () => {
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [result("r1", "reaction-time")]),
    });
    const generate = vi.fn(async (context: { reportType: ReportType }) => ({
      parsed: sample(context.reportType),
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
    }));
    await orchestratePlayerResult("a", deps(store, generate));
    const calls = generate.mock.calls.length;
    await orchestratePlayerResult("a", deps(store, generate));
    expect(generate).toHaveBeenCalledTimes(calls);
    expect(reports.filter((item) => item.reportType === "test")).toHaveLength(1);
  });

  it("keeps the saved result when the model fails, then retries the same report", async () => {
    const player = bundle("a", ["reaction-time"], [result("r1", "reaction-time")]);
    const { reports, store } = memory({ a: player });
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockImplementation(async (context: { reportType: ReportType }) => ({
        parsed: sample(context.reportType),
        model: "test-model",
        inputTokens: 3,
        outputTokens: 4,
      }));
    await orchestratePlayerResult("a", deps(store, generate));
    expect(player.results).toHaveLength(1);
    expect(reports.find((item) => item.reportType === "test")?.status).toBe("failed");
    await orchestratePlayerResult("a", deps(store, generate), {
      reportType: "test",
      testResultId: "r1",
      retry: true,
    });
    expect(reports.filter((item) => item.reportType === "test")).toHaveLength(1);
    expect(reports.find((item) => item.reportType === "test")?.status).toBe(
      "completed",
    );
  });

  it("rejects invalid model JSON and skips progress without comparable history", async () => {
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [result("r1", "reaction-time")]),
    });
    const generate = vi.fn(async () => ({
      parsed: { unexpected: true },
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
    }));
    await orchestratePlayerResult("a", deps(store, generate));
    const testReport = reports.find((item) => item.reportType === "test");
    const progress = reports.find((item) => item.reportType === "progress");
    expect(testReport?.status).toBe("failed");
    expect(testReport?.errorCode).toBe("invalid_schema");
    expect(testReport?.reportData).toBeNull();
    expect(progress?.status).toBe("not_eligible");
    expect(parseReportContent({ unexpected: true }, ["score"]).ok).toBe(false);
  });

  it("does not compare incompatible scoring versions", async () => {
    const current = result("r1", "reaction-time", 70, { scoringVersion: "2" });
    const previous = result("old", "reaction-time", 40, { scoringVersion: "1" });
    expect(sameScoringRules(
      { ...current, metrics: { scoringVersion: "2" }, testResultId: current.id, completedAt: current.completedAt },
      { ...previous, metrics: { scoringVersion: "1" }, testResultId: previous.id, completedAt: previous.completedAt },
    )).toBe(false);
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [current], [
        {
          sessionId: "session-old",
          completedAt: "2026-10-01T00:00:00.000Z",
          results: [previous],
        },
      ]),
    });
    const generate = vi.fn(async (context: { reportType: ReportType }) => ({
      parsed: sample(context.reportType),
      model: "test-model",
      inputTokens: 1,
      outputTokens: 1,
    }));
    await orchestratePlayerResult("a", deps(store, generate));
    expect(reports.find((item) => item.reportType === "progress")?.status).toBe(
      "not_eligible",
    );
  });

  it("blocks another coach and renders Arabic from right to left", () => {
    expect(coachOwnsPlayer("coach-a", "coach-b")).toBe(false);
    expect(coachOwnsPlayer("coach-a", "coach-a")).toBe(true);
    expect(textDirection("ar")).toBe("rtl");
    expect(textDirection("fr")).toBe("ltr");
    resetRetryWindow();
  });

  it("compares a player with all stored results, not with his own previous score", () => {
    const player = bundle(
      "a",
      ["reaction-time"],
      [result("r1", "reaction-time", 80)],
      [{
        sessionId: "old",
        completedAt: "2026-10-01T00:00:00.000Z",
        results: [result("old", "reaction-time", 20)],
      }],
    );
    player.cohortScores = {
      "reaction-time": [40, 50, 60, 70, 80, 80, 90, 100],
    };
    const context = buildContext(player, "test", "r1");
    expect("eligible" in context).toBe(false);
    if ("eligible" in context) return;
    expect(context.comparisons).toEqual([]);
    expect(context.reference.samePlayerHistoryUsed).toBe(false);
    expect(context.reference.cohort).toMatchObject({
      sampleSize: 8,
      meanScore: 71.3,
      medianScore: 75,
      playerScore: 80,
      percentile: 63,
      basis: "app_players",
    });
    expect(context.reference.study?.publishedValue).toContain("231 ms");
    const payload = analysisPayload(context);
    expect(payload.reference.cohort?.basis).toBe("app_players");
    expect(payload).not.toHaveProperty("history");
    expect(cohortPosition("reaction-time", 80, [40, 50, 60]).percentile).toBeNull();
    expect(cohortPosition("reaction-time", 80, [40, 50, 60]).basis).toBe("too_small");
  });

  it("does nothing when analysis is disabled", async () => {
    const { reports, store } = memory({
      a: bundle("a", ["reaction-time"], [result("r1", "reaction-time")]),
    });
    const generate = vi.fn();
    const outcome = await orchestratePlayerResult("a", deps(store, generate, false));
    expect(outcome.skipped).toBe("disabled");
    expect(reports).toHaveLength(0);
  });
});
