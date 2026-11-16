/**
 * Shared API types aligned with FastAPI Pydantic schemas.
 * OpenAPI was not reachable at generation time — types mirror backend
 * `application/schemas.py` modules. Prefer regenerating from `/openapi.json`
 * when the backend is running (see docs/FRONTEND_API_INTEGRATION.md).
 */

export type SessionStatus = "draft" | "in_progress" | "completed" | "cancelled";
export type SessionPlayerStatus =
  | "joined"
  | "in_progress"
  | "completed"
  | "withdrawn";
export type AttemptStatus = "in_progress" | "completed" | "abandoned";
export type Gender = "male" | "female" | "other" | "unspecified";
export type PreferredFoot = "left" | "right" | "both";
export type TeamRole =
  | "head_coach"
  | "assistant_coach"
  | "analyst"
  | "physiotherapist"
  | "staff"
  | "other";

/* ——— Auth / users ——— */

export type LoginRequest = {
  email: string;
  password: string;
};

export type RefreshRequest = {
  refresh_token: string;
};

export type LogoutRequest = {
  refresh_token: string;
  all_sessions?: boolean;
};

export type ChangePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type UserResponse = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  created_at: string;
  updated_at: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserResponse;
};

export type CreateStaffUserRequest = {
  full_name: string;
  email: string;
  password: string;
  roles: string[];
  is_active?: boolean;
};

export type UpdateStaffUserRequest = {
  full_name?: string | null;
  password?: string | null;
  roles?: string[] | null;
  is_active?: boolean | null;
};

export type UpdateUserStatusRequest = { is_active: boolean };
export type UpdateUserRolesRequest = { roles: string[] };

/* ——— Players ——— */

export type PositionResponse = {
  id: string;
  code: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

export type PlayerNoteResponse = {
  id: string;
  player_id: string;
  author_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type PlayerResponse = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  gender: Gender | null;
  email: string | null;
  phone: string | null;
  primary_position_id: string;
  primary_position?: PositionResponse | null;
  secondary_position_ids: string[];
  secondary_positions?: PositionResponse[];
  preferred_foot: PreferredFoot | null;
  height_cm: number | null;
  weight_kg: string | number | null;
  jersey_number: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type PlayerCreateResponse = PlayerResponse & { access_code: string };

export type AccessCodeRotateResponse = {
  player_id: string;
  access_code: string;
};

export type PlayerListResponse = {
  items: PlayerResponse[];
  total: number;
  page: number;
  page_size: number;
};

export type CreatePlayerRequest = {
  first_name: string;
  last_name: string;
  primary_position_id: string;
  secondary_position_ids?: string[];
  team_id?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  gender?: Gender | null;
  email?: string | null;
  phone?: string | null;
  preferred_foot?: PreferredFoot | null;
  height_cm?: number | null;
  weight_kg?: string | number | null;
  jersey_number?: number | null;
};

export type UpdatePlayerRequest = Partial<CreatePlayerRequest> & {
  clear_date_of_birth?: boolean;
  clear_nationality?: boolean;
  clear_gender?: boolean;
  clear_email?: boolean;
  clear_phone?: boolean;
  clear_preferred_foot?: boolean;
  clear_height_cm?: boolean;
  clear_weight_kg?: boolean;
  clear_jersey_number?: boolean;
};

export type UpdatePlayerStatusRequest = { is_active: boolean };
export type CreatePlayerNoteRequest = { content: string };
export type UpdatePlayerNoteRequest = { content: string };

export type ImportPreviewRow = {
  row_number: number;
  first_name: string;
  last_name: string;
  primary_position_code: string;
  secondary_position_codes?: string[];
  date_of_birth?: string | null;
  nationality?: string | null;
  gender?: Gender | null;
  email?: string | null;
  phone?: string | null;
  preferred_foot?: PreferredFoot | null;
  height_cm?: number | null;
  weight_kg?: string | number | null;
  jersey_number?: number | null;
};

export type ImportReject = { row_number: number; reason: string };
export type ImportDuplicate = {
  row_number: number;
  existing_player_id?: string | null;
  reason: string;
};

export type ImportPreviewResponse = {
  valid_rows: ImportPreviewRow[];
  rejects: ImportReject[];
  duplicates: ImportDuplicate[];
  total_rows: number;
  valid_count: number;
  reject_count: number;
  duplicate_count: number;
};

export type ImportConfirmRequest = {
  rows: ImportPreviewRow[];
  team_id?: string | null;
};

export type ImportConfirmResponse = {
  created_count: number;
  created_players: PlayerCreateResponse[];
  rejects: ImportReject[];
  duplicates: ImportDuplicate[];
};

export type ListPlayersQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  primary_position_id?: string;
  is_active?: boolean;
};

/* ——— Teams ——— */

export type TeamResponse = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TeamListResponse = {
  items: TeamResponse[];
  total: number;
  page: number;
  page_size: number;
};

export type CreateTeamRequest = {
  name: string;
  description?: string | null;
};

export type UpdateTeamRequest = {
  name?: string | null;
  description?: string | null;
  clear_description?: boolean;
};

export type UpdateTeamStatusRequest = { is_active: boolean };

export type TeamStaffResponse = {
  id: string;
  team_id: string;
  user_id: string;
  user_full_name?: string | null;
  user_email?: string | null;
  team_role: TeamRole;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignTeamStaffRequest = {
  user_id: string;
  team_role?: TeamRole;
};

export type TeamPlayerMembershipResponse = {
  id: string;
  team_id: string;
  player_id: string;
  player_first_name?: string | null;
  player_last_name?: string | null;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignTeamPlayerRequest = { player_id: string };

export type ListTeamsQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
};

/* ——— Sessions / cognitive tests ——— */

export type CognitiveTestResponse = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  is_active: boolean;
};

export type SessionExerciseResponse = {
  id: string;
  cognitive_test_id: string;
  display_order: number;
  cognitive_test?: CognitiveTestResponse | null;
};

export type SessionParticipantProgress = {
  completed_exercises: number;
  total_exercises: number;
  current_display_order: number | null;
};

export type SessionParticipantResponse = {
  id: string;
  player_id: string;
  first_name?: string | null;
  last_name?: string | null;
  status: SessionPlayerStatus;
  joined_at: string;
  progress?: SessionParticipantProgress | null;
};

export type SessionResponse = {
  id: string;
  title: string;
  session_code: string | null;
  status: SessionStatus;
  team_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  players: SessionParticipantResponse[];
  exercises: SessionExerciseResponse[];
};

export type SessionListResponse = {
  items: SessionResponse[];
  total: number;
  page: number;
  page_size: number;
};

export type CreateSessionRequest = {
  player_ids: string[];
  exercise_ids: string[];
  team_id?: string | null;
};

export type AddSessionPlayersRequest = { player_ids: string[] };
export type ReplaceSessionExercisesRequest = { exercise_ids: string[] };

export type ListSessionsQuery = {
  page?: number;
  page_size?: number;
  search?: string;
  status?: SessionStatus;
};

export type SessionDashboardExercise = {
  session_exercise_id: string;
  cognitive_test_id: string;
  display_order: number;
  slug: string;
  name: string;
};

export type SessionDashboardPlayer = {
  session_player_id: string;
  player_id: string;
  display_name: string;
  status: SessionPlayerStatus;
  completed_tests: number;
  total_tests: number;
  average_score: number | null;
  joined_at: string;
};

export type SessionDashboardResult = {
  id: string;
  attempt_id: string;
  session_player_id: string;
  session_exercise_id: string;
  test_slug: string;
  score: number;
  accuracy: number | string;
  response_time_ms: number;
  result_data: Record<string, unknown>;
  completed_at: string | null;
};

export type SessionDashboardResponse = {
  session: SessionResponse;
  exercises: SessionDashboardExercise[];
  players: SessionDashboardPlayer[];
  results: SessionDashboardResult[];
};

export type PlayerJoinRequest = {
  personal_code: string;
  session_code: string;
};

export type PlayerJoinResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  session_id: string;
  player_id: string;
  session_player_id: string;
  session_title: string;
};

export type PlayerExerciseProgressItem = {
  session_exercise_id: string;
  cognitive_test_id: string;
  display_order: number;
  slug: string;
  name: string;
  attempt_status: AttemptStatus | null;
  completed: boolean;
};

export type PlayerSessionProgressResponse = {
  session_id: string;
  session_title: string;
  session_status: SessionStatus;
  participation_status: SessionPlayerStatus;
  current_display_order: number | null;
  exercises: PlayerExerciseProgressItem[];
  completed_count: number;
  remaining_count: number;
};

export type CompleteExerciseRequest = {
  score: number;
  accuracy: number | string;
  response_time_ms: number;
  result_data?: Record<string, unknown>;
};
