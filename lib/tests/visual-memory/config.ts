export const VISUAL_MEMORY_CONFIG = {
  gridColumns: 5,
  gridRows: 5,
  targetsPerRound: 5,
  memorizeMs: 1500,
  durationMs: 30_000,
} as const;

export const VISUAL_MEMORY_CELL_COUNT =
  VISUAL_MEMORY_CONFIG.gridColumns * VISUAL_MEMORY_CONFIG.gridRows;

export const VISUAL_MEMORY_SCORING = {
  maxScore: 100,
  /** Correct cells needed to get all the "progress" points. */
  correctCellsGoal: 50,
  progressWeight: 50,
  accuracyWeight: 30,
  speedWeight: 20,
  /** Average round response at or below this gets all the speed points. */
  fastResponseMs: 1000,
  /** Average round response at or above this gets no speed points. */
  slowResponseMs: 4000,
} as const;

export const TIMER_TICK_MS = 100;
