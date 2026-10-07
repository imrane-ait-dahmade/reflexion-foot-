import { randomInt } from "../random";
import { REACTION_TIME_CONFIG } from "./config";

export function randomStimulusDelay() {
  return randomInt(
    REACTION_TIME_CONFIG.minDelayMs,
    REACTION_TIME_CONFIG.maxDelayMs,
  );
}
