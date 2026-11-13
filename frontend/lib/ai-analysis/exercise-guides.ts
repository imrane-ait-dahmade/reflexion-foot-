const GUIDES: Record<string, string> = {
  "visual-tracking":
    "Indicateur principal : cibles trouvées. La précision compte les clics, pas toutes les cibles possibles. Le score sur 100 mélange cibles, précision des clics et vitesse.",
  "visual-memory":
    "Indicateur principal : cases retenues. La précision divise les cases justes par les cases justes plus les mauvaises sélections.",
  "reaction-time":
    "Indicateur principal : temps de réaction moyen en millisecondes. Les faux départs sont exclus de cette moyenne. Il n'y a pas de médiane.",
  "peripheral-vision":
    "Indicateur principal : stimuli correctement détectés. Les stimuli manqués restent dans le dénominateur de la précision.",
  "football-visual-scanning":
    "Indicateur principal : bonnes réponses sur neuf questions. Une absence de réponse vaut 12 secondes. Le temps le plus court n'est pas forcément une bonne réponse.",
  "sequential-visual-search":
    "Indicateur principal : nombres trouvés sur 50. La précision est 50 divisé par 50 plus les mauvaises sélections. Le champ score reprend cette précision, pas un classement de vitesse.",
  "digit-memory":
    "Indicateur principal : maximumDigitsMemorized, la plus longue suite reproduite dans l'ordre. Le champ score est cette longueur, de 0 à 10, pas une note sur 100. Un chiffre n'est juste qu'à la bonne position.",
  "dual-target-tracking":
    "Indicateur principal : cibles retrouvées sur le nombre d'occasions, par exemple 9/10. La précision est les cibles retrouvées divisées par les occasions. Il y a deux cibles par niveau.",
};

export function exerciseGuides(slugs: string[]) {
  return Object.fromEntries(
    [...new Set(slugs)].map((slug) => [slug, GUIDES[slug] ?? "Indicateur non défini."]),
  );
}
