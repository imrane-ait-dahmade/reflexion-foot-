import { unitFloat } from "@/lib/tests/challenge-token";
import { DIGIT_LEVELS, digitLength } from "./config";

/** Digits for one attempt. A new seed draws a new sequence. The list stays on the server. */
export function digitSequence(seed: string, level: number, secret: string) {
  const length = digitLength(level);
  if (!length) throw new Error("Niveau inconnu.");
  const digits: number[] = [];
  for (let index = 0; index < length; index += 1) {
    const unit = unitFloat(secret, `${seed}:digit-memory:${level}:${index}`);
    digits.push(Math.floor(unit * 10));
  }
  return digits;
}

export function sequencesDifferAcrossLevels(seed: string, secret: string) {
  const seen = new Set<string>();
  for (let level = 1; level <= DIGIT_LEVELS.length; level += 1) {
    seen.add(digitSequence(seed, level, secret).join(""));
  }
  return seen.size === DIGIT_LEVELS.length;
}

/** A digit counts only when it matches the expected value at the same position. */
export function gradeDigitSequence(expected: number[], answer: number[]) {
  let positional = 0;
  for (let index = 0; index < expected.length; index += 1) {
    if (answer[index] === expected[index]) positional += 1;
  }
  const exact =
    answer.length === expected.length && positional === expected.length;
  return {
    exact,
    positional,
    positionErrors: expected.length - positional,
  };
}
