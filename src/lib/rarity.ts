import type { Rarity } from "./cards";

/**
 * Correspondance unique des raretés.
 *
 * Les clés viennent de la base (`cards.rarity`) et ne changent jamais :
 * `C`, `UC`, `R`, `SR`, `UR`, `L`. Ce que l'on affiche — nom, lettre du badge,
 * token de couleur — est défini ici et nulle part ailleurs, en miroir de la
 * table `public.rarity_labels` (migration 013).
 *
 * `token` désigne la variable CSS `--rarity-*` à utiliser :
 *   --rarity-C (gris), --rarity-U (vert), --rarity-R (bleu),
 *   --rarity-E (violet), --rarity-L (or), --rarity-M (rose prismatique).
 *
 * Lettres affichées : C, U, R, E, L, M.
 */
export type RarityMeta = {
  /** Nom affiché en toutes lettres. */
  name: string;
  /** Lettre du badge rond. */
  letter: string;
  /** Suffixe du token CSS, sans le préfixe `--rarity-`. */
  token: string;
};

export const RARITY_META: Record<Rarity, RarityMeta> = {
  C: { name: "Commune", letter: "C", token: "rarity-C" },
  UC: { name: "Peu commune", letter: "U", token: "rarity-U" },
  R: { name: "Rare", letter: "R", token: "rarity-R" },
  SR: { name: "Épique", letter: "E", token: "rarity-E" },
  UR: { name: "Légendaire", letter: "L", token: "rarity-L" },
  L: { name: "Mythique", letter: "M", token: "rarity-M" },
};

/** Nom CSS de la variable de couleur d'une rareté (`--rarity-E`, …). */
export function rarityColorVar(rarity: Rarity): string {
  return `--${RARITY_META[rarity].token}`;
}
