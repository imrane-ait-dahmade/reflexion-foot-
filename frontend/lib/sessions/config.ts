/** How long a session code stays joinable after creation. */
export const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Extra window after expiry/close during which a finished attempt can still
 * be submitted (player may finish a few seconds late or have a flaky network).
 */
export const SESSION_SUBMIT_GRACE_MS = 15 * 60 * 1000; // 15 minutes
