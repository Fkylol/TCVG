export type UpdateEntry = {
  /** Date lisible, en français. */
  date: string;
  title: string;
  items: string[];
};

export type PlannedEntry = {
  title: string;
  text: string;
};

/**
 * Mises à jour publiées, de la plus récente à la plus ancienne.
 * Une entrée ne s'ajoute ici qu'une fois la fonctionnalité en ligne.
 */
export const UPDATES: UpdateEntry[] = [
  {
    date: "23 octobre 2026",
    title: "Marché entre joueurs et visuels de boosters",
    items: [
      "Le marché ouvre : mets tes doublons en vente, achète avec des Pixels, avec 5 % de commission à la vente.",
      "Les prix sont recalculés sur les ventes récentes, dans une fourchette par rareté ; les holos se vendent dans une fourchette 3 × plus haute.",
      "La boutique affiche un visuel par thème, avec le Mix mis en avant comme pack vitrine.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Pixels et boosters payants",
    items: [
      "Les Pixels arrivent : 10 offerts toutes les 24 h, avec le solde affiché dans l'en-tête.",
      "Des boosters s'achètent en Pixels, avec les taux de rareté affichés, une garantie toutes les 10 / 50 ouvertures et 2 % de holos.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Recyclage des doublons et connexion Discord",
    items: [
      "Les doublons normaux se recyclent en Pixels, un par un ou tous d'un coup, avec le prix affiché. Une copie normale de chaque carte est toujours conservée.",
      "Les cartes holo se recyclent à la main, pour trois fois la valeur de leur rareté.",
      "La connexion et l'inscription passent uniquement par Discord : plus de mot de passe à retenir.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Franchises et genres",
    items: [
      "Les 84 cartes sont rattachées à leur franchise (32 univers) et à un ou plusieurs genres.",
      "Chaque carte affiche son numéro d'album (#01 Kratos, #71 Kirby) à la place des anciennes stats.",
      "La progression de l'album se prépare par franchise, avec les genres comme base des futurs boosters thématiques.",
    ],
  },
  {
    date: "Octobre 2026",
    title: "Connexion Discord et pied de page",
    items: [
      "Connexion et inscription avec un compte Discord.",
      "Un pied de page commun à toutes les pages, avec les raccourcis du site.",
      "Pseudo repris automatiquement depuis le compte Discord à l'inscription.",
    ],
  },
];

/** Ce qui est en préparation, sans date annoncée. */
export const PLANNED: PlannedEntry[] = [
  {
    title: "Marché enrichi",
    text: "Expiration des annonces, édition du prix et historique des ventes carte par carte. Toujours uniquement en Pixels, sans argent réel.",
  },
];
