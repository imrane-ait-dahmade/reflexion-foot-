import { cohortPosition } from "./cohort";
import {
  metricCatalog,
  sharedComparableSlugs,
  snapshotFromResult,
} from "./metrics-context";
import { studyForSlug } from "./study-references";
import type {
  AnalysisContext,
  AnalysisReference,
  GroupPlayerSnapshot,
  ReportType,
} from "./types";

export type PlayerBundle = {
  sessionId: string;
  sessionPlayerId: string;
  displayName: string;
  assigned: string[];
  results: Parameters<typeof snapshotFromResult>[0][];
  cohortScores?: Record<string, number[]>;
  history: {
    sessionId: string;
    completedAt: string;
    results: Parameters<typeof snapshotFromResult>[0][];
  }[];
};

export type SessionGroupBundle = {
  sessionId: string;
  title: string;
  assigned: string[];
  players: {
    sessionPlayerId: string;
    displayName: string;
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
  const reference: AnalysisReference =
    reportType === "test" && focus
      ? {
          samePlayerHistoryUsed: false,
          cohort: cohortPosition(
            focus.testSlug,
            focus.score,
            bundle.cohortScores?.[focus.testSlug] ?? [],
          ),
          study: studyForSlug(focus.testSlug),
        }
      : { samePlayerHistoryUsed: false, cohort: null, study: null };
  return {
    reportType,
    sessionId: bundle.sessionId,
    sessionPlayerId: bundle.sessionPlayerId,
    displayName: bundle.displayName,
    assignedTests: bundle.assigned,
    currentTests: shown,
    focusTestSlug: focus?.testSlug,
    reference,
    comparisons: reportType === "progress" ? comparisons : [],
    metricDefinitions: catalog,
    dataQuality: {
      completedCount: currentTests.length,
      assignedCount: bundle.assigned.length,
      comparableSessions: reportType === "progress" ? comparisons.length + 1 : 1,
      notes: [
        "Les valeurs sont celles déjà enregistrées. Ne pas les recalculer.",
        "La comparaison utilise les résultats de tous les joueurs sur le même exercice, pas l'historique du même joueur.",
        "Ces exercices de navigateur ne sont pas une évaluation clinique ni un test de match validé.",
      ],
    },
    allowedMetricKeys: catalog.map((item) => item.key),
  };
}

export function buildGroupContext(
  bundle: SessionGroupBundle,
): AnalysisContext | { eligible: false; reason: string } {
  const assigned = bundle.assigned;
  if (assigned.length === 0) {
    return { eligible: false, reason: "Aucun exercice dans cette séance." };
  }

  const groupPlayers: GroupPlayerSnapshot[] = bundle.players.map((player) => {
    const snapshots = player.results
      .map(snapshotFromResult)
      .filter((item) => assigned.includes(item.testSlug));
    return {
      displayName: player.displayName,
      finished: playerFinished(
        assigned,
        snapshots.map((item) => item.testSlug),
      ),
      tests: snapshots.map((item) => ({
        testSlug: item.testSlug,
        score: item.score,
        accuracy: item.accuracy,
        averageReactionMs: item.averageReactionMs,
      })),
    };
  });

  const finishedCount = groupPlayers.filter((player) => player.finished).length;
  if (finishedCount < 1) {
    return {
      eligible: false,
      reason:
        "Le rapport de groupe attend qu'au moins un joueur ait terminé tous ses exercices.",
    };
  }

  const allSnapshots = bundle.players.flatMap((player) =>
    player.results
      .map(snapshotFromResult)
      .filter((item) => assigned.includes(item.testSlug)),
  );
  const catalog = metricCatalog(allSnapshots);

  return {
    reportType: "group",
    sessionId: bundle.sessionId,
    sessionPlayerId: null,
    displayName: bundle.title,
    assignedTests: assigned,
    currentTests: allSnapshots,
    reference: { samePlayerHistoryUsed: false, cohort: null, study: null },
    comparisons: [],
    groupPlayers,
    metricDefinitions: catalog,
    dataQuality: {
      completedCount: finishedCount,
      assignedCount: assigned.length,
      comparableSessions: 1,
      notes: [
        "Rapport collectif de la séance, pas une fiche individuelle.",
        "Les valeurs sont celles déjà enregistrées. Ne pas les recalculer.",
        `${finishedCount} joueur(s) terminé(s) sur ${bundle.players.length}.`,
        "Ces exercices de navigateur ne sont pas une évaluation clinique ni un test de match validé.",
      ],
    },
    allowedMetricKeys: catalog.map((item) => item.key),
  };
}
