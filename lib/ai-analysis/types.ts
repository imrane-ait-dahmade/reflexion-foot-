export const REPORT_TYPES = ["test", "session", "progress"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "not_eligible",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PROMPT_VERSION = "2026-11-11.1";

export type MetricValue = number | string | boolean | null;

export type AnalysisMetric = {
  key: string;
  label: string;
  value: MetricValue;
  unit: string;
};

export type TestSnapshot = {
  testResultId: string;
  testSlug: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics: Record<string, MetricValue>;
  completedAt: string;
};

export type CohortReference = {
  testSlug: string;
  sampleSize: number;
  meanScore: number | null;
  medianScore: number | null;
  playerScore: number;
  percentile: number | null;
  basis: "app_players" | "too_small";
};

export type StudyReference = {
  construct: string;
  source: string;
  publishedValue: string | null;
  useRule: string;
};

export type AnalysisReference = {
  samePlayerHistoryUsed: false;
  cohort: CohortReference | null;
  study: StudyReference | null;
};

export type AnalysisContext = {
  reportType: ReportType;
  sessionId: string;
  sessionPlayerId: string;
  displayName: string;
  assignedTests: string[];
  currentTests: TestSnapshot[];
  focusTestSlug?: string;
  reference: AnalysisReference;
  comparisons: {
    sessionId: string;
    completedAt: string;
    tests: TestSnapshot[];
  }[];
  metricDefinitions: { key: string; meaning: string; unit: string }[];
  dataQuality: {
    completedCount: number;
    assignedCount: number;
    comparableSessions: number;
    notes: string[];
  };
  allowedMetricKeys: string[];
};

export type Observation = {
  title: string;
  explanation: string;
  evidence_metric_keys: string[];
  interpretation: "strength" | "development" | "neutral" | "insufficient";
  priority: "low" | "medium" | "high" | null;
};

export type TrainingRecommendation = {
  title: string;
  objective: string;
  practical_exercise: string;
  duration_or_repetitions: string | null;
  related_metric_keys: string[];
  coaching_notes: string;
};

export type LocalizedReport = {
  executive_summary: string;
  what_was_assessed: string;
  performance_observations: Observation[];
  strengths: Observation[];
  development_areas: Observation[];
  training_recommendations: TrainingRecommendation[];
  coach_action_plan: string[];
  limitations: string[];
};

export type ReportContent = {
  report_type: ReportType;
  confidence: "low" | "medium" | "high";
  confidence_reason: string;
  fr: LocalizedReport;
  ar: LocalizedReport;
};

export type StoredReport = {
  id: string;
  sessionId: string;
  sessionPlayerId: string;
  testResultId: string | null;
  reportType: ReportType;
  status: ReportStatus;
  reportData: ReportContent | { reason: string } | null;
  model: string | null;
  promptVersion: string | null;
  inputTokens: number;
  outputTokens: number;
  errorCode: string | null;
  generatedAt: string | null;
};

export type ReportKey = {
  sessionId: string;
  sessionPlayerId: string;
  reportType: ReportType;
  testResultId: string | null;
};
