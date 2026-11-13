export const PERIPHERAL_VISION_CONFIG = {
  durationMs: 30_000,
  minIntervalMs: 800,
  maxIntervalMs: 1800,
  /** The answer must be given while the target is visible. */
  stimulusVisibleMs: 500,
} as const;

export const PERIPHERAL_VISION_SCORING = {
  maxScore: 100,
  accuracyWeight: 60,
  speedWeight: 40,
  /** Average reaction at or below this gets all the speed points. */
  fastReactionMs: 250,
  /** Average reaction at or above this gets no speed points. */
  slowReactionMs: PERIPHERAL_VISION_CONFIG.stimulusVisibleMs,
} as const;

export const TIMER_TICK_MS = 100;
