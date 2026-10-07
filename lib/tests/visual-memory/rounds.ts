import { sampleUniqueInts } from "../random";
import { VISUAL_MEMORY_CELL_COUNT, VISUAL_MEMORY_CONFIG } from "./config";

/** Returns the indexes of the cells to memorize for a new round. */
export function createRoundTargets() {
  return sampleUniqueInts(
    VISUAL_MEMORY_CONFIG.targetsPerRound,
    0,
    VISUAL_MEMORY_CELL_COUNT - 1,
  );
}
