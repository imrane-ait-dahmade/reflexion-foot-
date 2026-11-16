import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { tokenStore } from "@/lib/api/token-store";
import type {
  AddSessionPlayersRequest,
  CompleteExerciseRequest,
  CreateSessionRequest,
  ListSessionsQuery,
  PlayerJoinRequest,
  PlayerJoinResponse,
  PlayerSessionProgressResponse,
  ReplaceSessionExercisesRequest,
  SessionListResponse,
  SessionResponse,
} from "@/lib/api/types";

/** Staff training sessions + player join/progress (FastAPI). */
export const sessionsService = {
  list(
    query: ListSessionsQuery = {},
    signal?: AbortSignal,
  ): Promise<SessionListResponse> {
    return apiClient.get<SessionListResponse>(endpoints.sessions.list, {
      auth: "staff",
      query,
      signal,
    });
  },

  create(
    payload: CreateSessionRequest,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>(endpoints.sessions.create, payload, {
      auth: "staff",
      signal,
    });
  },

  get(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
    return apiClient.get<SessionResponse>(endpoints.sessions.byId(sessionId), {
      auth: "staff",
      signal,
    });
  },

  addPlayers(
    sessionId: string,
    payload: AddSessionPlayersRequest,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>(
      endpoints.sessions.players(sessionId),
      payload,
      { auth: "staff", signal },
    );
  },

  removePlayer(
    sessionId: string,
    playerId: string,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return apiClient.delete<SessionResponse>(
      endpoints.sessions.player(sessionId, playerId),
      { auth: "staff", signal },
    );
  },

  replaceExercises(
    sessionId: string,
    payload: ReplaceSessionExercisesRequest,
    signal?: AbortSignal,
  ): Promise<SessionResponse> {
    return apiClient.put<SessionResponse>(
      endpoints.sessions.exercises(sessionId),
      payload,
      { auth: "staff", signal },
    );
  },

  start(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>(endpoints.sessions.start(sessionId), undefined, {
      auth: "staff",
      signal,
    });
  },

  complete(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>(
      endpoints.sessions.complete(sessionId),
      undefined,
      { auth: "staff", signal },
    );
  },

  cancel(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>(
      endpoints.sessions.cancel(sessionId),
      undefined,
      { auth: "staff", signal },
    );
  },

  rotateCode(sessionId: string, signal?: AbortSignal): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>(
      endpoints.sessions.rotateCode(sessionId),
      undefined,
      { auth: "staff", signal },
    );
  },

  /* ——— Player-facing session API ——— */

  async playerJoin(
    payload: PlayerJoinRequest,
    signal?: AbortSignal,
  ): Promise<PlayerJoinResponse> {
    const result = await apiClient.post<PlayerJoinResponse>(
      endpoints.playerSession.join,
      payload,
      { auth: "none", signal },
    );
    tokenStore.setPlayerAccessToken(result.access_token);
    return result;
  },

  playerProgress(signal?: AbortSignal): Promise<PlayerSessionProgressResponse> {
    return apiClient.get<PlayerSessionProgressResponse>(
      endpoints.playerSession.progress,
      { auth: "player", signal },
    );
  },

  startExercise(
    sessionExerciseId: string,
    signal?: AbortSignal,
  ): Promise<PlayerSessionProgressResponse> {
    return apiClient.post<PlayerSessionProgressResponse>(
      endpoints.playerSession.startExercise(sessionExerciseId),
      undefined,
      { auth: "player", signal },
    );
  },

  completeExercise(
    sessionExerciseId: string,
    payload: CompleteExerciseRequest,
    signal?: AbortSignal,
  ): Promise<PlayerSessionProgressResponse> {
    return apiClient.post<PlayerSessionProgressResponse>(
      endpoints.playerSession.completeExercise(sessionExerciseId),
      payload,
      { auth: "player", signal },
    );
  },
};
