import { randomInt, sampleUniqueInts } from "../random";
import { VISUAL_TRACKING_CONFIG } from "./config";

export function createTrackingNumbers() {
  const { itemCount, minNumber, maxNumber } = VISUAL_TRACKING_CONFIG;
  const numbers = sampleUniqueInts(itemCount, minNumber, maxNumber);
  return { numbers, targetNumber: numbers[randomInt(0, numbers.length - 1)] };
}

/** Picks a new target among `numbers`, different from `current`. `rand` in [0, 1). */
export function pickNextTarget(numbers: number[], current: number, rand: number) {
  const candidates = numbers.filter((value) => value !== current);
  if (candidates.length === 0) return current;
  return candidates[Math.floor(rand * candidates.length)];
}
