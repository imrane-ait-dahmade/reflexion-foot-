/**
 * Domain types mirroring lib/db/schema.sql.
 * Keep in sync when the SQL schema changes.
 */

export type UserRole = "coach" | "player";

export type SessionStatus = "draft" | "active" | "closed";

export type TestSlug =
  | "visual-tracking"
  | "visual-memory"
  | "reaction-time"
  | "peripheral-vision";

export type User = {
  id: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  authUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TrainingSession = {
  id: string;
  coachId: string;
  /** Short join code shared with players, e.g. "ABC123". */
  code: string;
  title: string;
  status: SessionStatus;
  randomizeExercises: boolean;
  exerciseCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SessionExercise = {
  id: string;
  sessionId: string;
  testSlug: TestSlug;
  sortOrder: number;
  createdAt: string;
};

export type SessionPlayer = {
  id: string;
  sessionId: string;
  userId: string | null;
  displayName: string;
  joinedAt: string;
};

/** Shared numeric metrics stored as columns on every result row. */
export type SharedResultMetrics = {
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
};

export type VisualTrackingMetrics = {
  targetsFound: number;
  wrongClicks: number;
};

export type VisualMemoryMetrics = {
  roundsCompleted: number;
  correctCells: number;
};

export type ReactionTimeMetrics = {
  attempts: number;
  falseStarts: number;
  worstReactionTime: number;
};

export type PeripheralVisionMetrics = {
  trials: number;
  missed: number;
  wrongAnswers: number;
  leftAccuracy: number;
  rightAccuracy: number;
};

export type TestSpecificMetrics =
  | VisualTrackingMetrics
  | VisualMemoryMetrics
  | ReactionTimeMetrics
  | PeripheralVisionMetrics;

export type TestResultRow = SharedResultMetrics & {
  id: string;
  sessionId: string;
  sessionPlayerId: string;
  testSlug: TestSlug;
  metrics: TestSpecificMetrics | Record<string, unknown>;
  startedAt: string | null;
  completedAt: string;
  createdAt: string;
};

/** Coach dashboard row from session_player_summary. */
export type SessionPlayerSummary = {
  sessionId: string;
  sessionPlayerId: string;
  displayName: string;
  joinedAt: string;
  completedTests: number;
  averageScore: number;
  totalScore: number;
};

/**
 * Typical product flow encoded in this schema:
 *
 * 1. Coach creates TrainingSession (status: draft) → gets `code`
 * 2. SessionExercise rows are set (manual or random on activation)
 * 3. Coach sets status to active and shares the code
 * 4. Player joins → SessionPlayer
 * 5. Player completes each exercise → TestResultRow
 * 6. Coach reads SessionPlayerSummary + TestResultRow for the session
 */
