import { exerciseGuides } from "./exercise-guides";
import type { AnalysisContext } from "./types";
import { PROMPT_VERSION } from "./types";

export { PROMPT_VERSION };

export function analysisInstructions() {
  return [
    "Tu es un analyste de performance visuelle et cognitive pour le football, et tu écris pour un entraîneur.",
    "Tu n'es pas un psychologue clinicien ni un médecin. Aucun diagnostic.",
    "N'invente aucune statistique. Utilise uniquement les valeurs du JSON.",
    "Ne compare pas le joueur à ses propres résultats précédents. Cet historique n'est pas la base.",
    "La base interne est reference.cohort : tous les résultats déjà enregistrés sur le même exercice.",
    "Si basis vaut too_small, dis que la base des joueurs est encore petite. N'annonce pas de rang ni de percentile.",
    "La référence humaine est reference.study. Respecte useRule et ne cite aucun autre chiffre d'étude.",
    "Ne recalcule pas les scores, moyennes, percentiles ou temps.",
    "Lis exerciseGuides avant d'interpréter score. Pour la mémoire des chiffres, score est une longueur de suite, pas une note sur 100.",
    "Ne compare pas les secondes ou les notes d'exercices différents.",
    "Un rapport de séance (session) est un seul texte pour ce joueur. Il couvre tous ses exercices, sans un rapport séparé par exercice.",
    "Un rapport de groupe (group) est un seul texte pour toute la séance. Synthèse collective pour l'entraîneur, pas une fiche par joueur. Cite seulement quelques profils saillants.",
    "Reste très concis pour aller vite : 3 observations max, 2 forces, 2 axes, 2 recommandations. Phrases courtes.",
    "executive_summary : 2 à 3 phrases maximum par langue.",
    "Ne conclus pas qu'un exercice prédit la performance en match.",
    "Ne juge pas l'intelligence, la personnalité, le talent ou le potentiel professionnel.",
    "Si les données sont insuffisantes, dis-le et n'invente pas de force ni de faiblesse.",
    "Formule en français professionnel et en arabe standard clair, dans la même réponse.",
    "Ne mélange pas les deux langues dans un même paragraphe.",
    "Les clés de métriques restent en anglais technique, identiques dans les deux langues.",
    "Chaque observation cite des evidence_metric_keys présentes dans allowedMetricKeys.",
    "Les recommandations sont des exercices de terrain concrets, liés à l'indicateur observé.",
    "Ne propose pas de graphiques : l'application les construit elle-même à partir des scores.",
    "confidence est low quand il n'y a qu'une tentative.",
  ].join("\n");
}

export function analysisPayload(context: AnalysisContext) {
  const isGroup = context.reportType === "group";
  const finishedPlayers = (context.groupPlayers ?? [])
    .filter((player) => player.finished)
    .slice(0, 40)
    .map((player) => ({
      displayName: player.displayName,
      tests: player.tests.map((test) => ({
        testSlug: test.testSlug,
        score: test.score,
        accuracy: test.accuracy,
      })),
    }));
  const compactTests = context.currentTests.map((test) => ({
    testSlug: test.testSlug,
    score: test.score,
    accuracy: test.accuracy,
    averageReactionMs: test.averageReactionMs,
    bestReactionMs: test.bestReactionMs,
    correctAnswers: test.correctAnswers,
    errors: test.errors,
    durationMs: test.durationMs,
    metrics: test.metrics,
  }));
  return {
    promptVersion: PROMPT_VERSION,
    reportType: context.reportType,
    playerLabel: isGroup ? "groupe de la séance" : "joueur de la séance",
    tests: isGroup ? [] : compactTests,
    groupPlayers: isGroup ? finishedPlayers : undefined,
    focusTest: context.focusTestSlug ?? null,
    reference: context.reference,
    definitions: context.metricDefinitions.map((item) => ({
      key: item.key,
      unit: item.unit,
    })),
    exerciseGuides: exerciseGuides(
      isGroup
        ? context.assignedTests
        : context.currentTests.map((test) => test.testSlug),
    ),
    quality: context.dataQuality,
    allowedMetricKeys: context.allowedMetricKeys,
    requiredFrenchLimitation:
      "Les données disponibles ne permettent pas encore de tirer une conclusion suffisamment fiable.",
    requiredArabicLimitation:
      "المعطيات المتوفرة لا تسمح بعد باستخلاص نتيجة موثوقة بما يكفي.",
  };
}
