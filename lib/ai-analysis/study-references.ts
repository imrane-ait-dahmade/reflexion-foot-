import type { StudyReference } from "./types";

const SHARED_LIMIT =
  "Ce n'est pas une norme de l'application. Ne transforme pas cette référence en seuil de score.";

export const STUDY_REFERENCES: Record<string, StudyReference> = {
  "visual-tracking": {
    construct: "Suivi visuel de plusieurs éléments en mouvement.",
    source:
      "Pylyshyn et Storm, 1988, Spatial Vision ; Faubert, 2013, Scientific Reports, sur l'apprentissage de scènes visuelles dynamiques chez des athlètes.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Ces protocoles ne mesurent pas 30 chiffres sur un écran. Décris seulement le score enregistré et sa place parmi les joueurs de l'application.`,
  },
  "visual-memory": {
    construct: "Mémoire visuospatiale à court terme.",
    source:
      "La tâche de Corsi est le repère humain classique de l'empan spatial. L'exercice de l'application montre 5 cases une seule fois.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Une seule exposition de 5 cases n'est pas une mesure d'empan. Ne dis pas que le joueur a une mémoire normale ou faible par rapport à une population.`,
  },
  "reaction-time": {
    construct: "Temps de réaction visuel simple chez l'adulte.",
    source: "Woods et al., 2015, Frontiers in Human Neuroscience, 1469 adultes de 18 à 65 ans.",
    publishedValue:
      "Moyenne de 231 ms pour un appui simple calibré, ou 213 ms après correction du délai du matériel.",
    useRule:
      "L'exercice demande de toucher une cible qui apparaît. Le temps enregistré inclut le geste, et le protocole n'est pas celui de Woods. Cite 231 ms seulement comme ordre de grandeur d'un test différent. Ne conclus pas que le joueur est lent ou rapide par rapport à ce chiffre.",
  },
  "peripheral-vision": {
    construct: "Détection d'une cible brève en dehors du centre du regard.",
    source:
      "Le champ visuel utile est étudié en laboratoire, mais pas avec ce flash gauche ou droite sur navigateur.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Il n'existe pas de pourcentage humain publié pour cet exercice exact.`,
  },
  "sequential-visual-search": {
    construct:
      "Recherche visuelle séquentielle : balayage visuel, attention sélective, attention soutenue et vitesse de traitement de l'information visuelle.",
    source:
      "La table de Schulte est un exercice classique de recherche visuelle dans l'ordre. Cette version 1–50 n'a pas de norme de temps publiée dans l'application.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Décris le temps completionTimeMs, le nombre d'erreurs et la précision déjà calculée. Ne compare le temps à aucun autre joueur. Ne conclus rien sur un trouble de l'attention, l'intelligence ou la performance en match. Le champ score reprend la précision, pas un classement de vitesse.`,
  },
  "dual-target-tracking": {
    construct:
      "Suivi simultané de deux cibles mobiles parmi des objets identiques : attention divisée et mémoire visuelle du mouvement.",
    source:
      "Le suivi de cibles multiples est étudié en laboratoire. Cette version à deux cibles n'a pas de norme publiée dans l'application.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Décris les cibles retrouvées, les mauvais choix, la précision déjà calculée et le niveau atteint. Ne conclus rien sur un trouble de l'attention ni sur la performance en match.`,
  },
  "digit-memory": {
    construct:
      "Mémoire à court terme d'une suite de chiffres, dans l'ordre exact.",
    source:
      "L'empan de chiffres est un repère classique. Cette progression de 3 à 10 chiffres n'est pas un test clinique.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Le chiffre principal est maximumDigitsMemorized. Une position fausse n'est pas un chiffre correct. Ne parle pas d'intelligence, de trouble de la mémoire ou de performance en match.`,
  },
  "football-visual-scanning": {
    construct: "Lecture perceptivo-cognitive d'une situation de jeu.",
    source:
      "Ward et Williams, 2003, Journal of Sport and Exercise Psychology, sur le développement des habiletés perceptives et cognitives au football.",
    publishedValue: null,
    useRule: `${SHARED_LIMIT} Les 9 situations viennent d'un extrait Metrica et ne sont pas une batterie validée. Ne prédis pas la qualité de jeu en match.`,
  },
};

export function studyForSlug(slug: string): StudyReference | null {
  return STUDY_REFERENCES[slug] ?? null;
}
