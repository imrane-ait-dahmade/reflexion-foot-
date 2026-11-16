import { apiClient } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { tokenStore } from "@/lib/api/token-store";
import type {
  ChangePasswordRequest,
  CreateStaffUserRequest,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  TokenResponse,
  UpdateStaffUserRequest,
  UpdateUserRolesRequest,
  UpdateUserStatusRequest,
  UserResponse,
} from "@/lib/api/types";

/**
 * Staff auth against FastAPI JWT endpoints.
 * Does not replace Better Auth V1 — call explicitly when integrating V2.
 */
export const authService = {
  async login(payload: LoginRequest, signal?: AbortSignal): Promise<TokenResponse> {
    const tokens = await apiClient.post<TokenResponse>(endpoints.auth.login, payload, {
      auth: "none",
      signal,
    });
    tokenStore.setStaffTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  async refresh(
    payload?: RefreshRequest,
    signal?: AbortSignal,
  ): Promise<TokenResponse> {
    const body: RefreshRequest = payload ?? {
      refresh_token: tokenStore.getStaffRefreshToken() ?? "",
    };
    const tokens = await apiClient.post<TokenResponse>(endpoints.auth.refresh, body, {
      auth: "none",
      signal,
      skipRefreshRetry: true,
    });
    tokenStore.setStaffTokens(tokens.access_token, tokens.refresh_token);
    return tokens;
  },

  async logout(
    options: { allSessions?: boolean; signal?: AbortSignal } = {},
  ): Promise<void> {
    const refresh = tokenStore.getStaffRefreshToken();
    if (refresh && tokenStore.getStaffAccessToken()) {
      const body: LogoutRequest = {
        refresh_token: refresh,
        all_sessions: options.allSessions ?? false,
      };
      try {
        await apiClient.post<null>(endpoints.auth.logout, body, {
          auth: "staff",
          signal: options.signal,
          skipRefreshRetry: true,
        });
      } catch {
        /* still clear local tokens */
      }
    }
    tokenStore.clearStaffTokens();
  },

  me(signal?: AbortSignal): Promise<UserResponse> {
    return apiClient.get<UserResponse>(endpoints.auth.me, {
      auth: "staff",
      signal,
    });
  },

  changePassword(
    payload: ChangePasswordRequest,
    signal?: AbortSignal,
  ): Promise<null> {
    return apiClient.post<null>(endpoints.auth.changePassword, payload, {
      auth: "staff",
      signal,
    });
  },

  listUsers(signal?: AbortSignal): Promise<UserResponse[]> {
    return apiClient.get<UserResponse[]>(endpoints.users.list, {
      auth: "staff",
      signal,
    });
  },

  createUser(
    payload: CreateStaffUserRequest,
    signal?: AbortSignal,
  ): Promise<UserResponse> {
    return apiClient.post<UserResponse>(endpoints.users.create, payload, {
      auth: "staff",
      signal,
    });
  },

  getUser(userId: string, signal?: AbortSignal): Promise<UserResponse> {
    return apiClient.get<UserResponse>(endpoints.users.byId(userId), {
      auth: "staff",
      signal,
    });
  },

  updateUser(
    userId: string,
    payload: UpdateStaffUserRequest,
    signal?: AbortSignal,
  ): Promise<UserResponse> {
    return apiClient.patch<UserResponse>(endpoints.users.byId(userId), payload, {
      auth: "staff",
      signal,
    });
  },

  updateUserStatus(
    userId: string,
    payload: UpdateUserStatusRequest,
    signal?: AbortSignal,
  ): Promise<UserResponse> {
    return apiClient.patch<UserResponse>(endpoints.users.status(userId), payload, {
      auth: "staff",
      signal,
    });
  },

  updateUserRoles(
    userId: string,
    payload: UpdateUserRolesRequest,
    signal?: AbortSignal,
  ): Promise<UserResponse> {
    return apiClient.put<UserResponse>(endpoints.users.roles(userId), payload, {
      auth: "staff",
      signal,
    });
  },
};
