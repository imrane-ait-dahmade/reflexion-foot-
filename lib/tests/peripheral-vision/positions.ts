import { randomInt } from "../random";
import { PERIPHERAL_VISION_CONFIG } from "./config";
import type { PeripheralPosition } from "./types";

/** All positions are near the edges, far from the central fixation point. */
export const PERIPHERAL_POSITIONS: readonly PeripheralPosition[] = [
  { id: "left", side: "left", xPercent: 8, yPercent: 50 },
  { id: "right", side: "right", xPercent: 92, yPercent: 50 },
  { id: "upper-left", side: "left", xPercent: 12, yPercent: 14 },
  { id: "upper-right", side: "right", xPercent: 88, yPercent: 14 },
  { id: "lower-left", side: "left", xPercent: 12, yPercent: 86 },
  { id: "lower-right", side: "right", xPercent: 88, yPercent: 86 },
];

export function randomPeripheralPosition() {
  return PERIPHERAL_POSITIONS[randomInt(0, PERIPHERAL_POSITIONS.length - 1)];
}

export function randomTrialInterval() {
  return randomInt(
    PERIPHERAL_VISION_CONFIG.minIntervalMs,
    PERIPHERAL_VISION_CONFIG.maxIntervalMs,
  );
}
