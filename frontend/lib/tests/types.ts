export type TestPhase = "idle" | "running" | "finished";

export type TestResult = {
  score: number;
  correctAnswers: number;
  errors: number;
  /** Milliseconds, rounded. 0 when no correct answer was recorded. */
  averageReactionTime: number;
  /** Milliseconds, rounded. 0 when no correct answer was recorded. */
  bestReactionTime: number;
  /** Percentage between 0 and 100, rounded to one decimal. */
  accuracy: number;
  /** Effective test duration in milliseconds. */
  duration: number;
};

export type ReactionStats = Pick<
  TestResult,
  "averageReactionTime" | "bestReactionTime"
>;

export type TestDefinition = {
  slug: string;
  name: string;
  description: string;
  href: string;
};
