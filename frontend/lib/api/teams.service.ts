import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AssignTeamPlayerRequest,
  AssignTeamStaffRequest,
  CreateTeamRequest,
  ListTeamsQuery,
  TeamListResponse,
  TeamPlayerMembershipResponse,
  TeamResponse,
  TeamStaffResponse,
  UpdateTeamRequest,
  UpdateTeamStatusRequest,
} from "@/lib/api/types";

/** Teams management (available on FastAPI; included for completeness). */
export const teamsService = {
  list(
    query: ListTeamsQuery = {},
    signal?: AbortSignal,
  ): Promise<TeamListResponse> {
    return apiClient.get<TeamListResponse>(endpoints.teams.list, {
      auth: "staff",
      query,
      signal,
    });
  },

  create(payload: CreateTeamRequest, signal?: AbortSignal): Promise<TeamResponse> {
    return apiClient.post<TeamResponse>(endpoints.teams.create, payload, {
      auth: "staff",
      signal,
    });
  },

  get(teamId: string, signal?: AbortSignal): Promise<TeamResponse> {
    return apiClient.get<TeamResponse>(endpoints.teams.byId(teamId), {
      auth: "staff",
      signal,
    });
  },

  update(
    teamId: string,
    payload: UpdateTeamRequest,
    signal?: AbortSignal,
  ): Promise<TeamResponse> {
    return apiClient.patch<TeamResponse>(endpoints.teams.byId(teamId), payload, {
      auth: "staff",
      signal,
    });
  },

  updateStatus(
    teamId: string,
    payload: UpdateTeamStatusRequest,
    signal?: AbortSignal,
  ): Promise<TeamResponse> {
    return apiClient.patch<TeamResponse>(endpoints.teams.status(teamId), payload, {
      auth: "staff",
      signal,
    });
  },

  listStaff(teamId: string, signal?: AbortSignal): Promise<TeamStaffResponse[]> {
    return apiClient.get<TeamStaffResponse[]>(endpoints.teams.staff(teamId), {
      auth: "staff",
      signal,
    });
  },

  assignStaff(
    teamId: string,
    payload: AssignTeamStaffRequest,
    signal?: AbortSignal,
  ): Promise<TeamStaffResponse> {
    return apiClient.post<TeamStaffResponse>(endpoints.teams.staff(teamId), payload, {
      auth: "staff",
      signal,
    });
  },

  removeStaff(
    teamId: string,
    userId: string,
    signal?: AbortSignal,
  ): Promise<null> {
    return apiClient.delete<null>(endpoints.teams.staffMember(teamId, userId), {
      auth: "staff",
      signal,
    });
  },

  listPlayers(
    teamId: string,
    signal?: AbortSignal,
  ): Promise<TeamPlayerMembershipResponse[]> {
    return apiClient.get<TeamPlayerMembershipResponse[]>(
      endpoints.teams.players(teamId),
      { auth: "staff", signal },
    );
  },

  assignPlayer(
    teamId: string,
    payload: AssignTeamPlayerRequest,
    signal?: AbortSignal,
  ): Promise<TeamPlayerMembershipResponse> {
    return apiClient.post<TeamPlayerMembershipResponse>(
      endpoints.teams.players(teamId),
      payload,
      { auth: "staff", signal },
    );
  },

  removePlayer(
    teamId: string,
    playerId: string,
    signal?: AbortSignal,
  ): Promise<null> {
    return apiClient.delete<null>(endpoints.teams.player(teamId, playerId), {
      auth: "staff",
      signal,
    });
  },
};
