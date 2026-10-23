import { CARDS, type Card, type Rarity } from "./cards";

export type RarityInfo = {
  key: Rarity;
  label: string;
  short: string;
  /** Poids relatif dans le tirage (somme = 1000, soit un pourcentage x10). */
  weight: number;
  ring: string;
  badge: string;
  text: string;
  /** Filet de couleur, utilisé pour ourler les tuiles de la légende des raretés. */
  bar: string;
};

export const RARITY: Record<Rarity, RarityInfo> = {
  C: {
    key: "C",
    label: "Commun",
    short: "C",
    weight: 600,
    ring: "ring-white/15",
    badge: "bg-white/10 text-white/70",
    text: "text-white/70",
    bar: "bg-white/30",
  },
  R: {
    key: "R",
    label: "Rare",
    short: "R",
    weight: 250,
    ring: "ring-sky-400/40",
    badge: "bg-sky-400/15 text-sky-200",
    text: "text-sky-200",
    bar: "bg-sky-400",
  },
  SR: {
    key: "SR",
    label: "Épique",
    short: "SR",
    weight: 100,
    ring: "ring-violet-400/50",
    badge: "bg-violet-400/15 text-violet-200",
    text: "text-violet-200",
    bar: "bg-violet-400",
  },
  UR: {
    key: "UR",
    label: "Légendaire",
    short: "UR",
    weight: 40,
    ring: "ring-amber-300/60",
    badge: "bg-amber-300/15 text-amber-200",
    text: "text-amber-200",
    bar: "bg-amber-300",
  },
  L: {
    key: "L",
    label: "Mythique",
    short: "L",
    weight: 10,
    ring: "ring-fuchsia-400/70",
    badge: "bg-fuchsia-400/20 text-fuchsia-200",
    text: "text-fuchsia-200",
    bar: "bg-fuchsia-400",
  },
};

export const RARITY_ORDER: Rarity[] = ["L", "UR", "SR", "R", "C"];

export const CARDS_PER_BOOSTER = 3;

/** Durée d'attente avant de gagner un booster supplémentaire. */
export const BOOSTER_COOLDOWN_MS = 10 * 60 * 1000;

/** Nombre maximum de boosters cumulables. */
export const BOOSTER_STOCK_MAX = 10;

/** Poids cumulés, calculés une fois. */
const TOTAL_WEIGHT = Object.values(RARITY).reduce((sum, r) => sum + r.weight, 0);

const POOL: Record<Rarity, Card[]> = {
  C: CARDS.filter((c) => c.rarity === "C"),
  R: CARDS.filter((c) => c.rarity === "R"),
  SR: CARDS.filter((c) => c.rarity === "SR"),
  UR: CARDS.filter((c) => c.rarity === "UR"),
  L: CARDS.filter((c) => c.rarity === "L"),
};

export type Random = () => number;

export function rollRarity(random: Random = Math.random): Rarity {
  let ticket = random() * TOTAL_WEIGHT;
  for (const info of Object.values(RARITY)) {
    ticket -= info.weight;
    if (ticket < 0) return info.key;
  }
  return "C";
}

function pickFromPool(rarity: Rarity, random: Random, excluded: Set<string>): Card {
  const pool = POOL[rarity];
  const available = pool.filter((card) => !excluded.has(card.id));
  const candidates = available.length > 0 ? available : pool;
  return candidates[Math.floor(random() * candidates.length) % candidates.length];
}

/** Tire un booster : une rareté par slot, sans doublon à l'intérieur du paquet. */
export function rollBooster(random: Random = Math.random, size = CARDS_PER_BOOSTER): Card[] {
  const drawn: Card[] = [];
  const used = new Set<string>();
  for (let i = 0; i < size; i++) {
    const card = pickFromPool(rollRarity(random), random, used);
    used.add(card.id);
    drawn.push(card);
  }
  return drawn;
}

/**
 * Stock courant vu du client : part du stock renvoyé par le serveur et ajoute
 * les tranches de 10 minutes écoulées depuis l'ancre, plafonné à 10.
 * La vérité reste côté base — ce calcul ne sert qu'à l'affichage.
 */
export function projectedStock(
  stock: number,
  anchor: string | null,
  now: number,
): { stock: number; nextAt: number | null } {
  if (!anchor) return { stock: Math.min(stock, BOOSTER_STOCK_MAX), nextAt: null };

  const anchorMs = new Date(anchor).getTime();
  const accrued = Math.floor((now - anchorMs) / BOOSTER_COOLDOWN_MS);

  if (accrued <= 0) {
    return { stock: Math.min(stock, BOOSTER_STOCK_MAX), nextAt: anchorMs + BOOSTER_COOLDOWN_MS };
  }

  const total = Math.min(BOOSTER_STOCK_MAX, stock + accrued);
  if (total >= BOOSTER_STOCK_MAX) return { stock: total, nextAt: null };

  const nextAnchor = anchorMs + accrued * BOOSTER_COOLDOWN_MS;
  return { stock: total, nextAt: nextAnchor + BOOSTER_COOLDOWN_MS };
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function collectionCompletion(ownedUnique: number): number {
  if (CARDS.length === 0) return 0;
  return Math.round((ownedUnique / CARDS.length) * 100);
}

export { CARDS };
export type { Card, Rarity };
