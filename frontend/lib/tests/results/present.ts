import { formatMs, formatPercent, formatSeconds } from "@/lib/format";
import type { TestSlug } from "@/lib/db/types";
import { TESTS } from "@/lib/tests/registry";
import { DIGIT_LEVELS } from "@/lib/tests/digit-memory/config";
import { DUAL_LEVELS } from "@/lib/tests/dual-target-tracking/config";
import { SCANNING_SEQUENCES } from "@/lib/tests/football-visual-scanning/answers";

export const UNAVAILABLE = "Indisponible";

export const OVERALL_UNAVAILABLE =
  "Résumé global non disponible — les exercices utilisent des indicateurs différents.";

export type PresentedLine = {
  label: string;
  value: string;
};

export type PresentedResult = {
  slug: string;
  name: string;
  headline: string;
  primaryLabel: string;
  primaryValue: string;
  primaryUnit: string;
  lines: PresentedLine[];
  completionStatus: string;
  durationLabel: string;
  note: string;
};

export type PresentableResult = {
  testSlug: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  errors: number;
  averageReactionMs: number;
  bestReactionMs: number;
  durationMs: number;
  metrics: Record<string, unknown> | null;
  completedAt?: string;
};

const NOTES: Record<TestSlug, string> = {
  "visual-tracking":
    "La précision compte les clics justes parmi les clics faits. Elle ne dit pas quelle part de toutes les cibles a été trouvée.",
  "visual-memory":
    "La précision divise les cases justes par les cases justes plus les mauvaises sélections. Une case juste compte une seule fois. Les cases non choisies en fin de manche ne sont pas des erreurs.",
  "reaction-time":
    "La moyenne ne compte que les essais après l'apparition de la cible. Les faux départs en sont exclus. Aucune médiane n'est calculée.",
  "peripheral-vision":
    "La précision inclut les stimuli manqués et les mauvaises réponses. Elle ne retire pas les absences de réponse.",
  "football-visual-scanning":
    "Neuf situations. Une question sans réponse compte 12 secondes. Le temps le plus court n'est pas forcément une bonne réponse.",
  "sequential-visual-search":
    "Cinquante nombres à trouver dans l'ordre. La précision divise 50 par 50 plus les mauvaises sélections.",
  "digit-memory":
    "L'indicateur principal est la plus longue suite reproduite dans l'ordre. Ce n'est pas une note sur 100.",
  "dual-target-tracking":
    "Deux cibles sont désignées à chaque niveau. Le résultat compte chaque cible à retrouver, par exemple 9/10.",
};

export function sessionOverview(
  players: number,
  exerciseCount: number,
  completedResults: number,
) {
  const slots = players * exerciseCount;
  return {
    players,
    exerciseCount,
    completedResults,
    slots,
    completionLabel: `${completedResults}/${slots}`,
    overall: OVERALL_UNAVAILABLE,
  };
}

export function presentResult(result: PresentableResult): PresentedResult {
  const slug = result.testSlug;
  const name = TESTS.find((test) => test.slug === slug)?.name ?? slug;
  const metrics = result.metrics ?? {};
  const durationLabel = result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE;
  const base = {
    slug,
    name,
    durationLabel,
    note: isTestSlug(slug) ? NOTES[slug] : "Indicateurs indisponibles pour cet exercice.",
  };

  switch (slug) {
    case "visual-tracking":
      return { ...base, ...trackingView(result, metrics) };
    case "visual-memory":
      return { ...base, ...memoryView(result, metrics) };
    case "reaction-time":
      return { ...base, ...reactionView(result, metrics) };
    case "peripheral-vision":
      return { ...base, ...peripheralView(result, metrics) };
    case "football-visual-scanning":
      return { ...base, ...scanningView(result, metrics) };
    case "sequential-visual-search":
      return { ...base, ...sequentialView(result, metrics) };
    case "digit-memory":
      return { ...base, ...digitView(result, metrics) };
    case "dual-target-tracking":
      return { ...base, ...dualView(result, metrics) };
    default:
      return {
        ...base,
        headline: UNAVAILABLE,
        primaryLabel: "Indicateur principal",
        primaryValue: UNAVAILABLE,
        primaryUnit: "",
        lines: [],
        completionStatus: UNAVAILABLE,
      };
  }
}

function trackingView(result: PresentableResult, metrics: Record<string, unknown>) {
  const demo = metrics.demo === true;
  const found = num(metrics, "targetsFound") ?? (demo ? result.correctAnswers : result.correctAnswers);
  const wrong = num(metrics, "wrongClicks") ?? result.errors;
  const lines = [
    line("Cibles trouvées", count(found)),
    line("Mauvais clics", count(wrong)),
    line("Précision des clics", percent(result.accuracy)),
    line("Cibles manquées", UNAVAILABLE),
    line("Durée", result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE),
    line(
      "Score enregistré",
      demo ? "Non revérifié" : `${result.score}/100`,
    ),
  ];
  return {
    headline: found == null ? UNAVAILABLE : `${found} cibles`,
    primaryLabel: "Cibles trouvées",
    primaryValue: count(found),
    primaryUnit: "cibles",
    lines,
    completionStatus: demo ? "Démonstration" : "Terminé",
    note: demo
      ? `Résultat de démonstration conservé. Le score ${result.score} n'a pas été revérifié avec la formule actuelle. ${NOTES["visual-tracking"]}`
      : NOTES["visual-tracking"],
  };
}

function memoryView(result: PresentableResult, metrics: Record<string, unknown>) {
  const cells = num(metrics, "correctCells") ?? result.correctAnswers;
  const rounds = num(metrics, "roundsCompleted");
  return {
    headline: cells == null ? UNAVAILABLE : `${cells} cases`,
    primaryLabel: "Cases retenues",
    primaryValue: count(cells),
    primaryUnit: "cases",
    lines: [
      line("Cases retenues", count(cells)),
      line("Mauvaises sélections", count(result.errors)),
      line("Cases manquées", UNAVAILABLE),
      line("Précision", percent(result.accuracy)),
      line("Manches terminées", count(rounds)),
      line("Durée", result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE),
    ],
    completionStatus: "Terminé",
  };
}

function reactionView(result: PresentableResult, metrics: Record<string, unknown>) {
  const attempts = num(metrics, "attempts") ?? result.correctAnswers;
  const falseStarts = num(metrics, "falseStarts") ?? result.errors;
  return {
    headline: result.averageReactionMs > 0 ? formatMs(result.averageReactionMs) : UNAVAILABLE,
    primaryLabel: "Temps de réaction moyen",
    primaryValue: result.averageReactionMs > 0 ? formatMs(result.averageReactionMs) : UNAVAILABLE,
    primaryUnit: "ms",
    lines: [
      line("Temps moyen", result.averageReactionMs > 0 ? formatMs(result.averageReactionMs) : UNAVAILABLE),
      line("Meilleur temps", result.bestReactionMs > 0 ? formatMs(result.bestReactionMs) : UNAVAILABLE),
      line("Essais valides", count(attempts)),
      line("Faux départs", count(falseStarts)),
      line("Durée", result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE),
    ],
    completionStatus: attempts === 10 ? "Terminé" : UNAVAILABLE,
  };
}

function peripheralView(result: PresentableResult, metrics: Record<string, unknown>) {
  const leftTrials = num(metrics, "leftTrials");
  const leftCorrect = num(metrics, "leftCorrect");
  const rightTrials = num(metrics, "rightTrials");
  const rightCorrect = num(metrics, "rightCorrect");
  return {
    headline: `${result.correctAnswers} stimuli`,
    primaryLabel: "Stimuli détectés",
    primaryValue: String(result.correctAnswers),
    primaryUnit: "stimuli",
    lines: [
      line("Stimuli détectés", String(result.correctAnswers)),
      line("Mauvaises réponses", count(num(metrics, "wrongAnswers"))),
      line("Stimuli manqués", count(num(metrics, "missed"))),
      line("Précision gauche", sidePercent(num(metrics, "leftAccuracy"), leftCorrect, leftTrials)),
      line("Précision droite", sidePercent(num(metrics, "rightAccuracy"), rightCorrect, rightTrials)),
      line("Temps moyen", result.averageReactionMs > 0 ? formatMs(result.averageReactionMs) : UNAVAILABLE),
    ],
    completionStatus: "Terminé",
  };
}

function scanningView(result: PresentableResult, metrics: Record<string, unknown>) {
  const lines: PresentedLine[] = [
    line("Bonnes réponses", `${result.correctAnswers}/${SCANNING_SEQUENCES.length}`),
    line("Précision", percent(result.accuracy)),
    line("Temps total", result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE),
    line("Réponse la plus courte", result.bestReactionMs > 0 ? formatMs(result.bestReactionMs) : UNAVAILABLE),
  ];
  for (const [key, label] of [
    ["closest", "Proche du ballon"],
    ["defender", "Défenseur"],
    ["free", "Joueur libre"],
  ] as const) {
    const hits = num(metrics, `${key}Correct`);
    const total = num(metrics, `${key}Total`);
    lines.push(line(label, hits == null || total == null ? UNAVAILABLE : `${hits}/${total}`));
  }
  const times = Array.isArray(metrics.questionTimes) ? metrics.questionTimes : null;
  if (!times || times.length !== SCANNING_SEQUENCES.length) {
    lines.push(line("Temps par question", UNAVAILABLE));
  } else {
    times.forEach((value, index) => {
      const shown = typeof value === "number" ? formatSeconds(value) : UNAVAILABLE;
      lines.push(line(`Situation ${index + 1}`, shown));
    });
  }
  return {
    headline: `${result.correctAnswers}/${SCANNING_SEQUENCES.length}`,
    primaryLabel: "Bonnes réponses",
    primaryValue: `${result.correctAnswers}/${SCANNING_SEQUENCES.length}`,
    primaryUnit: "réponses",
    lines,
    completionStatus:
      result.correctAnswers + result.errors === SCANNING_SEQUENCES.length ? "Terminé" : UNAVAILABLE,
  };
}

function sequentialView(result: PresentableResult, metrics: Record<string, unknown>) {
  const found = num(metrics, "numbersFound");
  const total = num(metrics, "totalNumbers");
  const primary = found == null || total == null ? UNAVAILABLE : `${found}/${total}`;
  return {
    headline: primary,
    primaryLabel: "Nombres trouvés",
    primaryValue: primary,
    primaryUnit: "nombres",
    lines: [
      line("Nombres trouvés", primary),
      line("Temps", result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE),
      line("Mauvaises sélections", count(result.errors)),
      line("Précision", percent(result.accuracy)),
    ],
    completionStatus: metrics.completionStatus === "completed" && found === 50 ? "Terminé" : UNAVAILABLE,
  };
}

function digitView(result: PresentableResult, metrics: Record<string, unknown>) {
  const maximum = num(metrics, "maximumDigitsMemorized");
  const levels = num(metrics, "levelsCompleted");
  const presented = num(metrics, "totalDigitsPresented");
  const correctDigits = num(metrics, "totalCorrectDigits");
  const incorrectPositions =
    presented == null || correctDigits == null ? null : Math.max(0, presented - correctDigits);
  return {
    headline: maximum == null ? UNAVAILABLE : `${maximum} chiffres`,
    primaryLabel: "Suite maximale retenue",
    primaryValue: count(maximum),
    primaryUnit: "chiffres",
    lines: [
      line("Suite maximale retenue", count(maximum)),
      line("Niveaux réussis", levels == null ? UNAVAILABLE : `${levels}/${DIGIT_LEVELS.length}`),
      line("Suites justes", count(levels)),
      line("Suites fausses", count(num(metrics, "incorrectSequences") ?? result.errors)),
      line("Chiffres bien placés", count(correctDigits)),
      line("Chiffres mal placés", count(incorrectPositions)),
      line("Chiffres présentés", count(presented)),
      line("Temps", result.durationMs > 0 ? formatSeconds(result.durationMs) : UNAVAILABLE),
    ],
    completionStatus: metrics.completionStatus === "completed" ? "Terminé" : UNAVAILABLE,
  };
}

function dualView(result: PresentableResult, metrics: Record<string, unknown>) {
  const found = num(metrics, "correctlyIdentifiedTargets");
  const opportunities = num(metrics, "targetCount");
  const primary =
    found == null || opportunities == null ? UNAVAILABLE : `${found}/${opportunities}`;
  const success = metrics.completeSuccess;
  return {
    headline: primary,
    primaryLabel: "Cibles retrouvées",
    primaryValue: primary,
    primaryUnit: "cibles",
    lines: [
      line("Cibles retrouvées", primary),
      line("Occasions", count(opportunities)),
      line("Cibles manquées", count(num(metrics, "missedTargets"))),
      line("Mauvais choix", count(num(metrics, "incorrectSelections") ?? result.errors)),
      line("Réussite complète", success === true ? "Oui" : success === false ? "Non" : UNAVAILABLE),
      line("Niveau atteint", count(num(metrics, "difficultyLevelReached"))),
      line("Durée du mouvement", milliseconds(num(metrics, "movementDurationMs"))),
      line("Temps d'identification", milliseconds(num(metrics, "identificationTimeMs"))),
    ],
    completionStatus:
      metrics.completionStatus === "completed"
        ? `Terminé — ${DUAL_LEVELS.length} niveaux`
        : UNAVAILABLE,
  };
}

function isTestSlug(slug: string): slug is TestSlug {
  return slug in NOTES;
}

function num(metrics: Record<string, unknown>, key: string) {
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function count(value: number | null) {
  return value == null ? UNAVAILABLE : String(value);
}

function percent(value: number) {
  return Number.isFinite(value) ? formatPercent(value) : UNAVAILABLE;
}

function milliseconds(value: number | null) {
  return value == null ? UNAVAILABLE : formatSeconds(value);
}

function sidePercent(accuracy: number | null, correct: number | null, trials: number | null) {
  if (accuracy == null) return UNAVAILABLE;
  if (correct == null || trials == null) return formatPercent(accuracy);
  return `${formatPercent(accuracy)} (${correct}/${trials})`;
}

function line(label: string, value: string): PresentedLine {
  return { label, value };
}
