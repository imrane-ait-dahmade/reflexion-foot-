import type { TestSlug } from "@/lib/db/types";
import { SCANNING_LIMIT_MS, SCANNING_SEQUENCES, correctPlayer } from "@/lib/tests/football-visual-scanning/answers";
import { PERIPHERAL_VISION_CONFIG } from "@/lib/tests/peripheral-vision/config";
import { REACTION_TIME_CONFIG } from "@/lib/tests/reaction-time/config";
import {
  buildPeripheralVisionResult,
  buildReactionTimeResult,
  buildVisualMemoryResult,
  buildVisualTrackingResult,
  calculateAccuracy,
} from "@/lib/tests/scoring";
import { sequentialSubmissionError } from "@/lib/tests/sequential-visual-search/result";
import { VISUAL_MEMORY_CONFIG } from "@/lib/tests/visual-memory/config";
import { VISUAL_TRACKING_CONFIG } from "@/lib/tests/visual-tracking/config";

export type AuthorizedResult = {
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics: Record<string, unknown>;
};

type Submission = {
  testSlug: TestSlug;
  score?: number;
  accuracy?: number;
  correctAnswers?: number;
  errors?: number;
  averageReactionMs?: number;
  bestReactionMs?: number;
  durationMs?: number;
  metrics?: Record<string, unknown>;
};

export function authorizeResult(
  input: Submission,
): { ok: true; result: AuthorizedResult } | { ok: false; error: string } {
  if (input.testSlug === "digit-memory" || input.testSlug === "dual-target-tracking") {
    return { ok: false, error: "Ce résultat est validé par le serveur de l'exercice." };
  }
  if (input.testSlug === "sequential-visual-search") return authorizeSequential(input);
  if (input.testSlug === "visual-tracking") return authorizeTracking(input.metrics ?? {});
  if (input.testSlug === "visual-memory") return authorizeMemory(input.metrics ?? {});
  if (input.testSlug === "reaction-time") return authorizeReaction(input);
  if (input.testSlug === "peripheral-vision") return authorizePeripheral(input.metrics ?? {});
  return authorizeScanning(input.metrics ?? {});
}

function authorizeSequential(input: Submission) {
  const invalid = sequentialSubmissionError({
    score: input.score ?? -1,
    accuracy: input.accuracy ?? -1,
    correctAnswers: input.correctAnswers ?? -1,
    errors: input.errors ?? -1,
    durationMs: input.durationMs ?? 0,
    metrics: input.metrics,
  });
  if (invalid) return { ok: false as const, error: invalid };
  return {
    ok: true as const,
    result: {
      score: input.score ?? 0,
      accuracy: input.accuracy ?? 0,
      correctAnswers: input.correctAnswers ?? 0,
      errors: input.errors ?? 0,
      averageReactionMs: 0,
      bestReactionMs: 0,
      durationMs: input.durationMs ?? 0,
      metrics: input.metrics ?? {},
    },
  };
}

function authorizeTracking(metrics: Record<string, unknown>) {
  const reactionTimes = numberList(metrics.reactionTimes, 0, VISUAL_TRACKING_CONFIG.durationMs, 300);
  const wrongClicks = whole(metrics.wrongClicks, 0, 500);
  if (!reactionTimes || wrongClicks == null) return reject("Suivi visuel incomplet.");
  const built = buildVisualTrackingResult({
    reactionTimes,
    wrongClicks,
    duration: VISUAL_TRACKING_CONFIG.durationMs,
  });
  return accept(built, {
    targetsFound: built.targetsFound,
    wrongClicks,
    reactionTimes,
  });
}

function authorizeMemory(metrics: Record<string, unknown>) {
  const roundsCompleted = whole(metrics.roundsCompleted, 0, 40);
  const correctCells = whole(metrics.correctCells, 0, 200);
  const wrongClicks = whole(metrics.wrongClicks, 0, 500);
  const responseTimes = numberList(metrics.responseTimes, 0, VISUAL_MEMORY_CONFIG.durationMs, 40);
  if (
    roundsCompleted == null ||
    correctCells == null ||
    wrongClicks == null ||
    !responseTimes ||
    responseTimes.length !== roundsCompleted
  ) {
    return reject("Mémoire visuelle incomplète.");
  }
  const partial = correctCells - roundsCompleted * VISUAL_MEMORY_CONFIG.targetsPerRound;
  if (partial < 0 || partial >= VISUAL_MEMORY_CONFIG.targetsPerRound) {
    return reject("Cases et manches incohérentes.");
  }
  const built = buildVisualMemoryResult({
    roundsCompleted,
    correctCells,
    wrongClicks,
    responseTimes,
    duration: VISUAL_MEMORY_CONFIG.durationMs,
  });
  return accept(built, { roundsCompleted, correctCells, wrongClicks, responseTimes });
}

function authorizeReaction(input: Submission) {
  const metrics = input.metrics ?? {};
  const reactionTimes = numberList(metrics.reactionTimes, 0, 10_000, REACTION_TIME_CONFIG.attempts);
  const falseStarts = whole(metrics.falseStarts, 0, 50);
  const durationMs = whole(input.durationMs, 1, 15 * 60 * 1000);
  if (!reactionTimes || reactionTimes.length !== REACTION_TIME_CONFIG.attempts || falseStarts == null || durationMs == null) {
    return reject("Temps de réaction incomplet.");
  }
  const built = buildReactionTimeResult({ reactionTimes, falseStarts, duration: durationMs });
  return accept(built, {
    attempts: built.attempts,
    falseStarts,
    worstReactionTime: built.worstReactionTime,
    reactionTimes,
    durationMs,
  });
}

function authorizePeripheral(metrics: Record<string, unknown>) {
  const reactionTimes = numberList(
    metrics.reactionTimes,
    0,
    PERIPHERAL_VISION_CONFIG.stimulusVisibleMs + 100,
    80,
  );
  const wrongAnswers = whole(metrics.wrongAnswers, 0, 80);
  const missed = whole(metrics.missed, 0, 80);
  const leftTrials = whole(metrics.leftTrials, 0, 80);
  const leftCorrect = whole(metrics.leftCorrect, 0, 80);
  const rightTrials = whole(metrics.rightTrials, 0, 80);
  const rightCorrect = whole(metrics.rightCorrect, 0, 80);
  if (
    !reactionTimes ||
    wrongAnswers == null ||
    missed == null ||
    leftTrials == null ||
    leftCorrect == null ||
    rightTrials == null ||
    rightCorrect == null
  ) {
    return reject("Vision périphérique incomplète.");
  }
  if (leftCorrect > leftTrials || rightCorrect > rightTrials) return reject("Comptes latéraux incohérents.");
  if (leftCorrect + rightCorrect !== reactionTimes.length) return reject("Comptes latéraux incohérents.");
  if (leftTrials + rightTrials !== reactionTimes.length + wrongAnswers + missed) {
    return reject("Comptes latéraux incohérents.");
  }
  const built = buildPeripheralVisionResult({
    reactionTimes,
    wrongAnswers,
    missed,
    sideStats: {
      left: { trials: leftTrials, correct: leftCorrect },
      right: { trials: rightTrials, correct: rightCorrect },
    },
    duration: PERIPHERAL_VISION_CONFIG.durationMs,
  });
  if (built.trials !== leftTrials + rightTrials) return reject("Comptes latéraux incohérents.");
  return accept(built, {
    trials: built.trials,
    missed,
    wrongAnswers,
    leftAccuracy: built.leftAccuracy,
    rightAccuracy: built.rightAccuracy,
    leftTrials,
    leftCorrect,
    rightTrials,
    rightCorrect,
    reactionTimes,
  });
}

function authorizeScanning(metrics: Record<string, unknown>) {
  if (!Array.isArray(metrics.attempts) || metrics.attempts.length !== SCANNING_SEQUENCES.length) {
    return reject("Lecture du jeu incomplète.");
  }
  const seen = new Set<number>();
  let correctAnswers = 0;
  let missed = 0;
  let incorrect = 0;
  const questionTimes: number[] = [];
  const totals = { closest: 0, defender: 0, free: 0 };
  const hits = { closest: 0, defender: 0, free: 0 };
  for (const attempt of metrics.attempts) {
    if (!attempt || typeof attempt !== "object") return reject("Situation illisible.");
    const row = attempt as { index?: unknown; playerId?: unknown; responseMs?: unknown };
    if (typeof row.index !== "number" || !Number.isInteger(row.index) || seen.has(row.index)) {
      return reject("Situations incohérentes.");
    }
    const sequence = SCANNING_SEQUENCES[row.index];
    if (!sequence || typeof row.responseMs !== "number" || !Number.isFinite(row.responseMs)) {
      return reject("Situation illisible.");
    }
    seen.add(row.index);
    const playerId = row.playerId;
    const isMiss = playerId == null;
    if (isMiss && row.responseMs !== SCANNING_LIMIT_MS) return reject("Temps d'absence invalide.");
    if (!isMiss && (row.responseMs <= 0 || row.responseMs > SCANNING_LIMIT_MS)) {
      return reject("Temps de réponse invalide.");
    }
    if (!isMiss && (typeof playerId !== "string" || !sequence.players.some((player) => player.playerId === playerId))) {
      return reject("Joueur inconnu dans la situation.");
    }
    const correct = !isMiss && playerId === correctPlayer(sequence).playerId;
    if (isMiss) missed += 1;
    else if (correct) correctAnswers += 1;
    else incorrect += 1;
    totals[sequence.challenge] += 1;
    if (correct) hits[sequence.challenge] += 1;
    questionTimes[row.index] = Math.round(row.responseMs);
  }
  if (
    seen.size !== SCANNING_SEQUENCES.length ||
    questionTimes.length !== SCANNING_SEQUENCES.length ||
    questionTimes.some((value) => typeof value !== "number")
  ) {
    return reject("Situations incohérentes.");
  }
  const accuracy = calculateAccuracy(correctAnswers, incorrect + missed);
  const durationMs = questionTimes.reduce((sum, value) => sum + value, 0);
  const average = Math.round(durationMs / questionTimes.length);
  return {
    ok: true as const,
    result: {
      score: Math.round(accuracy),
      accuracy,
      correctAnswers,
      errors: incorrect + missed,
      averageReactionMs: average,
      bestReactionMs: Math.min(...questionTimes),
      durationMs,
      metrics: {
        missed,
        incorrect,
        closestCorrect: hits.closest,
        closestTotal: totals.closest,
        defenderCorrect: hits.defender,
        defenderTotal: totals.defender,
        freeCorrect: hits.free,
        freeTotal: totals.free,
        questionTimes,
      },
    },
  };
}

function accept(
  built: {
    score: number;
    accuracy: number;
    correctAnswers: number;
    errors: number;
    averageReactionTime: number;
    bestReactionTime: number;
    duration: number;
  },
  metrics: Record<string, unknown>,
) {
  return {
    ok: true as const,
    result: {
      score: built.score,
      accuracy: built.accuracy,
      correctAnswers: built.correctAnswers,
      errors: built.errors,
      averageReactionMs: built.averageReactionTime,
      bestReactionMs: built.bestReactionTime,
      durationMs: built.duration,
      metrics,
    },
  };
}

function reject(error: string) {
  return { ok: false as const, error };
}

function whole(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function numberList(value: unknown, min: number, max: number, limit: number) {
  if (!Array.isArray(value) || value.length > limit) return null;
  const numbers: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item) || item < min || item > max) return null;
    numbers.push(item);
  }
  return numbers;
}
