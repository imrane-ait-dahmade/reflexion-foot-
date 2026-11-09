export const DIGIT_LEVELS = [3, 4, 5, 6, 7, 8, 9, 10] as const;
export const DIGIT_VISIBLE_MS = 800;
export const DIGIT_GAP_MS = 300;

export function digitLength(level: number) {
  return DIGIT_LEVELS[level - 1] ?? null;
}
