import { buildContext, playerFinished, type PlayerBundle } from "./analysis-context";
import { isCompleteResult } from "./metrics-context";
import { parseReportContent } from "./schemas";
import type {
  ReportContent,
  ReportKey,
  ReportStatus,
  ReportType,
  StoredReport,
} from "./types";
import { PROMPT_VERSION } from "./types";

export type AnalysisStore = {
  loadPlayer(sessionPlayerId: string): Promise<PlayerBundle | null>;
  findReport(key: ReportKey): Promise<StoredReport | null>;
  claim(key: ReportKey): Promise<StoredReport>;
  complete(
    id: string,
    data: ReportContent,
    usage: { model: string; inputTokens: number; outputTokens: number },
  ): Promise<void>;
  fail(id: string, errorCode: string): Promise<void>;
  markIneligible(key: ReportKey, reason: string): Promise<void>;
};

export type OrchestratorDeps = {
  store: AnalysisStore;
  generate: (context: import("./types").AnalysisContext) => Promise<{
    parsed: unknown;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }>;
  enabled: boolean;
};

function failureCode(error: unknown) {
  const message = error instanceof Error ? error.message : "provider_error";
  if (message.includes(".optional()")) return "schema_optional_field";
  if (message === "missing_api_key") return "missing_api_key";
  if (message === "incomplete_response" || message === "empty_response") {
    return message;
  }
  const compact = message.replace(/\s+/g, " ").trim().slice(0, 80);
  return compact || "provider_error";
}

function key(
  bundle: PlayerBundle,
  reportType: ReportType,
  testResultId: string | null,
): ReportKey {
  return {
    sessionId: bundle.sessionId,
    sessionPlayerId: bundle.sessionPlayerId,
    reportType,
    testResultId,
  };
}

async function produce(
  deps: OrchestratorDeps,
  bundle: PlayerBundle,
  reportType: ReportType,
  testResultId: string | null,
  force: boolean,
) {
  const reportKey = key(bundle, reportType, testResultId);
  const existing = await deps.store.findReport(reportKey);
  if (existing && (!force || existing.status === "completed" || existing.status === "not_eligible")) {
    return existing.status;
  }

  const context = buildContext(bundle, reportType, testResultId ?? undefined);
  if ("eligible" in context) {
    await deps.store.markIneligible(reportKey, context.reason);
    return "not_eligible" as ReportStatus;
  }

  const row = await deps.store.claim(reportKey);
  try {
    const generated = await deps.generate(context);
    const parsed = parseReportContent(generated.parsed, context.allowedMetricKeys);
    if (!parsed.ok || parsed.data.report_type !== reportType) {
      await deps.store.fail(row.id, parsed.ok ? "report_type_mismatch" : parsed.error);
      return "failed" as ReportStatus;
    }
    await deps.store.complete(row.id, parsed.data, {
      model: generated.model,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
    });
    return "completed" as ReportStatus;
  } catch (error) {
    await deps.store.fail(row.id, failureCode(error));
    return "failed" as ReportStatus;
  }
}

export async function orchestratePlayerResult(
  sessionPlayerId: string,
  deps: OrchestratorDeps,
  options?: { reportType?: ReportType; testResultId?: string; retry?: boolean },
) {
  if (!deps.enabled) return { skipped: "disabled" as const };
  const bundle = await deps.store.loadPlayer(sessionPlayerId);
  if (!bundle) return { skipped: "missing_player" as const };

  const outcomes: { reportType: ReportType; status: ReportStatus }[] = [];
  const retry = Boolean(options?.retry);
  const only = options?.reportType;

  if (!only || only === "test") {
    const focusId = options?.testResultId ?? bundle.results.at(-1)?.id;
    const focus = bundle.results.find((item) => item.id === focusId);
    if (focus && isCompleteResult(focus)) {
      outcomes.push({
        reportType: "test",
        status: await produce(deps, bundle, "test", focus.id, retry),
      });
    }
  }

  const finished = playerFinished(
    bundle.assigned,
    bundle.results.filter(isCompleteResult).map((item) => item.testSlug),
  );
  if (only === "session" && !finished) {
    return { skipped: "incomplete" as const, promptVersion: PROMPT_VERSION, outcomes };
  }
  if (finished && (!only || only === "session")) {
    outcomes.push({
      reportType: "session",
      status: await produce(deps, bundle, "session", null, retry && only === "session"),
    });
  }
  if (finished && (!only || only === "progress")) {
    outcomes.push({
      reportType: "progress",
      status: await produce(deps, bundle, "progress", null, retry && only === "progress"),
    });
  }

  return { skipped: null, promptVersion: PROMPT_VERSION, outcomes };
}
