import type { TestResult } from "../types";

export type VisualTrackingTestResult = TestResult & {
  targetsFound: number;
  /** Time to find each target, in ms, measured from when it was assigned. */
  reactionTimes: number[];
};
