import type { GenreSlug } from "@/lib/card-genres";
import { GENRES } from "@/lib/card-genres";
import { MIN_POOL_SIZE, PACKS, type PackArtKey } from "@/lib/packs";

/**
 * Tous les cadres d'avatar du jeu, leurs seuils et leur allure.
 *
 * C'est le seul fichier à modifier pour ajouter un cadre ou changer un seuil :
 * l'évaluation, la base, l'interface, les notifications et l'administration
 * lisent cette configuration. Les seuils sont relatifs (pourcentage de l'album
 * actif, part d'une rareté) ou exprimés en jours / nombre d'actions ; aucun
 * nombre absolu de cartes du catalogue n'est écrit ici.
 *
 * Les cadres de genre sont générés à partir de `PACKS` : leurs couleurs et leur
 * motif suivent le booster correspondant.
 */

export type FrameLane = "album" | "rarete" | "genre" | "activite" | "social" | "special";

export type FramePrestige = 1 | 2 | 3 | 4 | 5;

export type FrameCondition =
  | { type: "default" }
  | { type: "album"; percent: number }
  | { type: "rarity"; rarity: "UR" | "L"; percent: number }
  | { type: "genre"; genre: string }
  | { type: "streak"; days: number }
  | { type: "openings"; count: number }
  | { type: "referrals"; count: number }
  | { type: "sales"; count: number }
  | { type: "pioneer"; before: string }
  | { type: "season"; albumPercent: number }
  | { type: "franchise"; minCards: number };

export type FrameDefinition = {
  id: string;
  name: string;
  /** Voie de progression, pour les onglets de la section Cadre. */
  lane: FrameLane;
  /** 1 = commun, 5 = le plus rare. Pilote l'épaisseur, la lueur et le double anneau. */
  prestige: FramePrestige;
  /** Masqué (« ??? ») tant que le joueur ne l'a pas débloqué. */
  secret: boolean;
  /** Désactivé dans la configuration : visible comme « bientôt / indisponible ». */
  active: boolean;
  condition: FrameCondition;
  /** Phrase courte affichée sur la carte, indépendante du calcul. */
  description: string;
  /** Indication volontairement vague pour un cadre secret verrouillé. */
  hiddenHint?: string;
  colors: readonly string[];
  gradient: "linear" | "conic";
  /** Animation douce (rotation du dégradé) ; désactivée avec prefers-reduced-motion. */
  animated?: boolean;
  /** Emblème discret du pack, pour les cadres de genre. */
  motif?: PackArtKey;
  /** Bornes facultatives ; un cadre de saison les utilise. */
  availableFrom?: string;
  availableUntil?: string;
  /** Surcharge individuelle du maintien de 24 h (prestige 4 et 5). */
  maintenanceHours?: number;
};

export type FrameStats = {
  totalActive: number;
  ownedDistinct: number;
  rarities: Record<"UR" | "L", { total: number; owned: number }>;
  genres: Record<string, { total: number; owned: number }>;
  franchises: { slug: string; name: string; total: number; owned: number }[];
  sales: number;
  referralsPaid: number;
  boostersOpened: number;
  streakDays: number;
  createdAt: string;
  lastSeenAt: string | null;
};

export type UnlockedFrame = { frameId: string; unlockedAt: string };
export type PendingFrame = { frameId: string; firstMetAt: string };

export type FrameAvailability = "available" | "soon" | "expired" | "disabled";

export type FrameProgress = {
  frameId: string;
  current: number;
  target: number;
  /** Part de l'objectif atteinte, bornée à 100. */
  percent: number;
  reached: boolean;
  available: boolean;
  soon: boolean;
  expired: boolean;
  hidden: boolean;
  condition: string;
  detail: string;
  remaining: string;
};

export type FrameEvaluationInput = {
  stats: FrameStats;
  unlocked: UnlockedFrame[];
  pending: PendingFrame[];
  now?: Date;
  disabled?: string[];
  maintenanceHours?: number;
};

export type FrameEvaluation = {
  progress: Record<string, FrameProgress>;
  /** Cadres à insérer maintenant (contrainte d'unicité côté base). */
  unlocks: FrameDefinition[];
  newUnlockedIds: string[];
  pendingAdd: string[];
  pendingRemove: string[];
};

/**
 * Réglages transverses. Le maintien de 24 h est désactivé par défaut : les
 * conditions débloquent immédiatement. L'option « grandfathering » sert à
 * conserver les anciens cadres des comptes existants lors d'une reprise.
 */
export const FRAME_FEATURES = {
  /** 0 = déblocage immédiat. 24 = les prestiges 4 et 5 doivent tenir 24 h. */
  maintenanceHoursForPrestige45: 0,
  /** Plafond de cadres animés simultanément dans une longue liste. */
  maxAnimatedAtOnce: 4,
  /** Durée d'un tour du dégradé animé. */
  animationSeconds: 18,
  /** Reprise des anciens déblocages (désactivée : le site repart des seuils). */
  grandfatherLegacyFrames: false,
} as const;

/** Anciens identifiants conservés seulement si le grandfathering est activé. */
export const LEGACY_FRAME_MAP: Record<string, string> = {
  steel: "steel",
  jade: "jade",
  amethyst: "amethyst",
  gold: "gold",
};

export const FRAME_LANES: { id: FrameLane; label: string; hint: string }[] = [
  { id: "album", label: "Album", hint: "La part de l'album actif que tu possèdes." },
  { id: "rarete", label: "Rareté", hint: "Les Légendaires et Mythiques, comptées à part." },
  { id: "genre", label: "Genre", hint: "Un cadre par booster, aux couleurs du pack." },
  { id: "activite", label: "Activité", hint: "La régularité et le temps passé à ouvrir." },
  { id: "social", label: "Social", hint: "Le parrainage et les ventes au marché." },
  { id: "special", label: "Spéciaux", hint: "Lancement, saisons et secrets." },
];

const ALBUM_FRAMES: FrameDefinition[] = [
  {
    id: "steel",
    name: "Acier",
    lane: "album",
    prestige: 1,
    secret: false,
    active: true,
    condition: { type: "default" },
    description: "Le cadre de départ, sobre et toujours disponible.",
    colors: ["#f8fafc", "#94a3b8", "#cbd5e1"],
    gradient: "linear",
  },
  {
    id: "jade",
    name: "Jade",
    lane: "album",
    prestige: 2,
    secret: false,
    active: true,
    condition: { type: "album", percent: 15 },
    description: "Tes premiers pas dans l'album : la pierre verte des collectionneurs.",
    colors: ["#7ef0c0", "#0f766e", "#34d399"],
    gradient: "conic",
  },
  {
    id: "amethyst",
    name: "Améthyste",
    lane: "album",
    prestige: 2,
    secret: false,
    active: true,
    condition: { type: "album", percent: 35 },
    description: "Un tiers de l'album : le violet des grandes étagères.",
    colors: ["#c4b5fd", "#6d28d9", "#a78bfa"],
    gradient: "conic",
  },
  {
    id: "gold",
    name: "Or",
    lane: "album",
    prestige: 3,
    secret: false,
    active: true,
    condition: { type: "album", percent: 60 },
    description: "Plus de la moitié du catalogue : l'or se mérite.",
    colors: ["#fde68a", "#b45309", "#f59e0b"],
    gradient: "conic",
  },
  {
    id: "platinum",
    name: "Platine",
    lane: "album",
    prestige: 4,
    secret: false,
    active: true,
    condition: { type: "album", percent: 80 },
    description: "Quatre cinquièmes de l'album : un anneau presque complet.",
    colors: ["#e2e8f0", "#64748b", "#a5f3fc", "#f8fafc"],
    gradient: "conic",
  },
  {
    id: "prism",
    name: "Prisme",
    lane: "album",
    prestige: 5,
    secret: false,
    active: true,
    condition: { type: "album", percent: 90 },
    description: "Le prisme tourne pour ceux qui n'ont laissé que quelques cases vides.",
    colors: ["#f0abfc", "#67e8f9", "#fde68a", "#86efac", "#c4b5fd"],
    gradient: "conic",
    animated: true,
  },
  {
    id: "completionist",
    name: "Complétiste",
    lane: "album",
    prestige: 5,
    secret: false,
    active: true,
    condition: { type: "album", percent: 100 },
    description: "Chaque personnage actif possédé. Le cadre le plus rare de l'album.",
    colors: ["#fff7ed", "#fbbf24", "#f472b6", "#818cf8", "#fde68a"],
    gradient: "conic",
    animated: true,
  },
];

const RARITY_FRAMES: FrameDefinition[] = [
  {
    id: "legends-hunter",
    name: "Chasseur de légendes",
    lane: "rarete",
    prestige: 3,
    secret: false,
    active: true,
    condition: { type: "rarity", rarity: "UR", percent: 50 },
    description: "La moitié des Légendaires actives : un chasseur, pas un opportuniste.",
    colors: ["#fca5a5", "#7f1d1d", "#fbbf24"],
    gradient: "linear",
  },
  {
    id: "pantheon",
    name: "Panthéon",
    lane: "rarete",
    prestige: 4,
    secret: false,
    active: true,
    condition: { type: "rarity", rarity: "L", percent: 50 },
    description: "La moitié des Mythiques : les dieux du catalogue te reconnaissent.",
    colors: ["#f5d0fe", "#701a75", "#f0abfc", "#fde68a"],
    gradient: "conic",
  },
  {
    id: "chosen",
    name: "Élu",
    lane: "rarete",
    prestige: 5,
    secret: false,
    active: true,
    condition: { type: "rarity", rarity: "L", percent: 100 },
    description: "Toutes les Mythiques actives, sans exception. Très peu l'atteindront.",
    colors: ["#fef3c7", "#a21caf", "#f9a8d4", "#fde68a"],
    gradient: "conic",
  },
];

const EXTRA_GENRES: { slug: string; name: string; colors: [string, string] }[] = [
  { slug: "course", name: "Course", colors: ["#ffd166", "#b45309"] },
  { slug: "sport", name: "Sport", colors: ["#b8f2e6", "#0f766e"] },
];

function genreFrame(
  slug: string,
  name: string,
  colors: readonly string[],
  motif?: PackArtKey,
): FrameDefinition {
  return {
    id: `genre-${slug}`,
    name: `Maîtrise ${name}`,
    lane: "genre",
    prestige: 2,
    secret: false,
    active: true,
    condition: { type: "genre", genre: slug },
    description: `Posséder tous les personnages actifs du genre ${name}, aux couleurs de son booster.`,
    colors,
    gradient: "linear",
    motif,
  };
}

const GENRE_FRAMES: FrameDefinition[] = [
  ...GENRES.map((genre) => {
    const pack = PACKS.find((item) => item.genre === genre.slug);
    return genreFrame(
      genre.slug,
      genre.name,
      pack ? [pack.colors.t1, pack.colors.t2] : ["#cbd5e1", "#334155"],
      pack?.emblem,
    );
  }),
  ...EXTRA_GENRES.map((genre) => genreFrame(genre.slug, genre.name, genre.colors)),
];

const ACTIVITY_FRAMES: FrameDefinition[] = [
  {
    id: "regular",
    name: "Assidu",
    lane: "activite",
    prestige: 3,
    secret: false,
    active: true,
    condition: { type: "streak", days: 30 },
    description: "Trente jours consécutifs sans manquer un rendez-vous.",
    colors: ["#bbf7d0", "#166534", "#4ade80"],
    gradient: "linear",
  },
  {
    id: "grand-opener",
    name: "Grand ouvreur",
    lane: "activite",
    prestige: 4,
    secret: false,
    active: true,
    condition: { type: "openings", count: 2000 },
    description: "Deux mille boosters ouverts : un rythme de machine.",
    colors: ["#fecaca", "#991b1b", "#fb923c", "#fde68a"],
    gradient: "conic",
  },
];

const SOCIAL_FRAMES: FrameDefinition[] = [
  {
    id: "ambassador",
    name: "Ambassadeur",
    lane: "social",
    prestige: 3,
    secret: false,
    active: true,
    condition: { type: "referrals", count: 5 },
    description: "Cinq filleuls arrivés au bout de leur parrainage.",
    colors: ["#bfdbfe", "#1d4ed8", "#60a5fa"],
    gradient: "linear",
  },
  {
    id: "merchant",
    name: "Marchand",
    lane: "social",
    prestige: 3,
    secret: false,
    active: true,
    condition: { type: "sales", count: 50 },
    description: "Cinquante ventes conclues au marché : ta réputation te précède.",
    colors: ["#fed7aa", "#92400e", "#f59e0b"],
    gradient: "linear",
  },
];

const SPECIAL_FRAMES: FrameDefinition[] = [
  {
    id: "pioneer",
    name: "Pionnier",
    lane: "special",
    prestige: 4,
    secret: false,
    active: true,
    condition: { type: "pioneer", before: "2026-11-01T00:00:00Z" },
    description: "Réservé aux comptes créés avant le lancement officiel.",
    colors: ["#fcd34d", "#78350f", "#fbbf24", "#fef3c7"],
    gradient: "linear",
  },
  {
    id: "season-example",
    name: "Estival",
    lane: "special",
    prestige: 4,
    secret: false,
    active: false,
    condition: { type: "season", albumPercent: 25 },
    description: "Exemple de cadre de saison, désactivé : il ne s'obtient que pendant sa fenêtre.",
    colors: ["#a7f3d0", "#f9a8d4", "#fde68a"],
    gradient: "conic",
    animated: true,
    availableFrom: "2026-06-01T00:00:00Z",
    availableUntil: "2026-09-01T00:00:00Z",
  },
  {
    id: "absolute-fan",
    name: "Fan absolu",
    lane: "special",
    prestige: 5,
    secret: true,
    active: true,
    condition: { type: "franchise", minCards: 8 },
    description: "Un secret pour ceux qui complètent une franchise entière.",
    hiddenHint: "Une franchise entière, et elle seule, garde la clé.",
    colors: ["#fbcfe8", "#831843", "#f9a8d4", "#fde68a"],
    gradient: "conic",
    animated: true,
  },
];

/** Ordre d'affichage : album, rareté, genre, activité, social, spéciaux. */
export const FRAMES: FrameDefinition[] = [
  ...ALBUM_FRAMES,
  ...RARITY_FRAMES,
  ...GENRE_FRAMES,
  ...ACTIVITY_FRAMES,
  ...SOCIAL_FRAMES,
  ...SPECIAL_FRAMES,
];

export const FRAME_BY_ID: Record<string, FrameDefinition> = Object.fromEntries(
  FRAMES.map((frame) => [frame.id, frame]),
);

export const FRAME_TOTAL = FRAMES.length;

export function getFrame(id: string | null | undefined): FrameDefinition | undefined {
  return id ? FRAME_BY_ID[id] : undefined;
}

export function frameIndex(id: string): number {
  return FRAMES.findIndex((frame) => frame.id === id);
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString("fr-FR")} ${count > 1 ? pluralForm : singular}`;
}

/** Percent of a total, rounded up: the threshold is reached, never rounded down. */
export function percentTarget(total: number, percent: number): number {
  if (total <= 0) return 0;
  return Math.ceil((total * percent) / 100);
}

export function frameAvailability(
  frame: FrameDefinition,
  now: Date,
  disabled: string[] = [],
): FrameAvailability {
  if (!frame.active || disabled.includes(frame.id)) return "disabled";

  if (frame.availableFrom && now.getTime() < new Date(frame.availableFrom).getTime()) {
    return "soon";
  }
  if (frame.availableUntil && now.getTime() >= new Date(frame.availableUntil).getTime()) {
    return "expired";
  }
  return "available";
}

function bestFranchise(stats: FrameStats, minCards: number) {
  return [...stats.franchises]
    .filter((franchise) => franchise.total >= minCards)
    .sort((a, b) => {
      const ratioA = a.total > 0 ? a.owned / a.total : 0;
      const ratioB = b.total > 0 ? b.owned / b.total : 0;
      if (ratioB !== ratioA) return ratioB - ratioA;
      if (b.owned !== a.owned) return b.owned - a.owned;
      return a.name.localeCompare(b.name, "fr");
    })[0];
}

/**
 * Calcule la progression d'un cadre. Le pourcentage de l'album et des raretés
 * porte toujours sur les personnages ACTIFS du moment : un changement du
 * catalogue déplace les seuils sans migration.
 */
export function frameProgress(
  frame: FrameDefinition,
  stats: FrameStats,
  options: { now?: Date; unlocked?: boolean; disabled?: string[] } = {},
): FrameProgress {
  const now = options.now ?? new Date();
  const unlocked = options.unlocked ?? false;
  const availability = frameAvailability(frame, now, options.disabled);
  const hidden = frame.secret && !unlocked;
  let available = availability === "available";
  let soon = availability === "soon";
  const expired = availability === "expired";

  let current = 0;
  let target = 1;
  let condition = "Toujours disponible";
  let detail = "Débloqué d'office";
  let unit = "objectif";

  switch (frame.condition.type) {
    case "default": {
      current = 1;
      target = 1;
      condition = "Le cadre de départ";
      detail = "Toujours disponible";
      break;
    }
    case "album": {
      current = stats.ownedDistinct;
      target = percentTarget(stats.totalActive, frame.condition.percent);
      condition = `Posséder ${frame.condition.percent} % des personnages`;
      detail =
        stats.totalActive > 0
          ? `${current} / ${stats.totalActive} personnages · ${Math.floor((current / stats.totalActive) * 100)} %`
          : "0 / 0 personnage actif";
      unit = "personnage";
      break;
    }
    case "rarity": {
      const rarity = stats.rarities[frame.condition.rarity];
      current = rarity.owned;
      target = percentTarget(rarity.total, frame.condition.percent);
      condition = `Posséder ${frame.condition.percent} % des ${
        frame.condition.rarity === "UR" ? "Légendaires actives" : "Mythiques actives"
      }`;
      detail =
        rarity.total > 0
          ? `${current} / ${rarity.total} ${frame.condition.rarity === "UR" ? "légendaires" : "mythiques"} · ${Math.floor(
              (current / rarity.total) * 100,
            )} %`
          : `Aucune ${frame.condition.rarity === "UR" ? "Légendaire" : "Mythique"} active`;
      unit = frame.condition.rarity === "UR" ? "légendaire" : "mythique";
      break;
    }
    case "genre": {
      const genre = stats.genres[frame.condition.genre] ?? { total: 0, owned: 0 };
      current = genre.owned;
      target = genre.total;
      condition = `Posséder 100 % des personnages de ce genre`;
      detail =
        genre.total > 0
          ? `${current} / ${genre.total} personnages · ${Math.floor((current / genre.total) * 100)} %`
          : "Aucun personnage actif dans ce genre";
      // Un genre trop petit n'est pas encore un objectif : il reste « bientôt ».
      if (genre.total < MIN_POOL_SIZE) {
        soon = true;
        available = false;
      }
      unit = "personnage";
      break;
    }
    case "streak": {
      current = stats.streakDays;
      target = frame.condition.days;
      condition = `Se connecter ${frame.condition.days} jours consécutifs`;
      detail = `${current} / ${target} jours`;
      unit = "jour";
      break;
    }
    case "openings": {
      current = stats.boostersOpened;
      target = frame.condition.count;
      condition = `Ouvrir ${frame.condition.count.toLocaleString("fr-FR")} boosters`;
      detail = `${current.toLocaleString("fr-FR")} / ${target.toLocaleString("fr-FR")} boosters`;
      unit = "booster";
      break;
    }
    case "referrals": {
      current = stats.referralsPaid;
      target = frame.condition.count;
      condition = `Compter ${frame.condition.count} parrainages payés`;
      detail = `${current} / ${target} parrainages payés`;
      unit = "parrainage";
      break;
    }
    case "sales": {
      current = stats.sales;
      target = frame.condition.count;
      condition = `Vendre ${frame.condition.count} cartes sur le marché`;
      detail = `${current} / ${target} ventes`;
      unit = "vente";
      break;
    }
    case "pioneer": {
      const cutoff = new Date(frame.condition.before).getTime();
      const createdAt = new Date(stats.createdAt).getTime();
      const eligible = Number.isFinite(createdAt) && createdAt < cutoff;
      current = eligible ? 1 : 0;
      target = 1;
      // Passé la date, un compte créé plus tard ne pourra jamais l'obtenir.
      if (!eligible) available = false;
      condition = `Compte créé avant le ${formatDate(frame.condition.before)}`;
      detail = `Compte créé le ${formatDate(stats.createdAt)}`;
      unit = "compte";
      break;
    }
    case "season": {
      current = stats.ownedDistinct;
      target = percentTarget(stats.totalActive, frame.condition.albumPercent);
      condition = `Posséder ${frame.condition.albumPercent} % de l'album pendant la saison`;
      detail = `${current} / ${stats.totalActive} personnages · ${Math.floor(
        stats.totalActive > 0 ? (current / stats.totalActive) * 100 : 0,
      )} %`;
      unit = "personnage";
      break;
    }
    case "franchise": {
      const franchise = bestFranchise(stats, frame.condition.minCards);
      current = franchise?.owned ?? 0;
      target = franchise?.total ?? frame.condition.minCards;
      condition = `Posséder 100 % d'une franchise d'au moins ${plural(
        frame.condition.minCards,
        "personnage",
      )}`;
      detail = franchise
        ? `${current} / ${target} · ${franchise.name}`
        : `Aucune franchise de ${plural(frame.condition.minCards, "personnage")}`;
      unit = "personnage";
      break;
    }
  }

  const baseReached =
    frame.condition.type === "default"
      ? true
      : frame.condition.type === "genre"
        ? target >= MIN_POOL_SIZE && current >= target
        : frame.condition.type === "season"
          ? target > 0 && current >= target
          : frame.condition.type === "pioneer"
            ? current >= target
            : target > 0 && current >= target;
  const reached = available && baseReached;

  const rawPercent =
    target > 0 ? Math.min(100, Math.max(0, Math.floor((current / target) * 100))) : 0;
  const percent = reached ? 100 : rawPercent;
  const missing = Math.max(0, target - current);

  let remaining = "";
  if (!reached && !hidden && available) {
    if (frame.condition.type === "default") remaining = "";
    else if (frame.condition.type === "pioneer") {
      remaining = "La date de lancement est passée";
    } else {
      remaining = `Plus que ${plural(missing, unit, unit.endsWith("al") ? `${unit}aux` : `${unit}s`)}`;
    }
  }

  if (hidden) {
    condition = "???";
    detail = "Condition secrète";
    remaining = "";
  }

  return {
    frameId: frame.id,
    current,
    target,
    percent,
    reached,
    available,
    soon,
    expired,
    hidden,
    condition,
    detail,
    remaining,
  };
}

/**
 * Évalue tous les cadres pour un joueur. Fonction pure : la base ne sert qu'à
 * fournir les statistiques et à appliquer le résultat avec une contrainte
 * d'unicité. Aucune donnée n'est écrite ici.
 */
export function evaluateFrameSet({
  stats,
  unlocked,
  pending,
  now = new Date(),
  disabled = [],
  maintenanceHours = FRAME_FEATURES.maintenanceHoursForPrestige45,
}: FrameEvaluationInput): FrameEvaluation {
  const unlockedIds = new Set(unlocked.map((frame) => frame.frameId));
  const pendingByFrame = new Map(pending.map((entry) => [entry.frameId, entry]));
  const progress: Record<string, FrameProgress> = {};
  const unlocks: FrameDefinition[] = [];
  const pendingAdd: string[] = [];
  const pendingRemove: string[] = [];

  for (const frame of FRAMES) {
    const unlockedFrame = unlockedIds.has(frame.id);
    const state = frameProgress(frame, stats, {
      now,
      unlocked: unlockedFrame,
      disabled,
    });
    progress[frame.id] = state;

    if (unlockedFrame) {
      if (pendingByFrame.has(frame.id)) pendingRemove.push(frame.id);
      continue;
    }

    if (!state.available || !state.reached) {
      if (pendingByFrame.has(frame.id)) pendingRemove.push(frame.id);
      continue;
    }

    const hold = frame.maintenanceHours ?? maintenanceHours;
    const mustWait = frame.prestige >= 4 && hold > 0;

    if (mustWait) {
      const since = pendingByFrame.get(frame.id);
      if (!since) {
        pendingAdd.push(frame.id);
        continue;
      }
      const elapsed = now.getTime() - new Date(since.firstMetAt).getTime();
      if (elapsed < hold * 3_600_000) continue;
    }

    unlocks.push(frame);
  }

  return {
    progress,
    unlocks,
    newUnlockedIds: unlocks.map((frame) => frame.id),
    pendingAdd,
    pendingRemove,
  };
}

/** Cadre au prestige le plus élevé parmi ceux réellement débloqués. */
export function bestUnlockedFrame(
  unlockedIds: Iterable<string>,
  disabled: string[] = [],
): string {
  const ids = new Set(unlockedIds);
  let best: FrameDefinition | undefined;
  for (const frame of FRAMES) {
    if (!frame.active || disabled.includes(frame.id) || !ids.has(frame.id)) continue;
    if (!best || frame.prestige > best.prestige) best = frame;
  }
  return best?.id ?? "steel";
}

/**
 * Sélection effective : le cadre choisi s'il est toujours débloqué et actif,
 * sinon le meilleur cadre disponible. Jamais d'erreur, jamais de cadre vide.
 */
export function resolveSelectedFrame(
  selected: string | null | undefined,
  unlockedIds: Iterable<string>,
  disabled: string[] = [],
): string {
  const ids = new Set(unlockedIds);
  if (selected) {
    const frame = getFrame(selected);
    if (frame && ids.has(frame.id) && frame.active && !disabled.includes(frame.id)) {
      return frame.id;
    }
  }
  return bestUnlockedFrame(ids, disabled);
}

/** Cadre verrouillé le plus proche, hors secrets et cadres indisponibles. */
export function nextFrameToUnlock(
  progress: Record<string, FrameProgress>,
  unlockedIds: Iterable<string>,
): { frame: FrameDefinition; progress: FrameProgress } | null {
  const ids = new Set(unlockedIds);
  let best: { frame: FrameDefinition; progress: FrameProgress } | null = null;

  for (const frame of FRAMES) {
    const state = progress[frame.id];
    if (!state || ids.has(frame.id) || state.hidden) continue;
    if (!state.available || state.reached || state.soon || state.expired) continue;
    if (!best || state.percent > best.progress.percent) best = { frame, progress: state };
  }

  return best;
}

/**
 * Un cadre animé ne l'est que s'il est visible, si le joueur n'a pas demandé
 * moins de mouvement, et si le budget de cadres animés n'est pas épuisé.
 */
export function shouldAnimateFrame({
  animated,
  reducedMotion,
  visible,
  activeAnimated,
  budget = FRAME_FEATURES.maxAnimatedAtOnce,
}: {
  animated: boolean;
  reducedMotion: boolean;
  visible: boolean;
  activeAnimated: number;
  budget?: number;
}): boolean {
  return animated && !reducedMotion && visible && activeAnimated < budget;
}

/** Total de cadres réellement proposés (hors désactivés). */
export function activeFrameCount(disabled: string[] = []): number {
  return FRAMES.filter((frame) => frame.active && !disabled.includes(frame.id)).length;
}

/** Nom affichable : masque les cadres secrets non débloqués. */
export function frameDisplayName(frame: FrameDefinition, unlocked: boolean): string {
  return frame.secret && !unlocked ? "???" : frame.name;
}

export type GenreSlugLike = GenreSlug | string;
