import type { SessionResponse, SessionStatus } from "@/lib/api/types";

/** V2 statuses that mean the join code is live. */
export function isSessionJoinable(status: SessionStatus | string): boolean {
  return status === "in_progress";
}

/** V2 statuses shown under “Actives” (draft + open). */
export function isSessionOpenTab(status: SessionStatus | string): boolean {
  return status === "draft" || status === "in_progress";
}

/** V2 statuses shown under “Terminées”. */
export function isSessionClosedTab(status: SessionStatus | string): boolean {
  return status === "completed" || status === "cancelled";
}

export function canCancelSession(status: SessionStatus | string): boolean {
  return status === "draft" || status === "in_progress";
}

export function mapSessionToListItem(session: SessionResponse) {
  return {
    id: session.id,
    code: session.session_code ?? "—",
    title: session.title,
    status: session.status,
    createdAt: session.created_at,
    endsAt: null as string | null,
    exerciseCount: session.exercises?.length ?? 0,
    playerCount: session.players?.length ?? 0,
    completedPlayers:
      session.players?.filter((p) => p.status === "completed").length ?? 0,
  };
}

export type SessionListItem = ReturnType<typeof mapSessionToListItem>;
