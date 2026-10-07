export const VISUAL_TRACKING_CONFIG = {
  itemCount: 30,
  minNumber: 10,
  maxNumber: 99,
  durationMs: 30_000,
  /** Diameter of a number bubble, in px. */
  itemSize: 44,
  /** Speeds are a fraction of the smallest area side per second. */
  minSpeed: 0.12,
  maxSpeed: 0.25,
  /** Caps a single animation step, e.g. after the tab was hidden. */
  maxFrameDeltaMs: 50,
  /** Attempts to find a non-overlapping spawn position per number. */
  spawnAttempts: 40,
} as const;

export const VISUAL_TRACKING_SCORING = {
  maxScore: 100,
  /** Targets found needed to get all the "targets" points. */
  targetGoal: 20,
  targetsWeight: 60,
  accuracyWeight: 20,
  speedWeight: 20,
  /** Average reaction at or below this gets all the speed points. */
  fastReactionMs: 500,
  /** Average reaction at or above this gets no speed points. */
  slowReactionMs: 3000,
} as const;

export const TIMER_TICK_MS = 100;
