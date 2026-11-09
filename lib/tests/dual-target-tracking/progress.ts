import { calculateAccuracy } from "@/lib/tests/scoring";
import { challengeSeed, readChallenge, signChallenge } from "@/lib/tests/challenge-token";
import { DUAL_HIGHLIGHT_MS, DUAL_LEVELS, dualLevel } from "./config";
import { gradeTargetSelection, targetPair } from "./motion";

export type DualToken = {
  kind: "dual-target-tracking";
  sessionPlayerId: string;
  sessionId: string;
  seed: string;
  level: number;
  movementReadyAt: number;
  correctTargets: number;
  missedTargets: number;
  incorrectSelections: number;
  bothCount: number;
  identificationTimeMs: number;
  movementDurationMs: number;
  difficultyLevelReached: number;
  startedAt: number;
};

export function beginDualAttempt(sessionPlayerId: string, sessionId: string, now: number, secret: string) {
  const token: DualToken = {
    kind: "dual-target-tracking",
    sessionPlayerId,
    sessionId,
    seed: challengeSeed(),
    level: 1,
    movementReadyAt: now + DUAL_HIGHLIGHT_MS,
    correctTargets: 0,
    missedTargets: 0,
    incorrectSelections: 0,
    bothCount: 0,
    identificationTimeMs: 0,
    movementDurationMs: 0,
    difficultyLevelReached: 0,
    startedAt: now,
  };
  return {
    token: signChallenge(token, secret),
    challenge: challengeView(token, secret),
  };
}

export function challengeView(token: DualToken, secret: string) {
  const config = dualLevel(token.level);
  if (!config) return null;
  return {
    level: token.level,
    totalLevels: DUAL_LEVELS.length,
    objects: config.objects,
    durationMs: config.durationMs,
    speed: config.speed,
    highlightIds: targetPair(token.seed, token.level, secret),
  };
}

export function gradeDualRound(
  signed: string,
  selected: number[],
  secret: string,
  now: number,
) {
  const token = readChallenge<DualToken>(signed, secret);
  if (!token || token.kind !== "dual-target-tracking" || !token.seed) {
    return { error: "Jeton invalide." as const };
  }
  const config = dualLevel(token.level);
  if (!config) return { error: "Niveau inconnu." as const };
  if (now + 1500 < token.movementReadyAt + config.durationMs) {
    return { error: "Le mouvement n'est pas terminé." as const };
  }
  if (selected.some((id) => id < 0 || id >= config.objects)) {
    return { error: "Sélection invalide." as const };
  }
  const targets = targetPair(token.seed, token.level, secret);
  const grade = gradeTargetSelection(targets, selected);
  if ("error" in grade) return { error: grade.error };
  const identificationMs = Math.max(0, now - (token.movementReadyAt + config.durationMs));
  const next: DualToken = {
    ...token,
    correctTargets: token.correctTargets + grade.correctlyIdentifiedTargets,
    missedTargets: token.missedTargets + grade.missedTargets,
    incorrectSelections: token.incorrectSelections + grade.incorrectSelections,
    bothCount: token.bothCount + (grade.both ? 1 : 0),
    identificationTimeMs: token.identificationTimeMs + identificationMs,
    movementDurationMs: token.movementDurationMs + config.durationMs,
    difficultyLevelReached: grade.both
      ? Math.max(token.difficultyLevelReached, token.level)
      : token.difficultyLevelReached,
  };
  const finished = token.level >= DUAL_LEVELS.length;
  if (!finished) {
    const advanced: DualToken = {
      ...next,
      level: token.level + 1,
      movementReadyAt: now + DUAL_HIGHLIGHT_MS,
    };
    return {
      both: grade.both,
      correctlyIdentifiedTargets: grade.correctlyIdentifiedTargets,
      finished: false as const,
      token: signChallenge(advanced, secret),
      challenge: challengeView(advanced, secret),
    };
  }
  return {
    both: grade.both,
    correctlyIdentifiedTargets: grade.correctlyIdentifiedTargets,
    finished: true as const,
    sessionPlayerId: token.sessionPlayerId,
    result: buildDualResult(next, now),
  };
}

export function buildDualResult(token: DualToken, now: number) {
  const targetCount = DUAL_LEVELS.length * 2;
  const accuracy = calculateAccuracy(token.correctTargets, token.missedTargets);
  return {
    score: Math.round(accuracy),
    accuracy,
    correctAnswers: token.correctTargets,
    errors: token.incorrectSelections,
    averageReactionMs: 0,
    bestReactionMs: 0,
    durationMs: Math.max(1, now - token.startedAt),
    metrics: {
      totalObjects: DUAL_LEVELS[DUAL_LEVELS.length - 1].objects,
      targetCount,
      correctlyIdentifiedTargets: token.correctTargets,
      missedTargets: token.missedTargets,
      incorrectSelections: token.incorrectSelections,
      completeSuccess: token.bothCount === DUAL_LEVELS.length,
      identificationTimeMs: token.identificationTimeMs,
      movementDurationMs: token.movementDurationMs,
      difficultyLevelReached: token.difficultyLevelReached,
      completionTimeMs: Math.max(1, now - token.startedAt),
      completionStatus: "completed" as const,
      scoringVersion: "dual-target-1",
    },
  };
}

export function dualResultLines(result: {
  accuracy: number;
  durationMs: number;
  completedAt?: string;
  metrics: Record<string, unknown> | null;
}) {
  const metrics = result.metrics ?? {};
  if (metrics.scoringVersion !== "dual-target-1") return null;
  const lines = [
    {
      label: "Cibles trouvées",
      value: `${metrics.correctlyIdentifiedTargets ?? 0}/${metrics.targetCount ?? 0}`,
    },
    { label: "Mauvais choix", value: String(metrics.incorrectSelections ?? 0) },
    { label: "Précision", value: `${result.accuracy.toFixed(1)}%` },
    { label: "Niveau atteint", value: String(metrics.difficultyLevelReached ?? 0) },
    {
      label: "Temps d'identification",
      value: `${Math.round(Number(metrics.identificationTimeMs ?? 0) / 1000)} s`,
    },
  ];
  if (result.completedAt) lines.push({ label: "Terminé", value: formatStamp(result.completedAt) });
  return lines;
}

export function dualHeadline(metrics: Record<string, unknown> | null) {
  if (metrics?.scoringVersion !== "dual-target-1") return null;
  return `${metrics.correctlyIdentifiedTargets ?? 0}/${metrics.targetCount ?? 0}`;
}

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
