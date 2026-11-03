import {
  metricCatalog,
  sharedComparableSlugs,
  snapshotFromResult,
} from "./metrics-context";
import type { AnalysisContext, ReportType } from "./types";

export type PlayerBundle = {
  sessionId: string;
  sessionPlayerId: string;
  displayName: string;
  assigned: string[];
  results: Parameters<typeof snapshotFromResult>[0][];
  history: {
    sessionId: string;
    completedAt: string;
    results: Parameters<typeof snapshotFromResult>[0][];
  }[];
};

export function playerFinished(assigned: string[], completedSlugs: string[]) {
  const done = new Set(completedSlugs);
  return assigned.length > 0 && assigned.every((slug) => done.has(slug));
}

export function buildContext(
  bundle: PlayerBundle,
  reportType: ReportType,
  focusResultId?: string,
): AnalysisContext | { eligible: false; reason: string } {
  const currentTests = bundle.results
    .map(snapshotFromResult)
    .filter((item) => bundle.assigned.includes(item.testSlug));
  const focus = focusResultId
    ? currentTests.find((item) => item.testResultId === focusResultId)
    : undefined;
  if (reportType === "test" && !focus) {
    return { eligible: false, reason: "Résultat introuvable pour ce joueur." };
  }

  const comparisons = bundle.history
    .map((session) => ({
      sessionId: session.sessionId,
      completedAt: session.completedAt,
      tests: session.results
        .map(snapshotFromResult)
        .filter((item) =>
          sharedComparableSlugs(
            reportType === "test" && focus ? [focus] : currentTests,
            [item],
          ).includes(item.testSlug),
        ),
    }))
    .filter((session) => session.tests.length > 0);

  if (reportType === "progress" && comparisons.length < 1) {
    return {
      eligible: false,
      reason:
        "Moins de deux séances comparables : aucun historique avec les mêmes exercices et les mêmes règles de score.",
    };
  }

  const shown = reportType === "test" && focus ? [focus] : currentTests;
  const catalog = metricCatalog([...shown, ...comparisons.flatMap((item) => item.tests)]);
  return {
    reportType,
    sessionId: bundle.sessionId,
    sessionPlayerId: bundle.sessionPlayerId,
    displayName: bundle.displayName,
    assignedTests: bundle.assigned,
    currentTests: shown,
    focusTestSlug: focus?.testSlug,
    comparisons: reportType === "progress" ? comparisons : [],
    metricDefinitions: catalog,
    dataQuality: {
      completedCount: currentTests.length,
      assignedCount: bundle.assigned.length,
      comparableSessions: reportType === "progress" ? comparisons.length + 1 : 1,
      notes: [
        "Les valeurs sont celles déjà enregistrées. Ne pas les recalculer.",
        "Un seul passage par exercice. L'échantillon est petit.",
        "Ces exercices de navigateur ne sont pas une évaluation clinique ni un test de match validé.",
      ],
    },
    allowedMetricKeys: catalog.map((item) => item.key),
  };
}
