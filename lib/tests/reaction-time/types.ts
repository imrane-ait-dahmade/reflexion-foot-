import type { TestResult } from "../types";

export type ReactionAttemptPhase = "waiting" | "stimulus" | "tooEarly";

export type ReactionTimeTestResult = TestResult & {
  attempts: number;
  worstReactionTime: number;
  falseStarts: number;
  reactionTimes: number[];
};
