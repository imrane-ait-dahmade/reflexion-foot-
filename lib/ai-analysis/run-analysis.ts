import {
  orchestrateGroupResult,
  orchestratePlayerResult,
} from "./analysis-orchestrator";
import {
  createAnalysisStore,
  loadSessionGroupBundle,
} from "./analysis-repository";
import { analysisEnabled } from "./config";
import { generateWithOpenAI } from "./openai-client";
import type { ReportType } from "./types";

export async function runAnalysisForPlayer(
  sessionPlayerId: string,
  options?: { reportType?: ReportType; testResultId?: string; retry?: boolean },
) {
  return orchestratePlayerResult(
    sessionPlayerId,
    {
      store: createAnalysisStore(),
      generate: generateWithOpenAI,
      enabled: analysisEnabled(),
    },
    options,
  );
}

export async function runAnalysisForGroup(
  sessionId: string,
  options?: { retry?: boolean },
) {
  const bundle = await loadSessionGroupBundle(sessionId);
  if (!bundle) return { skipped: "missing_session" as const };
  return orchestrateGroupResult(
    bundle,
    {
      store: createAnalysisStore(),
      generate: generateWithOpenAI,
      enabled: analysisEnabled(),
    },
    options,
  );
}
