import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { CognitiveTestResponse } from "@/lib/api/types";

/**
 * Cognitive tests catalogue (FastAPI `/cognitive-tests`).
 * Exercise challenge/scoring engines remain in the Next.js V1 app for now.
 */
export const exercisesService = {
  listCognitiveTests(signal?: AbortSignal): Promise<CognitiveTestResponse[]> {
    return apiClient.get<CognitiveTestResponse[]>(endpoints.cognitiveTests.list, {
      auth: "staff",
      signal,
    });
  },
};
