/**
 * Results HTTP API status (FastAPI V2).
 *
 * There is currently **no** dedicated staff `/results` router.
 * Player result submission exists as:
 *   POST /api/v1/player/session/exercises/{session_exercise_id}/complete
 * via `sessionsService.completeExercise`.
 *
 * Models (`TestAttempt`, `TestResult`) exist in the backend DB layer only.
 * When FastAPI exposes results endpoints, add typed methods here.
 */

import { sessionsService } from "@/lib/api/sessions.service";
import type {
  CompleteExerciseRequest,
  PlayerSessionProgressResponse,
} from "@/lib/api/types";

export const resultsService = {
  /**
   * Submit a completed exercise attempt (player JWT).
   * Delegates to the only available FastAPI results write path.
   */
  submitPlayerExercise(
    sessionExerciseId: string,
    payload: CompleteExerciseRequest,
    signal?: AbortSignal,
  ): Promise<PlayerSessionProgressResponse> {
    return sessionsService.completeExercise(sessionExerciseId, payload, signal);
  },
};
