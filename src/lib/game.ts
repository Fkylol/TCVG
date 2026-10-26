import { CARDS, type Card, type Rarity } from "./cards";
import { RARITY_META } from "./rarity";

export type RarityInfo = {
  key: Rarity;
  label: string;
  short: string;
  /** Nom de la variable CSS de couleur (`--rarity-E`, …). */
  token: string;
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
    label: RARITY_META.C.name,
    short: RARITY_META.C.letter,
    token: RARITY_META.C.token,
    weight: 620.25,
    ring: "ring-white/15",
    badge: "bg-white/10 text-white/70",
    text: "text-white/70",
    bar: "bg-white/30",
  },
  UC: {
    key: "UC",
    label: RARITY_META.UC.name,
    short: RARITY_META.UC.letter,
    token: RARITY_META.UC.token,
    weight: 250,
    ring: "ring-emerald-400/50",
    badge: "bg-emerald-400/15 text-emerald-200",
    text: "text-emerald-200",
    bar: "bg-emerald-400",
  },
  R: {
    key: "R",
    label: RARITY_META.R.name,
    short: RARITY_META.R.letter,
    token: RARITY_META.R.token,
    weight: 114,
    ring: "ring-sky-400/40",
    badge: "bg-sky-400/15 text-sky-200",
    text: "text-sky-200",
    bar: "bg-sky-400",
  },
  SR: {
    key: "SR",
    label: RARITY_META.SR.name,
    short: RARITY_META.SR.letter,
    token: RARITY_META.SR.token,
    weight: 14,
    ring: "ring-violet-400/50",
    badge: "bg-violet-400/15 text-violet-200",
    text: "text-violet-200",
    bar: "bg-violet-400",
  },
  UR: {
    key: "UR",
    label: RARITY_META.UR.name,
    short: RARITY_META.UR.letter,
    token: RARITY_META.UR.token,
    weight: 1.5,
    ring: "ring-amber-300/60",
    badge: "bg-amber-300/15 text-amber-200",
    text: "text-amber-200",
    bar: "bg-amber-300",
  },
  L: {
    key: "L",
    label: RARITY_META.L.name,
    short: RARITY_META.L.letter,
    token: RARITY_META.L.token,
    weight: 0.25,
    ring: "ring-fuchsia-400/70",
    badge: "bg-fuchsia-400/20 text-fuchsia-200",
    text: "text-fuchsia-200",
    bar: "bg-fuchsia-400",
  },
};

export const RARITY_ORDER: Rarity[] = ["L", "UR", "SR", "R", "UC", "C"];

/** Rareté la plus haute d'une liste (L > UR > SR > R > UC > C). */
export function rarestRarity(rarities: Rarity[]): Rarity {
  let best: Rarity = "C";
  for (const rarity of rarities) {
    if (RARITY_ORDER.indexOf(rarity) < RARITY_ORDER.indexOf(best)) best = rarity;
  }
  return best;
}

/**
 * Nombre de cartes par booster — constante unique.
 *
 * La valeur qui fait foi en base est `booster_types.cards_count` (et
 * `game_config.cards_per_booster`) : le tirage tourne dans `open_pack()`, donc
 * côté serveur. Cette constante sert à l'affichage et aux tests de cohérence
 * (voir tests/game.test.ts, qui vérifie que les 11 packs en base valent 5).
 */
export const CARDS_PER_BOOSTER = 5;

/**
 * Nombre maximum d'envies par joueur. Le déclencheur `wishlist_limit` en base
 * applique la même valeur : c'est lui qui fait foi, la constante sert à
 * l'affichage.
 */
export const WISHLIST_LIMIT = 200;

/** Durée d'attente avant de gagner un booster supplémentaire. */
export const BOOSTER_COOLDOWN_MS = 10 * 60 * 1000;

/** Nombre maximum de boosters cumulables. */
export const BOOSTER_STOCK_MAX = 10;

/** Poids cumulés (somme des raretés = 1000, soit un pourcentage ×10). */
export const TOTAL_WEIGHT = Object.values(RARITY).reduce((sum, r) => sum + r.weight, 0);

/**
 * Pourcentage lisible en français, sans décimale inutile :
 * `62 %`, `11,4 %`, `0,15 %`, `0,025 %`.
 */
export function formatPercent(share: number): string {
  const percent = share * 100;
  const text =
    percent >= 1
      ? percent.toFixed(1)
      : percent >= 0.1
        ? percent.toFixed(2)
        : percent.toFixed(3);
  return `${text.replace(/\.?0+$/, "").replace(".", ",")} %`;
}

/**
 * Le tirage ne vit plus ici : il est entièrement fait en base par
 * `public.open_pack()` / `public.buy_booster()` (migration 014), avec un aléa
 * cryptographique et des replis de pool. Aucun tirage ne doit exister côté
 * client : le navigateur n'envoie qu'un identifiant de pack.
 */

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

/**
 * Horloge de référence des compteurs (stock de boosters).
 *
 * Lue une fois par rendu serveur : c'est le seul instant cohérent avec les
 * valeurs renvoyées par la base, et le client repart de cette valeur avant de
 * la faire avancer lui-même. Isolée ici pour que les composants restent purs
 * au sens des règles React (aucun `Date.now()` dans leur rendu).
 */
export function serverNowMs(): number {
  return Date.now();
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
