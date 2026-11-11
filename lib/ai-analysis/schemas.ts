import { z } from "zod";

const metricKey = z.string().min(1).max(80);
const observation = z
  .object({
    title: z.string().min(1).max(160),
    explanation: z.string().min(1).max(900),
    evidence_metric_keys: z.array(metricKey).max(8),
    interpretation: z.enum(["strength", "development", "neutral", "insufficient"]),
    priority: z.enum(["low", "medium", "high"]).nullable(),
  })
  .strict();

const recommendation = z
  .object({
    title: z.string().min(1).max(160),
    objective: z.string().min(1).max(400),
    practical_exercise: z.string().min(1).max(900),
    duration_or_repetitions: z.string().max(120).nullable(),
    related_metric_keys: z.array(metricKey).max(8),
    coaching_notes: z.string().min(1).max(500),
  })
  .strict();

const localized = z
  .object({
    executive_summary: z.string().min(1).max(2000),
    what_was_assessed: z.string().min(1).max(1200),
    performance_observations: z.array(observation).max(12),
    strengths: z.array(observation).max(8),
    development_areas: z.array(observation).max(8),
    training_recommendations: z.array(recommendation).max(8),
    coach_action_plan: z.array(z.string().min(1).max(400)).max(8),
    limitations: z.array(z.string().min(1).max(500)).max(8),
  })
  .strict();

export const reportContentSchema = z
  .object({
    report_type: z.enum(["test", "session", "progress"]),
    confidence: z.enum(["low", "medium", "high"]),
    confidence_reason: z.string().min(1).max(400),
    fr: localized,
    ar: localized,
  })
  .strict();

export function parseReportContent(value: unknown, allowedMetricKeys: string[]) {
  if (value == null) {
    return { ok: false as const, error: "empty_response" };
  }
  const parsed = reportContentSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false as const, error: "invalid_schema" };
  }
  const allowed = new Set(allowedMetricKeys);
  const keys = [
    ...parsed.data.fr.performance_observations,
    ...parsed.data.fr.strengths,
    ...parsed.data.fr.development_areas,
    ...parsed.data.ar.performance_observations,
    ...parsed.data.ar.strengths,
    ...parsed.data.ar.development_areas,
  ].flatMap((item) => item.evidence_metric_keys);
  const recommendations = [
    ...parsed.data.fr.training_recommendations,
    ...parsed.data.ar.training_recommendations,
  ].flatMap((item) => item.related_metric_keys);
  const unknown = [...keys, ...recommendations].filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    return { ok: false as const, error: "unknown_metric_key" };
  }
  if (!parsed.data.fr.executive_summary || !parsed.data.ar.executive_summary) {
    return { ok: false as const, error: "missing_language" };
  }
  return { ok: true as const, data: parsed.data };
}
