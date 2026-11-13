export const REACTION_TIME_CONFIG = {
  attempts: 10,
  minDelayMs: 1500,
  maxDelayMs: 4000,
  /** How long "Too early!" stays on screen before the attempt restarts. */
  tooEarlyMs: 1000,
} as const;

export const REACTION_TIME_SCORING = {
  maxScore: 100,
  /** Average reaction at or below this gets 100 (before penalties). */
  fastReactionMs: 150,
  /** Average reaction at or above this gets 0. */
  slowReactionMs: 650,
  falseStartPenalty: 5,
} as const;
