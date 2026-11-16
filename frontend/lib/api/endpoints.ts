/**
 * FastAPI route paths under `/api/v1`.
 * Source: backend `app/api/v1/router.py` and module presentation routers.
 * Do not invent paths — add only what exists in FastAPI.
 */

export const endpoints = {
  health: "/health",
  root: "/",

  auth: {
    login: "/api/v1/auth/login",
    refresh: "/api/v1/auth/refresh",
    logout: "/api/v1/auth/logout",
    me: "/api/v1/auth/me",
    changePassword: "/api/v1/auth/change-password",
  },

  users: {
    list: "/api/v1/users",
    create: "/api/v1/users",
    byId: (userId: string) => `/api/v1/users/${userId}`,
    status: (userId: string) => `/api/v1/users/${userId}/status`,
    roles: (userId: string) => `/api/v1/users/${userId}/roles`,
  },

  positions: {
    list: "/api/v1/positions",
  },

  players: {
    list: "/api/v1/players",
    create: "/api/v1/players",
    importPreview: "/api/v1/players/import/preview",
    importConfirm: "/api/v1/players/import/confirm",
    byId: (playerId: string) => `/api/v1/players/${playerId}`,
    status: (playerId: string) => `/api/v1/players/${playerId}/status`,
    rotateAccessCode: (playerId: string) =>
      `/api/v1/players/${playerId}/access-code/rotate`,
    notes: (playerId: string) => `/api/v1/players/${playerId}/notes`,
    note: (playerId: string, noteId: string) =>
      `/api/v1/players/${playerId}/notes/${noteId}`,
  },

  teams: {
    list: "/api/v1/teams",
    create: "/api/v1/teams",
    byId: (teamId: string) => `/api/v1/teams/${teamId}`,
    status: (teamId: string) => `/api/v1/teams/${teamId}/status`,
    staff: (teamId: string) => `/api/v1/teams/${teamId}/staff`,
    staffMember: (teamId: string, userId: string) =>
      `/api/v1/teams/${teamId}/staff/${userId}`,
    players: (teamId: string) => `/api/v1/teams/${teamId}/players`,
    player: (teamId: string, playerId: string) =>
      `/api/v1/teams/${teamId}/players/${playerId}`,
  },

  cognitiveTests: {
    list: "/api/v1/cognitive-tests",
  },

  sessions: {
    list: "/api/v1/sessions",
    create: "/api/v1/sessions",
    byId: (sessionId: string) => `/api/v1/sessions/${sessionId}`,
    byCode: (code: string) => `/api/v1/sessions/code/${encodeURIComponent(code)}`,
    dashboardByCode: (code: string) =>
      `/api/v1/sessions/code/${encodeURIComponent(code)}/dashboard`,
    dashboard: (sessionId: string) =>
      `/api/v1/sessions/${sessionId}/dashboard`,
    players: (sessionId: string) => `/api/v1/sessions/${sessionId}/players`,
    player: (sessionId: string, playerId: string) =>
      `/api/v1/sessions/${sessionId}/players/${playerId}`,
    exercises: (sessionId: string) => `/api/v1/sessions/${sessionId}/exercises`,
    start: (sessionId: string) => `/api/v1/sessions/${sessionId}/start`,
    complete: (sessionId: string) => `/api/v1/sessions/${sessionId}/complete`,
    cancel: (sessionId: string) => `/api/v1/sessions/${sessionId}/cancel`,
    rotateCode: (sessionId: string) =>
      `/api/v1/sessions/${sessionId}/code/rotate`,
  },

  playerSession: {
    join: "/api/v1/player/session/join",
    progress: "/api/v1/player/session",
    startExercise: (sessionExerciseId: string) =>
      `/api/v1/player/session/exercises/${sessionExerciseId}/start`,
    completeExercise: (sessionExerciseId: string) =>
      `/api/v1/player/session/exercises/${sessionExerciseId}/complete`,
  },

  /** Server-validated challenge engines (FastAPI V2). */
  playerExercises: {
    digitMemory: "/api/v1/player/exercises/digit-memory",
    dualTargetTracking: "/api/v1/player/exercises/dual-target-tracking",
    observationComplete: (slug: string) =>
      `/api/v1/player/exercises/${slug}/complete`,
  },

  aiReports: {
    create: "/api/v1/ai/reports",
    byId: (reportId: string) => `/api/v1/ai/reports/${reportId}`,
    bySession: (trainingSessionId: string) =>
      `/api/v1/ai/reports/sessions/${trainingSessionId}`,
  },
} as const;
