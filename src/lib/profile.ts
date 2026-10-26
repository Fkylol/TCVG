import type { Card } from "@/lib/cards";

/**
 * Compteurs d'affichage du profil. Les cadres ne vivent plus ici : toute leur
 * logique est dans `src/lib/frames.config.ts`.
 */
export type CollectionStats = {
  unique: number;
  legendary: number;
  mythic: number;
};

/** Compte les personnages possédés et les hautes raretés, pour le profil. */
export function collectionStats(owned: Card[]): CollectionStats {
  return {
    unique: owned.length,
    legendary: owned.filter((card) => card.rarity === "UR").length,
    mythic: owned.filter((card) => card.rarity === "L").length,
  };
}
