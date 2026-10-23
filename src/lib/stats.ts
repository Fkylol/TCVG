import type { Card, Rarity } from "./cards";

/**
 * Statistiques des cartes.
 *
 * Trois notions distinctes :
 * - la **rareté** (`card.rarity`) fixe les chances de tirage et ne bouge pas ;
 * - la **puissance** et l'**aura** situent la carte à l'intérieur de sa rareté ;
 * - la **qualité** est un indice qui résume les deux.
 *
 * Tout le barème est ici : changer les fourchettes ci-dessous recalcule les
 * 84 cartes d'un coup, sans toucher au catalogue.
 */

/** Fourchette d'une statistique : minimum, puis écart maximal au-dessus. */
export type StatBand = {
  /** Valeur pour un coefficient de 0. */
  min: number;
  /** Valeur ajoutée pour un coefficient de 1. */
  spread: number;
};

export type RarityStats = {
  power: StatBand;
  aura: StatBand;
};

/**
 * Barème central, par rareté.
 *
 * Les fourchettes se chevauchent volontairement : une carte Rare au sommet
 * peut dépasser une Épique en bas de sa fourchette.
 */
export const STAT_BANDS: Record<Rarity, RarityStats> = {
  C: { power: { min: 18, spread: 26 }, aura: { min: 12, spread: 24 } },
  R: { power: { min: 34, spread: 26 }, aura: { min: 28, spread: 26 } },
  SR: { power: { min: 52, spread: 26 }, aura: { min: 46, spread: 28 } },
  UR: { power: { min: 70, spread: 24 }, aura: { min: 64, spread: 28 } },
  L: { power: { min: 86, spread: 14 }, aura: { min: 82, spread: 18 } },
};

/**
 * Coefficient interne de chaque carte, entre 0 et 1.
 *
 * 0 = bas de la fourchette de sa rareté, 1 = sommet. C'est le seul curseur à
 * toucher pour faire monter ou descendre un personnage dans sa rareté.
 */
export const CARD_COEFFICIENTS: Record<string, number> = {
  // ——— Commun ———
  atreus: 0.75,
  luigi: 0.88,
  yoshi: 0.8,
  gruntilda: 0.55,
  mumbo: 0.42,
  ripto: 0.3,
  hunter: 0.45,
  solaire: 0.62,
  chell: 0.7,
  wheatley: 0.46,
  steve: 0.85,
  creeper: 0.5,
  yennefer: 0.68,
  cortex: 0.52,
  papyrus: 0.72,
  flowey: 0.58,
  mercy: 0.74,
  "king-dedede": 0.6,
  pikachu: 0.95,
  cuphead: 0.78,
  inkling: 0.66,

  // ——— Rare ———
  freya: 0.72,
  eggman: 0.84,
  shadow: 0.9,
  knuckles: 0.76,
  tifa: 0.88,
  hornet: 0.8,
  arbiter: 0.78,
  ciri: 0.82,
  crash: 0.8,
  ridley: 0.85,
  simon: 0.74,
  tracer: 0.7,
  reaper: 0.72,
  leon: 0.68,
  "chun-li": 0.65,
  "meta-knight": 0.62,
  gordon: 0.66,
  "king-dice": 0.32,
  madeline: 0.56,
  "2b": 0.9,

  // ——— Épique ———
  baldur: 0.8,
  bowser: 0.88,
  peach: 0.72,
  "banjo-kazooie": 0.6,
  zelda: 0.85,
  majora: 0.78,
  aerith: 0.82,
  artorias: 0.75,
  "le-chevalier": 0.6,
  cortana: 0.7,
  alucard: 0.85,
  sora: 0.8,
  vergil: 0.92,
  nemesis: 0.7,
  ryu: 0.78,
  bison: 0.65,
  "g-man": 0.55,

  // ——— Légendaire ———
  kratos: 0.96,
  mario: 0.99,
  spyro: 0.85,
  link: 0.95,
  sonic: 0.9,
  cloud: 0.92,
  gwyn: 0.8,
  grimm: 0.7,
  "master-chief": 0.88,
  "doom-slayer": 0.86,
  geralt: 0.82,
  samus: 0.84,
  sans: 0.74,
  radahn: 0.9,
  xehanort: 0.66,
  dante: 0.87,
  charizard: 0.89,
  joker: 0.79,

  // ——— Mythique ———
  ganondorf: 0.9,
  sephiroth: 0.97,
  glados: 0.8,
  "ender-dragon": 0.7,
  dracula: 0.88,
  malenia: 0.92,
  kirby: 0.96,
  mewtwo: 0.93,
};

/** Coefficient d'une carte, borné entre 0 et 1. */
export function coefficientOf(card: Card): number {
  const value = CARD_COEFFICIENTS[card.id] ?? 0.5;
  return Math.min(1, Math.max(0, value));
}

/** Valeur d'une statistique pour un coefficient donné, arrondie à l'unité. */
export function statValue(band: StatBand, coefficient: number): number {
  const clamped = Math.min(1, Math.max(0, coefficient));
  return Math.round(band.min + band.spread * clamped);
}

export type QualityGradeKey = "standard" | "solide" | "brillante" | "prestige" | "relique";

export type QualityGrade = {
  key: QualityGradeKey;
  label: string;
  /** Seuil bas de la note, incluse. */
  min: number;
  /** Classes Tailwind du badge. */
  tone: string;
};

/** Paliers de qualité, du plus courant au plus rare. */
export const QUALITY_GRADES: QualityGrade[] = [
  { key: "standard", label: "Standard", min: 0, tone: "bg-white/10 text-white/70" },
  { key: "solide", label: "Solide", min: 35, tone: "bg-sky-400/15 text-sky-200" },
  { key: "brillante", label: "Brillante", min: 50, tone: "bg-violet-400/15 text-violet-200" },
  { key: "prestige", label: "Prestige", min: 65, tone: "bg-amber-300/15 text-amber-200" },
  { key: "relique", label: "Relique", min: 80, tone: "bg-fuchsia-400/20 text-fuchsia-200" },
];

export function qualityGrade(quality: number): QualityGrade {
  let current = QUALITY_GRADES[0];
  for (const grade of QUALITY_GRADES) {
    if (quality >= grade.min) current = grade;
  }
  return current;
}

export type CardStats = {
  power: number;
  aura: number;
  /** Indice 0–100 : 60 % puissance, 40 % aura. */
  quality: number;
  grade: QualityGrade;
};

/** Puissance, aura et qualité d'une carte. */
export function cardStats(card: Card): CardStats {
  const bands = STAT_BANDS[card.rarity];
  const coefficient = coefficientOf(card);
  const power = statValue(bands.power, coefficient);
  const aura = statValue(bands.aura, coefficient);
  const quality = Math.min(100, Math.max(0, Math.round(power * 0.6 + aura * 0.4)));

  return { power, aura, quality, grade: qualityGrade(quality) };
}

/**
 * Score de duel provisoire d'une carte : la puissance pèse plus que l'aura.
 * Aucun mode de combat ne l'utilise encore, mais il est figé ici pour que le
 * futur gameplay n'ait pas à réinventer la formule.
 */
export function duelScore(stats: CardStats): number {
  return Math.round(stats.power * 0.7 + stats.aura * 0.3);
}

export type CollectionScore = {
  /** Cartes uniques prises en compte. */
  unique: number;
  power: number;
  aura: number;
  /** Somme des qualités : le score de collection affiché et classé. */
  quality: number;
  duel: number;
};

/**
 * Agrège une collection (cartes uniques) en score global.
 * Les doublons ne comptent pas : posséder deux fois la même carte n'ajoute
 * rien à la valeur de la collection.
 */
export function collectionScore(cards: Card[]): CollectionScore {
  const score: CollectionScore = { unique: cards.length, power: 0, aura: 0, quality: 0, duel: 0 };

  for (const card of cards) {
    const stats = cardStats(card);
    score.power += stats.power;
    score.aura += stats.aura;
    score.quality += stats.quality;
    score.duel += duelScore(stats);
  }

  return score;
}
