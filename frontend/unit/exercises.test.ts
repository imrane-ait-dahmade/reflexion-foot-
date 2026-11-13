import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTestSlug, pickRandomExercises, shuffleSlugs } from "@/lib/sessions/exercises";
import { TESTS } from "@/lib/tests/registry";
import type { TestSlug } from "@/lib/db/types";

const EXPECTED: TestSlug[] = [
  "visual-tracking",
  "visual-memory",
  "reaction-time",
  "peripheral-vision",
  "football-visual-scanning",
  "sequential-visual-search",
  "digit-memory",
  "dual-target-tracking",
];

describe("exercise catalogue", () => {
  it("exposes the eight exercises and keeps free play closed", () => {
    expect(TESTS.map((test) => test.slug)).toEqual(EXPECTED);
    expect(TESTS.every((test) => test.href === "/join")).toBe(true);
  });

  it("accepts only known slugs, including lecture du jeu", () => {
    for (const slug of EXPECTED) expect(isTestSlug(slug)).toBe(true);
    expect(isTestSlug("football-visual-scanning")).toBe(true);
    expect(isTestSlug("free-test")).toBe(false);
    expect(isTestSlug("")).toBe(false);
  });

  it("keeps the database enum aligned with the catalogue", () => {
    const schema = readFileSync("lib/db/schema.sql", "utf8");
    const migration = readFileSync(
      "lib/db/migrations/002_add_football_visual_scanning.sql",
      "utf8",
    );
    for (const slug of EXPECTED) {
      expect(schema).toContain(`'${slug}'`);
    }
    const sql = migration
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(sql).toContain(
      "ADD VALUE IF NOT EXISTS 'football-visual-scanning'",
    );
    const searchMigration = readFileSync(
      "lib/db/migrations/004_add_sequential_visual_search.sql",
      "utf8",
    );
    const searchSql = searchMigration
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(searchSql).toContain(
      "ADD VALUE IF NOT EXISTS 'sequential-visual-search'",
    );
    expect(searchSql.toLowerCase()).not.toMatch(/\bdrop\b|\bdelete\b|\btruncate\b/);
    const nextMigration = readFileSync(
      "lib/db/migrations/005_add_digit_memory_and_dual_target.sql",
      "utf8",
    );
    const nextSql = nextMigration
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(nextSql).toContain("ADD VALUE IF NOT EXISTS 'digit-memory'");
    expect(nextSql).toContain("ADD VALUE IF NOT EXISTS 'dual-target-tracking'");
    expect(nextSql.toLowerCase()).not.toMatch(/\bdrop\b|\bdelete\b|\btruncate\b/);
    expect(sql.toLowerCase()).not.toMatch(/\bdrop\b|\bdelete\b|\btruncate\b/);
  });
});

describe("assignment order", () => {
  it("shuffles without dropping, adding, or mutating the coach selection", () => {
    const selected: TestSlug[] = [
      "visual-tracking",
      "reaction-time",
      "football-visual-scanning",
    ];
    const original = [...selected];
    const shuffled = shuffleSlugs(selected);
    expect(shuffled).toHaveLength(selected.length);
    expect([...shuffled].sort()).toEqual([...selected].sort());
    expect(selected).toEqual(original);
  });

  it("never assigns more exercises than exist", () => {
    expect(pickRandomExercises(1)).toHaveLength(1);
    expect(pickRandomExercises(99)).toHaveLength(EXPECTED.length);
    expect(new Set(pickRandomExercises(99)).size).toBe(EXPECTED.length);
  });
});
