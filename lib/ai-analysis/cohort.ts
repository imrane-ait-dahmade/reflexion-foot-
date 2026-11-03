import type { CohortReference } from "./types";

const MIN_SAMPLE = 8;

export function cohortPosition(
  testSlug: string,
  playerScore: number,
  storedScores: number[],
): CohortReference {
  const scores = storedScores.some((score) => score === playerScore)
    ? storedScores.filter((score) => Number.isFinite(score))
    : [...storedScores.filter((score) => Number.isFinite(score)), playerScore];
  const sorted = [...scores].sort((a, b) => a - b);
  const sampleSize = sorted.length;
  if (sampleSize === 0) {
    return {
      testSlug,
      sampleSize: 0,
      meanScore: null,
      medianScore: null,
      playerScore,
      percentile: null,
      basis: "too_small",
    };
  }
  const meanScore = Math.round((sorted.reduce((sum, score) => sum + score, 0) / sampleSize) * 10) / 10;
  const mid = Math.floor(sampleSize / 2);
  const medianScore =
    sampleSize % 2 === 1
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  const below = sorted.filter((score) => score < playerScore).length;
  const equal = sorted.filter((score) => score === playerScore).length;
  const usable = sampleSize >= MIN_SAMPLE;
  return {
    testSlug,
    sampleSize,
    meanScore,
    medianScore,
    playerScore,
    percentile: usable ? Math.round((100 * (below + equal * 0.5)) / sampleSize) : null,
    basis: usable ? "app_players" : "too_small",
  };
}
