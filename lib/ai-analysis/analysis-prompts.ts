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
    "Reste concis : 3 à 5 observations, 2 à 3 forces, 2 à 3 axes, 2 à 3 recommandations. Ne dépasse pas ces nombres.",
    "Ne conclus pas qu'un exercice prédit la performance en match.",
    "Ne juge pas l'intelligence, la personnalité, le talent ou le potentiel professionnel.",
    "Si les données sont insuffisantes, dis-le et n'invente pas de force ni de faiblesse.",
    "Formule en français professionnel et en arabe standard clair, dans la même réponse.",
    "Ne mélange pas les deux langues dans un même paragraphe.",
    "Les clés de métriques restent en anglais technique, identiques dans les deux langues.",
    "Chaque observation cite des evidence_metric_keys présentes dans allowedMetricKeys.",
    "Les recommandations sont des exercices de terrain concrets, liés à l'indicateur observé.",
    "confidence est low quand il n'y a qu'une tentative.",
  ].join("\n");
}

export function analysisPayload(context: AnalysisContext) {
  const isGroup = context.reportType === "group";
  return {
    promptVersion: PROMPT_VERSION,
    reportType: context.reportType,
    playerLabel: isGroup ? "groupe de la séance" : "joueur de la séance",
    tests: isGroup ? [] : context.currentTests,
    groupPlayers: isGroup ? context.groupPlayers ?? [] : undefined,
    focusTest: context.focusTestSlug ?? null,
    reference: context.reference,
    definitions: context.metricDefinitions,
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
