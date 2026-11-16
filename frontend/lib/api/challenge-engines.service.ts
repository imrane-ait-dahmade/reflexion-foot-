/**
 * FastAPI V2 challenge engines (Digit Memory, Dual Target Tracking).
 * Replaces active use of Next `/api/exercises/*` for these two slugs.
 */

import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { isApiError } from "@/lib/api/errors";

export type DigitStartResponse = {
  token: string;
  level: number;
  length: number;
};

export type DigitRevealResponse = {
  digit: number;
  shown: number;
  length: number;
  answer: boolean;
  token: string;
};

export type DigitAnswerResponse = {
  exact: boolean;
  positional: number;
  positionErrors: number;
  finished: boolean;
  level?: number;
  length?: number;
  token?: string;
  summary?: {
    maximumDigitsMemorized: number;
    levelsCompleted: number;
    incorrectSequences: number;
  };
};

export type DualChallenge = {
  level: number;
  totalLevels: number;
  objects: number;
  durationMs: number;
  speed: number;
  highlightIds: number[];
};

export type DualStartResponse = {
  token: string;
  challenge: DualChallenge;
};

export type DualSubmitResponse = {
  both: boolean;
  correctlyIdentifiedTargets: number;
  finished: boolean;
  token?: string;
  challenge?: DualChallenge;
  summary?: {
    correctlyIdentifiedTargets: number;
    incorrectSelections: number;
    difficultyLevelReached: number;
    accuracy: number;
  };
};

export function challengeEngineErrorMessage(
  err: unknown,
  fallback = "Impossible de continuer l'exercice.",
): string {
  if (isApiError(err)) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export const challengeEnginesService = {
  digitStart(): Promise<DigitStartResponse> {
    return apiClient.post<DigitStartResponse>(
      endpoints.playerExercises.digitMemory,
      { action: "start" },
      { auth: "player" },
    );
  },

  digitReveal(token: string): Promise<DigitRevealResponse> {
    return apiClient.post<DigitRevealResponse>(
      endpoints.playerExercises.digitMemory,
      { action: "digit", token },
      { auth: "player" },
    );
  },

  digitAnswer(token: string, answer: number[]): Promise<DigitAnswerResponse> {
    return apiClient.post<DigitAnswerResponse>(
      endpoints.playerExercises.digitMemory,
      { action: "answer", token, answer },
      { auth: "player" },
    );
  },

  dualStart(): Promise<DualStartResponse> {
    return apiClient.post<DualStartResponse>(
      endpoints.playerExercises.dualTargetTracking,
      { action: "start" },
      { auth: "player" },
    );
  },

  dualSubmit(token: string, selected: number[]): Promise<DualSubmitResponse> {
    return apiClient.post<DualSubmitResponse>(
      endpoints.playerExercises.dualTargetTracking,
      { action: "submit", token, selected },
      { auth: "player" },
    );
  },
};
