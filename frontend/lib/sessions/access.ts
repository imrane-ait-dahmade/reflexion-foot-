import { SESSION_SUBMIT_GRACE_MS } from "./config";

type SessionStatus = "draft" | "active" | "closed";

export type SessionAccess = {
  status: SessionStatus;
  endsAt: Date | null;
  updatedAt?: Date | null;
  archivedAt?: Date | null;
};

/** A player can join only while the session is active and not past its end. */
export function isJoinable(session: SessionAccess, now = Date.now()) {
  if (session.archivedAt) return false;
  return (
    session.status === "active" &&
    (!session.endsAt || session.endsAt.getTime() > now)
  );
}

/**
 * A finished attempt can still be saved during the grace window after the
 * session ends or the coach closes it. Draft sessions never accept results.
 */
export function canAcceptResult(session: SessionAccess, now = Date.now()) {
  if (session.archivedAt) return false;
  if (session.status === "active") {
    if (!session.endsAt) return true;
    return session.endsAt.getTime() + SESSION_SUBMIT_GRACE_MS > now;
  }
  if (session.status === "closed") {
    const closedAt = session.updatedAt?.getTime() ?? session.endsAt?.getTime();
    if (!closedAt) return true;
    return closedAt + SESSION_SUBMIT_GRACE_MS > now;
  }
  return false;
}
