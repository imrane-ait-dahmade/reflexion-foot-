import type { TestSlug } from "@/lib/db/types";
import { TESTS } from "@/lib/tests/registry";

const ALL_SLUGS = TESTS.map((test) => test.slug) as TestSlug[];

/** Fisher–Yates shuffle — returns a new array. */
export function shuffleSlugs(slugs: TestSlug[]): TestSlug[] {
  const pool = [...slugs];
  for (let i = 0; i < pool.length; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Picks `count` distinct test slugs at random (or all if count >= available). */
export function pickRandomExercises(count: number): TestSlug[] {
  return shuffleSlugs(ALL_SLUGS).slice(0, Math.min(count, ALL_SLUGS.length));
}

export function isTestSlug(value: string): value is TestSlug {
  return ALL_SLUGS.includes(value as TestSlug);
}
