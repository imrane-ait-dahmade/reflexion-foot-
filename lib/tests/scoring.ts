import { PERIPHERAL_VISION_SCORING } from "./peripheral-vision/config";
import type {
  PeripheralVisionTestResult,
  Side,
  SideStats,
} from "./peripheral-vision/types";
import { REACTION_TIME_SCORING } from "./reaction-time/config";
import type { ReactionTimeTestResult } from "./reaction-time/types";
import { VISUAL_MEMORY_SCORING } from "./visual-memory/config";
import type { VisualMemoryTestResult } from "./visual-memory/types";
import { VISUAL_TRACKING_SCORING } from "./visual-tracking/config";
import type { VisualTrackingTestResult } from "./visual-tracking/types";
import type { ReactionStats } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Percentage of correct clicks among all clicks, rounded to one decimal. */
export function calculateAccuracy(correct: number, errors: number) {
  const attempts = correct + errors;
  if (attempts === 0) return 0;
  return Math.round((correct / attempts) * 1000) / 10;
}

export function calculateReactionStats(reactionTimes: number[]): ReactionStats {
  if (reactionTimes.length === 0) {
    return { averageReactionTime: 0, bestReactionTime: 0 };
  }
  const total = reactionTimes.reduce((sum, time) => sum + time, 0);
  return {
    averageReactionTime: Math.round(total / reactionTimes.length),
    bestReactionTime: Math.round(Math.min(...reactionTimes)),
  };
}

/**
 * Score out of 100 = targets found (60) + accuracy (20) + speed (20).
 * Each part is linear between 0 and its weight.
 */
export function calculateVisualTrackingScore(
  {
    targetsFound,
    accuracy,
    averageReactionTime,
  }: { targetsFound: number; accuracy: number; averageReactionTime: number },
  rules = VISUAL_TRACKING_SCORING,
) {
  if (targetsFound === 0) return 0;

  const targetsPart = clamp01(targetsFound / rules.targetGoal);
  const accuracyPart = clamp01(accuracy / 100);
  const speedPart = clamp01(
    (rules.slowReactionMs - averageReactionTime) /
      (rules.slowReactionMs - rules.fastReactionMs),
  );

  const score =
    targetsPart * rules.targetsWeight +
    accuracyPart * rules.accuracyWeight +
    speedPart * rules.speedWeight;

  return Math.min(rules.maxScore, Math.round(score));
}

export function buildVisualTrackingResult(params: {
  reactionTimes: number[];
  wrongClicks: number;
  duration: number;
}): VisualTrackingTestResult {
  const { reactionTimes, wrongClicks, duration } = params;
  const targetsFound = reactionTimes.length;
  const accuracy = calculateAccuracy(targetsFound, wrongClicks);
  const reactionStats = calculateReactionStats(reactionTimes);

  return {
    score: calculateVisualTrackingScore({
      targetsFound,
      accuracy,
      averageReactionTime: reactionStats.averageReactionTime,
    }),
    correctAnswers: targetsFound,
    targetsFound,
    errors: wrongClicks,
    accuracy,
    ...reactionStats,
    reactionTimes,
    duration: Math.round(duration),
  };
}

/**
 * Score out of 100 = correct cells (50) + accuracy (30) + speed (20).
 * Accuracy and speed only count once at least one round is completed.
 */
export function calculateVisualMemoryScore(
  {
    correctCells,
    roundsCompleted,
    accuracy,
    averageResponseTime,
  }: {
    correctCells: number;
    roundsCompleted: number;
    accuracy: number;
    averageResponseTime: number;
  },
  rules = VISUAL_MEMORY_SCORING,
) {
  if (correctCells === 0) return 0;

  const progressPart = clamp01(correctCells / rules.correctCellsGoal);
  let score = progressPart * rules.progressWeight;

  if (roundsCompleted > 0) {
    const accuracyPart = clamp01(accuracy / 100);
    const speedPart = clamp01(
      (rules.slowResponseMs - averageResponseTime) /
        (rules.slowResponseMs - rules.fastResponseMs),
    );
    score += accuracyPart * rules.accuracyWeight + speedPart * rules.speedWeight;
  }

  return Math.min(rules.maxScore, Math.round(score));
}

export function buildVisualMemoryResult(params: {
  roundsCompleted: number;
  correctCells: number;
  wrongClicks: number;
  responseTimes: number[];
  duration: number;
}): VisualMemoryTestResult {
  const { roundsCompleted, correctCells, wrongClicks, responseTimes, duration } =
    params;
  const accuracy = calculateAccuracy(correctCells, wrongClicks);
  const responseStats = calculateReactionStats(responseTimes);

  return {
    score: calculateVisualMemoryScore({
      correctCells,
      roundsCompleted,
      accuracy,
      averageResponseTime: responseStats.averageReactionTime,
    }),
    roundsCompleted,
    correctAnswers: correctCells,
    correctCells,
    errors: wrongClicks,
    accuracy,
    ...responseStats,
    responseTimes,
    duration: Math.round(duration),
  };
}

/**
 * Score out of 100: linear from 100 (fastReactionMs) to 0 (slowReactionMs),
 * minus a penalty per false start.
 */
export function calculateReactionTimeScore(
  {
    averageReactionTime,
    falseStarts,
  }: { averageReactionTime: number; falseStarts: number },
  rules = REACTION_TIME_SCORING,
) {
  if (averageReactionTime <= 0) return 0;

  const speedPart = clamp01(
    (rules.slowReactionMs - averageReactionTime) /
      (rules.slowReactionMs - rules.fastReactionMs),
  );
  const score =
    speedPart * rules.maxScore - falseStarts * rules.falseStartPenalty;

  return Math.max(0, Math.min(rules.maxScore, Math.round(score)));
}

export function buildReactionTimeResult(params: {
  reactionTimes: number[];
  falseStarts: number;
  duration: number;
}): ReactionTimeTestResult {
  const { reactionTimes, falseStarts, duration } = params;
  const attempts = reactionTimes.length;
  const reactionStats = calculateReactionStats(reactionTimes);

  return {
    score: calculateReactionTimeScore({
      averageReactionTime: reactionStats.averageReactionTime,
      falseStarts,
    }),
    attempts,
    correctAnswers: attempts,
    errors: falseStarts,
    falseStarts,
    accuracy: calculateAccuracy(attempts, falseStarts),
    ...reactionStats,
    worstReactionTime:
      attempts > 0 ? Math.round(Math.max(...reactionTimes)) : 0,
    reactionTimes,
    duration: Math.round(duration),
  };
}

/** Score out of 100 = accuracy (60) + speed (40), linear for each part. */
export function calculatePeripheralVisionScore(
  {
    accuracy,
    averageReactionTime,
  }: { accuracy: number; averageReactionTime: number },
  rules = PERIPHERAL_VISION_SCORING,
) {
  if (averageReactionTime <= 0) return 0;

  const accuracyPart = clamp01(accuracy / 100);
  const speedPart = clamp01(
    (rules.slowReactionMs - averageReactionTime) /
      (rules.slowReactionMs - rules.fastReactionMs),
  );
  const score =
    accuracyPart * rules.accuracyWeight + speedPart * rules.speedWeight;

  return Math.min(rules.maxScore, Math.round(score));
}

export function buildPeripheralVisionResult(params: {
  reactionTimes: number[];
  wrongAnswers: number;
  missed: number;
  sideStats: Record<Side, SideStats>;
  duration: number;
}): PeripheralVisionTestResult {
  const { reactionTimes, wrongAnswers, missed, sideStats, duration } = params;
  const correctAnswers = reactionTimes.length;
  const accuracy = calculateAccuracy(correctAnswers, wrongAnswers + missed);
  const reactionStats = calculateReactionStats(reactionTimes);
  const sideAccuracy = ({ trials, correct }: SideStats) =>
    calculateAccuracy(correct, trials - correct);

  return {
    score: calculatePeripheralVisionScore({
      accuracy,
      averageReactionTime: reactionStats.averageReactionTime,
    }),
    trials: correctAnswers + wrongAnswers + missed,
    correctAnswers,
    wrongAnswers,
    missed,
    errors: wrongAnswers + missed,
    accuracy,
    leftAccuracy: sideAccuracy(sideStats.left),
    rightAccuracy: sideAccuracy(sideStats.right),
    ...reactionStats,
    reactionTimes,
    duration: Math.round(duration),
  };
}
