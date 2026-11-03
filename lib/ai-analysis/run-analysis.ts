import { orchestratePlayerResult } from "./analysis-orchestrator";
import { createAnalysisStore } from "./analysis-repository";
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
