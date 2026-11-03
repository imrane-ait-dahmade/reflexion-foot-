import type { TestDefinition } from "./types";

export const TESTS: TestDefinition[] = [
  {
    slug: "visual-tracking",
    name: "Suivi de numéros",
    description:
      "Suis le numéro cible pendant que 30 chiffres bougent sur le terrain.",
    href: "/tests/visual-tracking",
  },
  {
    slug: "visual-memory",
    name: "Mémoire visuelle",
    description:
      "Mémorise 5 cases allumées sur une grille 5 × 5, puis retrouve-les.",
    href: "/tests/visual-memory",
  },
  {
    slug: "reaction-time",
    name: "Temps de réaction",
    description: "Touche la cible dès qu'elle apparaît, 10 fois.",
    href: "/tests/reaction-time",
  },
  {
    slug: "peripheral-vision",
    name: "Vision périphérique",
    description:
      "Garde les yeux au centre et indique de quel côté la cible flash.",
    href: "/tests/peripheral-vision",
  },
];
