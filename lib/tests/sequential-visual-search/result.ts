import { calculateAccuracy } from "@/lib/tests/scoring";
import { formatSeconds } from "@/lib/format";
import { SEQUENTIAL_TOTAL } from "./layout";
import type { SearchState } from "./engine";

export type SequentialMetrics = {
  completionTimeMs: number;
  totalNumbers: 50;
  numbersFound: 50;
  completionStatus: "completed";
  scoringVersion: "sequential-time-1";
};

export type SequentialResult = {
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionTime: number;
  bestReactionTime: number;
  duration: number;
  metrics: SequentialMetrics;
};

export function buildSequentialResult(state: SearchState): SequentialResult | null {
  if (!state.completed || state.found !== SEQUENTIAL_TOTAL || state.completionTimeMs == null) {
    return null;
  }
  if (state.completionTimeMs <= 0) return null;
  const accuracy = calculateAccuracy(SEQUENTIAL_TOTAL, state.errors);
  return {
    score: Math.round(accuracy),
    accuracy,
    correctAnswers: SEQUENTIAL_TOTAL,
    errors: state.errors,
    averageReactionTime: 0,
    bestReactionTime: 0,
    duration: state.completionTimeMs,
    metrics: {
      completionTimeMs: state.completionTimeMs,
      totalNumbers: 50,
      numbersFound: 50,
      completionStatus: "completed",
      scoringVersion: "sequential-time-1",
    },
  };
}

export function sequentialSubmissionError(input: {
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  durationMs: number;
  metrics?: Record<string, unknown>;
}) {
  const metrics = input.metrics ?? {};
  if (metrics.completionStatus !== "completed") return "Exercice incomplet.";
  if (metrics.totalNumbers !== 50 || metrics.numbersFound !== 50) {
    return "Séquence incomplète.";
  }
  if (input.correctAnswers !== 50 || input.durationMs <= 0) return "Séquence incomplète.";
  if (!Number.isInteger(input.errors) || input.errors < 0) return "Erreurs invalides.";
  if (metrics.completionTimeMs !== input.durationMs) return "Temps invalide.";
  const accuracy = calculateAccuracy(50, input.errors);
  if (Math.abs(input.accuracy - accuracy) > 0.05) return "Précision invalide.";
  if (input.score !== Math.round(accuracy)) return "Précision invalide.";
  return null;
}

export function sequentialResultLines(result: {
  errors: number;
  accuracy: number;
  durationMs: number;
  completedAt?: string;
  metrics: Record<string, unknown> | null;
}) {
  const metrics = result.metrics ?? {};
  if (typeof metrics.completionTimeMs !== "number") return null;
  const lines = [
    { label: "Temps", value: formatSeconds(result.durationMs) },
    { label: "Erreurs", value: String(result.errors) },
    { label: "Précision", value: `${result.accuracy.toFixed(1)}%` },
    {
      label: "Nombres",
      value: `${metrics.numbersFound ?? 50}/${metrics.totalNumbers ?? 50}`,
    },
  ];
  if (result.completedAt) {
    const date = new Date(result.completedAt);
    if (!Number.isNaN(date.getTime())) {
      lines.push({
        label: "Terminé",
        value: date.toLocaleString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    }
  }
  return lines;
}

export function sequentialHeadline(metrics: Record<string, unknown> | null) {
  const time = metrics?.completionTimeMs;
  if (typeof time !== "number") return null;
  return formatSeconds(time);
}
