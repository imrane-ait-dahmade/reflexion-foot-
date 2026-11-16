import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PlayerSessionProgressResponse } from "@/lib/api/types";
import type { TestSlug } from "@/lib/db/types";
import { loadPlayerSession } from "@/lib/sessions/player-session";
import {
  mapPlayerProgress,
  playerApiErrorMessage,
} from "@/lib/sessions/player-v2";

const OBSERVATION_SLUGS = new Set<TestSlug>([
  "visual-tracking",
  "visual-memory",
  "reaction-time",
  "peripheral-vision",
  "football-visual-scanning",
  "sequential-visual-search",
]);

export type ClientResultPayload = {
  sessionPlayerId: string;
  testSlug: TestSlug;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics?: Record<string, unknown>;
};

/** Submit exercise result to FastAPI V2 observation/complete contract. */
export async function submitClientResult(payload: ClientResultPayload) {
  const stored = loadPlayerSession();
  if (!stored) {
    throw new Error("Session joueur introuvable sur cet appareil.");
  }
  if (stored.sessionPlayerId !== payload.sessionPlayerId) {
    throw new Error("Session joueur incohérente. Rejoins à nouveau.");
  }
  if (!OBSERVATION_SLUGS.has(payload.testSlug)) {
    throw new Error(
      `Exercice ${payload.testSlug} n'utilise pas le contrat observation.`,
    );
  }

  try {
    const updated = await apiClient.post<PlayerSessionProgressResponse>(
      endpoints.playerExercises.observationComplete(payload.testSlug),
      {
        score: payload.score,
        accuracy: payload.accuracy,
        response_time_ms: Math.max(
          0,
          Math.round(payload.durationMs || payload.averageReactionMs),
        ),
        correct_answers: payload.correctAnswers,
        errors: payload.errors,
        average_reaction_ms: Math.max(0, Math.round(payload.averageReactionMs)),
        best_reaction_ms: Math.max(0, Math.round(payload.bestReactionMs)),
        duration_ms: Math.max(0, Math.round(payload.durationMs)),
        metrics: payload.metrics ?? {},
      },
      { auth: "player" },
    );
    const progress = mapPlayerProgress(updated, stored.code);
    return {
      id: progress.exercises.find((ex) => ex.testSlug === payload.testSlug)
        ?.sessionExerciseId,
      progress,
    };
  } catch (err) {
    const message = playerApiErrorMessage(err, "Échec de l'enregistrement.");
    const lower = message.toLowerCase();
    if (
      lower.includes("already") ||
      lower.includes("déjà") ||
      lower.includes("already completed")
    ) {
      throw new Error("Déjà enregistré.");
    }
    throw new Error(message);
  }
}
