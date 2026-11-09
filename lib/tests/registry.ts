import type { TestDefinition } from "./types";

export const TESTS: TestDefinition[] = [
  {
    slug: "visual-tracking",
    name: "Suivi de numéros",
    description:
      "Suis le numéro cible pendant que 30 chiffres bougent sur le terrain.",
    href: "/join",
  },
  {
    slug: "visual-memory",
    name: "Mémoire visuelle",
    description:
      "Mémorise 5 cases allumées sur une grille 5 × 5, puis retrouve-les.",
    href: "/join",
  },
  {
    slug: "reaction-time",
    name: "Temps de réaction",
    description: "Touche la cible dès qu'elle apparaît, 10 fois.",
    href: "/join",
  },
  {
    slug: "peripheral-vision",
    name: "Vision périphérique",
    description:
      "Garde les yeux au centre et indique de quel côté la cible flash.",
    href: "/join",
  },
  {
    slug: "football-visual-scanning",
    name: "Lecture du jeu",
    description:
      "Sur des actions réelles, repère le joueur proche du ballon, le défenseur et le joueur libre.",
    href: "/join",
  },
  {
    slug: "sequential-visual-search",
    name: "Recherche Visuelle Séquentielle",
    description: "Retrouvez les nombres dans l'ordre, de 1 à 50.",
    href: "/join",
  },
  {
    slug: "digit-memory",
    name: "Mémoire numérique séquentielle",
    description: "Mémorise une suite de chiffres, puis réécris-la dans l'ordre.",
    href: "/join",
  },
  {
    slug: "dual-target-tracking",
    name: "Suivi de deux cibles mobiles",
    description: "Retiens deux cibles, suis-les parmi les autres, puis désigne-les.",
    href: "/join",
  },
];
