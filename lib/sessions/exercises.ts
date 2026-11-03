import type { TestSlug } from "@/lib/db/types";
import { TESTS } from "@/lib/tests/registry";

const ALL_SLUGS = TESTS.map((test) => test.slug) as TestSlug[];

/** Picks `count` distinct test slugs at random (or all if count >= available). */
export function pickRandomExercises(count: number): TestSlug[] {
  const pool = [...ALL_SLUGS];
  for (let i = 0; i < pool.length; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function isTestSlug(value: string): value is TestSlug {
  return ALL_SLUGS.includes(value as TestSlug);
}
