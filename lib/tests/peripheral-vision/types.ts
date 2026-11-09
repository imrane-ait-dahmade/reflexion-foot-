import type { TestResult } from "../types";

export type Side = "left" | "right";

export type PeripheralPositionId =
  | "left"
  | "right"
  | "upper-left"
  | "upper-right"
  | "lower-left"
  | "lower-right";

export type PeripheralPosition = {
  id: PeripheralPositionId;
  side: Side;
  /** Center of the target, in % of the test area. */
  xPercent: number;
  yPercent: number;
};

export type TrialPhase = "interval" | "stimulus";

export type SideStats = { trials: number; correct: number };

export type PeripheralVisionTestResult = TestResult & {
  trials: number;
  wrongAnswers: number;
  missed: number;
  /** Percentages between 0 and 100. 0 when the side was never shown. */
  leftAccuracy: number;
  rightAccuracy: number;
  sideStats: Record<Side, SideStats>;
  reactionTimes: number[];
};
