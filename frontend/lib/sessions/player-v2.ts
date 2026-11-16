/**
 * Player session bridge to FastAPI V2.
 * Replaces Next `/api/sessions/join`, `/api/players/.../progress`, `/api/results`.
 * Digit Memory + Dual Target challenges use FastAPI `/player/exercises/*`.
 */

import { isApiError } from "@/lib/api/errors";
import { sessionsService } from "@/lib/api/sessions.service";
import { tokenStore } from "@/lib/api/token-store";
import type {
  CompleteExerciseRequest,
  PlayerSessionProgressResponse,
} from "@/lib/api/types";
import type { TestSlug } from "@/lib/db/types";
import {
  clearPlayerSession,
  savePlayerSession,
  type PlayerSessionState,
} from "@/lib/sessions/player-session";

export type PlayerProgressView = {
  session: {
    id: string;
    code: string;
    title: string;
    status: string;
    endsAt: string | null;
  };
  exercises: Array<{
    sessionExerciseId: string;
    testSlug: string;
    name: string;
    completed: boolean;
    displayOrder: number;
  }>;
  completedCount: number;
  totalCount: number;
  nextExercise: string | null;
  allDone: boolean;
};

export function mapPlayerProgress(
  progress: PlayerSessionProgressResponse,
  sessionCode: string,
): PlayerProgressView {
  const exercises = [...progress.exercises].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const next = exercises.find((ex) => !ex.completed);
  return {
    session: {
      id: progress.session_id,
      code: sessionCode,
      title: progress.session_title,
      status: progress.session_status,
      endsAt: null,
    },
    exercises: exercises.map((ex) => ({
      sessionExerciseId: ex.session_exercise_id,
      testSlug: ex.slug,
      name: ex.name,
      completed: ex.completed,
      displayOrder: ex.display_order,
    })),
    completedCount: progress.completed_count,
    totalCount: exercises.length,
    nextExercise: next?.slug ?? null,
    allDone: progress.remaining_count === 0 || !next,
  };
}

export async function joinPlayerSessionV2(input: {
  sessionCode: string;
  personalCode: string;
}): Promise<PlayerSessionState> {
  const join = await sessionsService.playerJoin({
    session_code: input.sessionCode.trim().toUpperCase(),
    personal_code: input.personalCode.trim(),
  });

  const progress = await sessionsService.playerProgress();
  const view = mapPlayerProgress(progress, input.sessionCode.trim().toUpperCase());
  const state: PlayerSessionState = {
    code: view.session.code,
    sessionId: join.session_id,
    sessionPlayerId: join.session_player_id,
    displayName: view.session.title,
    exercises: view.exercises.map((ex) => ex.testSlug as TestSlug),
  };
  savePlayerSession(state);
  return state;
}

export async function fetchPlayerProgressV2(
  sessionCode: string,
): Promise<PlayerProgressView> {
  if (!tokenStore.getPlayerAccessToken()) {
    throw new Error("Session joueur expirée. Rejoins à nouveau avec ton code.");
  }
  try {
    const progress = await sessionsService.playerProgress();
    return mapPlayerProgress(progress, sessionCode.toUpperCase());
  } catch (err) {
    if (isApiError(err) && err.code === "authentication_error") {
      tokenStore.clearPlayerAccessToken();
      clearPlayerSession();
    }
    throw err;
  }
}

export async function startExerciseBySlugV2(
  sessionCode: string,
  testSlug: string,
): Promise<PlayerProgressView> {
  const progress = await fetchPlayerProgressV2(sessionCode);
  const exercise = progress.exercises.find((ex) => ex.testSlug === testSlug);
  if (!exercise) {
    throw new Error("Exercice non assigné à cette session.");
  }
  if (exercise.completed) {
    return progress;
  }
  const updated = await sessionsService.startExercise(exercise.sessionExerciseId);
  return mapPlayerProgress(updated, sessionCode.toUpperCase());
}

export async function submitExerciseResultV2(input: {
  sessionCode: string;
  testSlug: string;
  score: number;
  accuracy: number;
  responseTimeMs: number;
  resultData?: Record<string, unknown>;
}): Promise<PlayerProgressView> {
  const progress = await fetchPlayerProgressV2(input.sessionCode);
  const exercise = progress.exercises.find((ex) => ex.testSlug === input.testSlug);
  if (!exercise) {
    throw new Error("Exercice non assigné à cette session.");
  }
  if (exercise.completed) {
    return progress;
  }

  // Ensure attempt exists server-side.
  try {
    await sessionsService.startExercise(exercise.sessionExerciseId);
  } catch {
    /* already started is fine */
  }

  const payload: CompleteExerciseRequest = {
    score: input.score,
    accuracy: input.accuracy,
    response_time_ms: Math.max(0, Math.round(input.responseTimeMs)),
    result_data: input.resultData ?? {},
  };
  const updated = await sessionsService.completeExercise(
    exercise.sessionExerciseId,
    payload,
  );
  return mapPlayerProgress(updated, input.sessionCode.toUpperCase());
}

export function playerApiErrorMessage(err: unknown, fallback: string): string {
  if (isApiError(err)) {
    const msg = err.message.toLowerCase();
    if (err.code === "authentication_error" || msg.includes("invalid credentials")) {
      return "Code incorrect ou session inaccessible. Vérifie auprès de ton entraîneur.";
    }
    if (msg.includes("not available") || msg.includes("in_progress")) {
      return "Cette session n'est pas ouverte. Demande à ton entraîneur de l'ouvrir.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Pas de connexion. Vérifie ton réseau puis réessaie.";
    }
    return err.message || fallback;
  }
  return fallback;
}
