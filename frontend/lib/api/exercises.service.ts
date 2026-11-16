import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { CognitiveTestResponse } from "@/lib/api/types";

/**
 * Cognitive tests catalogue (FastAPI `/cognitive-tests`).
 * Challenge engines: see `challenge-engines.service.ts`.
 */
export const exercisesService = {
  listCognitiveTests(signal?: AbortSignal): Promise<CognitiveTestResponse[]> {
    return apiClient.get<CognitiveTestResponse[]>(endpoints.cognitiveTests.list, {
      auth: "staff",
      signal,
    });
  },
};
