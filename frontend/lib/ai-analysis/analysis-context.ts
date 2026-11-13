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
  ExerciseBenchmark,
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
  cohortScores?: Record<string, number[]>;
  players: {
    sessionPlayerId: string;
    displayName: string;
    results: Parameters<typeof snapshotFromResult>[0][];
  }[];
};

function benchmarksForTests(
  tests: { testSlug: string; score: number }[],
  cohortScores?: Record<string, number[]>,
): ExerciseBenchmark[] {
  const seen = new Set<string>();
  const list: ExerciseBenchmark[] = [];
  for (const test of tests) {
    if (seen.has(test.testSlug)) continue;
    seen.add(test.testSlug);
    list.push({
      testSlug: test.testSlug,
      cohort: cohortPosition(
        test.testSlug,
        test.score,
        cohortScores?.[test.testSlug] ?? [],
      ),
      study: studyForSlug(test.testSlug),
    });
  }
  return list;
}

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
  const exerciseBenchmarks = benchmarksForTests(shown, bundle.cohortScores);
  const primary = focus
    ? exerciseBenchmarks.find((item) => item.testSlug === focus.testSlug) ??
      exerciseBenchmarks[0]
    : exerciseBenchmarks[0];
  const reference: AnalysisReference = {
    samePlayerHistoryUsed: false,
    cohort: primary?.cohort ?? null,
    study: primary?.study ?? null,
    exerciseBenchmarks:
      reportType === "session" || reportType === "progress"
        ? exerciseBenchmarks
        : undefined,
  };
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
        "La comparaison principale est reference.exerciseBenchmarks[].cohort (joueurs de l'application).",
        "Les études (study) sont des repères externes prudents, pas des normes de l'exercice exact.",
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

  const finishedPlayers = groupPlayers.filter((player) => player.finished);
  const allSnapshots = bundle.players.flatMap((player) =>
    player.results
      .map(snapshotFromResult)
      .filter((item) => assigned.includes(item.testSlug)),
  );
  const catalog = metricCatalog(allSnapshots);

  // Group benchmark = mean score of finished players on each exercise, vs app cohort.
  const groupMeans = assigned.map((slug) => {
    const scores = finishedPlayers
      .map((player) => player.tests.find((test) => test.testSlug === slug)?.score)
      .filter((score): score is number => typeof score === "number");
    const mean =
      scores.length === 0
        ? 0
        : scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return { testSlug: slug, score: Math.round(mean * 10) / 10 };
  });
  const exerciseBenchmarks = benchmarksForTests(groupMeans, bundle.cohortScores);

  return {
    reportType: "group",
    sessionId: bundle.sessionId,
    sessionPlayerId: null,
    displayName: bundle.title,
    assignedTests: assigned,
    currentTests: allSnapshots,
    reference: {
      samePlayerHistoryUsed: false,
      cohort: exerciseBenchmarks[0]?.cohort ?? null,
      study: exerciseBenchmarks[0]?.study ?? null,
      exerciseBenchmarks,
    },
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
        "Compare d'abord à exerciseBenchmarks[].cohort (base app). Les études externes sont secondaires et prudentes.",
        "Ces exercices de navigateur ne sont pas une évaluation clinique ni un test de match validé.",
      ],
    },
    allowedMetricKeys: catalog.map((item) => item.key),
  };
}
