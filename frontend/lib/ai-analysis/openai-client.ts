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
  // Keep bilingual headroom, but lower caps so generation finishes sooner.
  const maxOutputTokens =
    context.reportType === "session" || context.reportType === "group"
      ? 5500
      : 3500;
  const response = await client.responses.parse({
    model: analysisModel(),
    max_output_tokens: maxOutputTokens,
    input: [
      { role: "system", content: analysisInstructions() },
      { role: "user", content: JSON.stringify(analysisPayload(context)) },
    ],
    text: { format: zodTextFormat(reportContentSchema, "coach_report") },
  });
  if (!response.output_parsed) {
    throw new Error(
      response.status === "incomplete" || response.incomplete_details
        ? "incomplete_response"
        : "empty_response",
    );
  }
  return {
    parsed: response.output_parsed,
    model: response.model ?? analysisModel(),
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
