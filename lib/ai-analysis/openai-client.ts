import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { analysisModel } from "./config";
import { analysisInstructions, analysisPayload } from "./analysis-prompts";
import { reportContentSchema } from "./schemas";
import type { AnalysisContext } from "./types";

export type GeneratedReport = {
  parsed: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

export async function generateWithOpenAI(
  context: AnalysisContext,
): Promise<GeneratedReport> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("missing_api_key");
  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: analysisModel(),
    max_output_tokens: 3500,
    input: [
      { role: "system", content: analysisInstructions() },
      { role: "user", content: JSON.stringify(analysisPayload(context)) },
    ],
    text: { format: zodTextFormat(reportContentSchema, "coach_report") },
  });
  return {
    parsed: response.output_parsed,
    model: response.model ?? analysisModel(),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
