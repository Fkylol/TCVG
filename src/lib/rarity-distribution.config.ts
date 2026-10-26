/**
 * Réglages du calcul de rareté par popularité.
 *
 * Tout est ici, en un seul endroit : le calcul (`rarity:preview`) et
 * l'application (`rarity:apply`) lisent ce fichier. Modifier une part cible ne
 * touche ni la base ni les cartes tant que `rarity:apply --yes` n'a pas tourné.
 *
 * Les clés sont celles de la base et ne changent jamais : `C` Commune,
 * `UC` Peu commune, `R` Rare, `SR` Épique, `UR` Légendaire, `L` Mythique.
 */

import type { Rarity } from "./cards";

/** Paliers, du plus rare au plus commun. Les quotas se remplissent dans cet ordre. */
export const RARITY_ORDER: Rarity[] = ["L", "UR", "SR", "R", "UC", "C"];

/**
 * Parts cibles par rareté (somme = 1). Les effectifs sont arrondis au plus
 * proche pour tomber exactement sur le nombre de cartes du catalogue : la
 * plus grande reste distribue les cartes manquantes.
 */
export const RARITY_SHARES: Record<Rarity, number> = {
  L: 0.02,
  UR: 0.05,
  SR: 0.11,
  R: 0.2,
  UC: 0.26,
  C: 0.36,
};

/** Plafond par franchise et par rareté (les paliers absents ne sont pas plafonnés). */
export const FRANCHISE_CAPS: Partial<Record<Rarity, number>> = {
  L: 3,
  UR: 8,
};

/** Poids du score de popularité : pages vues puis nombre de langues. */
export const POPULARITY_WEIGHTS = {
  pageviews: 0.7,
  languages: 0.3,
} as const;

/**
 * Repli d'une carte sans correspondance vérifiée.
 *
 * Le score de repli mélange la popularité de la franchise (percentile global)
 * et l'importance du personnage dans son wiki de franchise (backlinks et
 * taille de page, comparés seulement entre personnages de la même franchise).
 * Si le wiki ou la page manque, on retombe sur une part du score de franchise.
 */
export const FALLBACK_WEIGHTS = {
  franchise: 0.4,
  internal: 0.6,
  backlinks: 0.6,
  pageSize: 0.4,
} as const;

/** Repli sans wiki : part du score de sa franchise. */
export const FRANCHISE_FALLBACK_FACTOR = 0.3;

/** Langues interrogées (Wikipédia + Wikidata). */
export const LANGUAGES = ["en", "fr", "ja", "es", "de", "pt"] as const;

/** Mois complets demandés à l'API de pages vues (le mois en cours est exclu). */
export const PAGEVIEW_MONTHS = 12;

/** Seuils d'acceptation d'une correspondance Wikidata. */
export const MATCH_THRESHOLD = 0.75;
/** Écart minimal avec le deuxième candidat pour accepter sans arbitrage. */
export const MATCH_MARGIN = 0.15;

/**
 * Pondération des indices de correspondance.
 *
 * Le barème du cahier des charges (nom exact 0,40 · personnage 0,20 ·
 * franchise 0,30 · article 0,10) est complété par un indice plus faible :
 * le titre de l'article commence par le nom de la carte et continue
 * (« Tifa » → « Tifa Lockhart »). Le catalogue abrège les noms, Wikidata
 * utilise le nom complet ; sans cet indice, ces personnages resteraient
 * introuvables. Il ne suffit jamais seul (0,25 + 0,20 + 0,10 = 0,55, sous le
 * seuil) : il faut le lien avec la franchise pour dépasser 0,75.
 */
export const MATCH_WEIGHTS = {
  exactName: 0.4,
  prefixName: 0.25,
  fictionalCharacter: 0.2,
  franchiseLink: 0.3,
  wikipediaArticle: 0.1,
} as const;

/**
 * Contrôles bloquants de `rarity:apply`. Un seul échec et rien n'est appliqué.
 */
export const CONTROLS = {
  /** Tolérance sur les effectifs par rareté (en cartes). */
  countTolerance: 1,
  /** Confiance minimale exigée pour les Mythiques et Légendaires. */
  topRarityConfidence: 0.9,
  /** Confiance minimale exigée pour les Épiques. */
  epicConfidence: 0.75,
  /** Alerte si une carte dépasse ce multiple de la médiane de sa franchise. */
  franchiseOutlierFactor: 10,
  /** Cartes minimales par rareté (C → R) dans chaque booster de genre. */
  minCardsPerGenreRarity: 2,
} as const;
