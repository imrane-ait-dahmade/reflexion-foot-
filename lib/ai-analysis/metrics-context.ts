import type { TestSlug } from "@/lib/db/types";
import { isTestSlug } from "@/lib/sessions/exercises";
import type { MetricValue, TestSnapshot } from "./types";

const DEFINITIONS: Record<string, { meaning: string; unit: string }> = {
  score: {
    meaning: "Score déjà calculé par l'application, de 0 à 100. Ne pas le recalculer.",
    unit: "points",
  },
  accuracy: {
    meaning: "Pourcentage de réponses correctes déjà calculé.",
    unit: "percent",
  },
  correctAnswers: { meaning: "Nombre de réponses correctes enregistrées.", unit: "count" },
  errors: { meaning: "Nombre d'erreurs enregistrées, y compris les réponses manquées selon le test.", unit: "count" },
  averageReactionMs: { meaning: "Temps de réponse moyen déjà calculé.", unit: "ms" },
  bestReactionMs: { meaning: "Meilleur temps de réponse enregistré.", unit: "ms" },
  durationMs: { meaning: "Durée enregistrée de la tentative.", unit: "ms" },
  targetsFound: { meaning: "Cibles trouvées au suivi visuel.", unit: "count" },
  wrongClicks: { meaning: "Clics incorrects au suivi visuel.", unit: "count" },
  roundsCompleted: { meaning: "Manches terminées en mémoire visuelle.", unit: "count" },
  correctCells: { meaning: "Cases correctes en mémoire visuelle.", unit: "count" },
  attempts: { meaning: "Tentatives valides au temps de réaction.", unit: "count" },
  falseStarts: { meaning: "Départs anticipés au temps de réaction.", unit: "count" },
  worstReactionTime: { meaning: "Temps de réaction le plus lent.", unit: "ms" },
  trials: { meaning: "Essais présentés en vision périphérique.", unit: "count" },
  missed: { meaning: "Réponses absentes avant la fin du délai.", unit: "count" },
  leftAccuracy: { meaning: "Précision déjà calculée pour le côté gauche.", unit: "percent" },
  rightAccuracy: { meaning: "Précision déjà calculée pour le côté droit.", unit: "percent" },
  wrongAnswers: { meaning: "Réponses incorrectes en vision périphérique.", unit: "count" },
  incorrect: { meaning: "Mauvaises sélections en lecture du jeu.", unit: "count" },
  closestCorrect: { meaning: "Bonnes réponses « joueur le plus proche du ballon ».", unit: "count" },
  closestTotal: { meaning: "Nombre de situations « proche du ballon ».", unit: "count" },
  defenderCorrect: { meaning: "Bonnes réponses « défenseur le plus proche ».", unit: "count" },
  defenderTotal: { meaning: "Nombre de situations « défenseur ».", unit: "count" },
  freeCorrect: { meaning: "Bonnes réponses « joueur le plus libre ».", unit: "count" },
  freeTotal: { meaning: "Nombre de situations « joueur libre ».", unit: "count" },
  scoringVersion: { meaning: "Version interne des règles de score, si elle est présente.", unit: "id" },
};

export function isCompleteResult(result: {
  testSlug: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
}) {
  return (
    isTestSlug(result.testSlug) &&
    result.score >= 0 &&
    result.score <= 100 &&
    result.accuracy >= 0 &&
    result.accuracy <= 100 &&
    result.correctAnswers >= 0 &&
    result.errors >= 0
  );
}

export function numericMetrics(metrics: Record<string, unknown>): Record<string, MetricValue> {
  const clean: Record<string, MetricValue> = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (!DEFINITIONS[key]) continue;
    if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "string" || typeof value === "boolean") clean[key] = value;
  }
  return clean;
}

export function snapshotFromResult(result: {
  id: string;
  testSlug: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics: Record<string, unknown> | null;
  completedAt: string | Date;
}): TestSnapshot {
  return {
    testResultId: result.id,
    testSlug: result.testSlug,
    score: result.score,
    accuracy: result.accuracy,
    correctAnswers: result.correctAnswers,
    errors: result.errors,
    averageReactionMs: result.averageReactionMs,
    bestReactionMs: result.bestReactionMs,
    durationMs: result.durationMs,
    metrics: numericMetrics(result.metrics ?? {}),
    completedAt:
      result.completedAt instanceof Date
        ? result.completedAt.toISOString()
        : result.completedAt,
  };
}

export function metricCatalog(snapshots: TestSnapshot[]) {
  const keys = new Set<string>([
    "score",
    "accuracy",
    "correctAnswers",
    "errors",
    "averageReactionMs",
    "bestReactionMs",
    "durationMs",
  ]);
  for (const snapshot of snapshots) {
    for (const key of Object.keys(snapshot.metrics)) keys.add(key);
  }
  return [...keys].map((key) => ({
    key,
    meaning: DEFINITIONS[key]?.meaning ?? "Indicateur enregistré par l'application.",
    unit: DEFINITIONS[key]?.unit ?? "value",
  }));
}

export function sameScoringRules(current: TestSnapshot, previous: TestSnapshot) {
  if (current.testSlug !== previous.testSlug) return false;
  const currentVersion = current.metrics.scoringVersion;
  const previousVersion = previous.metrics.scoringVersion;
  if (
    currentVersion != null &&
    previousVersion != null &&
    currentVersion !== previousVersion
  ) {
    return false;
  }
  return true;
}

export function sharedComparableSlugs(current: TestSnapshot[], previous: TestSnapshot[]) {
  const previousBySlug = new Map(previous.map((item) => [item.testSlug, item]));
  return current
    .filter((item) => {
      const match = previousBySlug.get(item.testSlug as TestSlug);
      return match ? sameScoringRules(item, match) : false;
    })
    .map((item) => item.testSlug);
}
