import type { TestResult } from "../types";

export type VisualMemoryRoundPhase = "memorize" | "answer";

/**
 * `averageReactionTime` / `bestReactionTime` hold the round response times:
 * from the end of the memorization phase to the last correct cell.
 */
export type VisualMemoryTestResult = TestResult & {
  roundsCompleted: number;
  correctCells: number;
  responseTimes: number[];
};
