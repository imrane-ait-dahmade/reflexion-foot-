import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AccessCodeRotateResponse,
  CreatePlayerNoteRequest,
  CreatePlayerRequest,
  ImportConfirmRequest,
  ImportConfirmResponse,
  ImportPreviewResponse,
  ListPlayersQuery,
  PlayerCreateResponse,
  PlayerListResponse,
  PlayerNoteResponse,
  PlayerResponse,
  PositionResponse,
  UpdatePlayerNoteRequest,
  UpdatePlayerRequest,
  UpdatePlayerStatusRequest,
} from "@/lib/api/types";

export const playersService = {
  listPositions(signal?: AbortSignal): Promise<PositionResponse[]> {
    return apiClient.get<PositionResponse[]>(endpoints.positions.list, {
      auth: "staff",
      signal,
    });
  },

  list(
    query: ListPlayersQuery = {},
    signal?: AbortSignal,
  ): Promise<PlayerListResponse> {
    return apiClient.get<PlayerListResponse>(endpoints.players.list, {
      auth: "staff",
      query,
      signal,
    });
  },

  create(
    payload: CreatePlayerRequest,
    signal?: AbortSignal,
  ): Promise<PlayerCreateResponse> {
    return apiClient.post<PlayerCreateResponse>(endpoints.players.create, payload, {
      auth: "staff",
      signal,
    });
  },

  get(playerId: string, signal?: AbortSignal): Promise<PlayerResponse> {
    return apiClient.get<PlayerResponse>(endpoints.players.byId(playerId), {
      auth: "staff",
      signal,
    });
  },

  update(
    playerId: string,
    payload: UpdatePlayerRequest,
    signal?: AbortSignal,
  ): Promise<PlayerResponse> {
    return apiClient.patch<PlayerResponse>(
      endpoints.players.byId(playerId),
      payload,
      { auth: "staff", signal },
    );
  },

  updateStatus(
    playerId: string,
    payload: UpdatePlayerStatusRequest,
    signal?: AbortSignal,
  ): Promise<PlayerResponse> {
    return apiClient.patch<PlayerResponse>(
      endpoints.players.status(playerId),
      payload,
      { auth: "staff", signal },
    );
  },

  rotateAccessCode(
    playerId: string,
    signal?: AbortSignal,
  ): Promise<AccessCodeRotateResponse> {
    return apiClient.post<AccessCodeRotateResponse>(
      endpoints.players.rotateAccessCode(playerId),
      undefined,
      { auth: "staff", signal },
    );
  },

  importPreview(file: File, signal?: AbortSignal): Promise<ImportPreviewResponse> {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.postForm<ImportPreviewResponse>(
      endpoints.players.importPreview,
      formData,
      { auth: "staff", signal },
    );
  },

  importConfirm(
    payload: ImportConfirmRequest,
    signal?: AbortSignal,
  ): Promise<ImportConfirmResponse> {
    return apiClient.post<ImportConfirmResponse>(
      endpoints.players.importConfirm,
      payload,
      { auth: "staff", signal },
    );
  },

  listNotes(playerId: string, signal?: AbortSignal): Promise<PlayerNoteResponse[]> {
    return apiClient.get<PlayerNoteResponse[]>(endpoints.players.notes(playerId), {
      auth: "staff",
      signal,
    });
  },

  createNote(
    playerId: string,
    payload: CreatePlayerNoteRequest,
    signal?: AbortSignal,
  ): Promise<PlayerNoteResponse> {
    return apiClient.post<PlayerNoteResponse>(
      endpoints.players.notes(playerId),
      payload,
      { auth: "staff", signal },
    );
  },

  updateNote(
    playerId: string,
    noteId: string,
    payload: UpdatePlayerNoteRequest,
    signal?: AbortSignal,
  ): Promise<PlayerNoteResponse> {
    return apiClient.patch<PlayerNoteResponse>(
      endpoints.players.note(playerId, noteId),
      payload,
      { auth: "staff", signal },
    );
  },

  deleteNote(
    playerId: string,
    noteId: string,
    signal?: AbortSignal,
  ): Promise<null> {
    return apiClient.delete<null>(endpoints.players.note(playerId, noteId), {
      auth: "staff",
      signal,
    });
  },
};
