import type { Card } from "@/lib/cards";

/** Cadres d'avatar débloquables par palier de collection. */
export type FrameKey = "steel" | "jade" | "amethyst" | "gold" | "mythic";

export type FrameInfo = {
  label: string;
  /** Anneau appliqué autour de l'avatar. */
  ring: string;
  /** Halo, vide pour le cadre par défaut. */
  glow: string;
  requirement: string;
};

export const FRAMES: Record<FrameKey, FrameInfo> = {
  steel: {
    label: "Acier",
    ring: "ring-white/25",
    glow: "",
    requirement: "Par défaut",
  },
  jade: {
    label: "Jade",
    ring: "ring-emerald-300/70",
    glow: "shadow-[0_0_20px_-6px_#6ee7b7]",
    requirement: "10 personnages possédés",
  },
  amethyst: {
    label: "Améthyste",
    ring: "ring-violet-400/80",
    glow: "shadow-[0_0_22px_-6px_#a78bfa]",
    requirement: "25 personnages possédés",
  },
  gold: {
    label: "Or",
    ring: "ring-amber-300/85",
    glow: "shadow-[0_0_24px_-6px_#fcd34d]",
    requirement: "Posséder une Légendaire",
  },
  mythic: {
    label: "Mythique",
    ring: "ring-fuchsia-400/90",
    glow: "shadow-[0_0_26px_-4px_#f472b6]",
    requirement: "Posséder une Mythique",
  },
};

export const FRAME_ORDER: FrameKey[] = ["steel", "jade", "amethyst", "gold", "mythic"];

/** Ramène une valeur quelconque (base, cookie) vers un cadre valide. */
export function frameOf(value: string | null | undefined): FrameKey {
  return value && value in FRAMES ? (value as FrameKey) : "steel";
}

export type CollectionStats = {
  unique: number;
  legendary: number;
  mythic: number;
};

/** Compte les personnages possédés et les hautes raretés, pour les paliers. */
export function collectionStats(owned: Card[]): CollectionStats {
  return {
    unique: owned.length,
    legendary: owned.filter((card) => card.rarity === "UR").length,
    mythic: owned.filter((card) => card.rarity === "L").length,
  };
}

/** Cadres ouverts par le joueur, dans l'ordre d'affichage. */
export function unlockedFrames(stats: CollectionStats): FrameKey[] {
  return FRAME_ORDER.filter((key) => {
    if (key === "steel") return true;
    if (key === "jade") return stats.unique >= 10;
    if (key === "amethyst") return stats.unique >= 25;
    if (key === "gold") return stats.legendary >= 1;
    return stats.mythic >= 1;
  });
}
