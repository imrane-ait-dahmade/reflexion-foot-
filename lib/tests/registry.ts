import type { TestDefinition } from "./types";

export const TESTS: TestDefinition[] = [
  {
    slug: "visual-tracking",
    name: "Dynamic Number Tracking",
    description:
      "Track one target number while all 30 numbers move around the field.",
    href: "/tests/visual-tracking",
  },
  {
    slug: "visual-memory",
    name: "Visual Memory Test",
    description:
      "Memorize 5 highlighted positions on a 5 × 5 grid, then select them.",
    href: "/tests/visual-memory",
  },
  {
    slug: "reaction-time",
    name: "Reaction Time",
    description: "Tap the target as soon as it appears, 10 times.",
    href: "/tests/reaction-time",
  },
  {
    slug: "peripheral-vision",
    name: "Peripheral Vision",
    description:
      "Keep your eyes on the center and report on which side a target flashes.",
    href: "/tests/peripheral-vision",
  },
];
