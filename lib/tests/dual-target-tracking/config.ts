export const DUAL_LEVELS = [
  { objects: 6, durationMs: 5000, speed: 0.12 },
  { objects: 8, durationMs: 7000, speed: 0.15 },
  { objects: 10, durationMs: 8000, speed: 0.18 },
  { objects: 12, durationMs: 10000, speed: 0.2 },
  { objects: 14, durationMs: 12000, speed: 0.22 },
] as const;

export const DUAL_HIGHLIGHT_MS = 2000;
export const ORB_RADIUS = 0.045;

export function dualLevel(level: number) {
  return DUAL_LEVELS[level - 1] ?? null;
}
