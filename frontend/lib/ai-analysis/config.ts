export function analysisEnabled() {
  return (
    process.env.AI_ANALYSIS_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

export function analysisModel() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}
