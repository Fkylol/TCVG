import type { GenreSlug } from "./card-genres";

/**
 * Les 10 packs, tous ouvrables en permanence. Seul le seuil de personnages
 * actifs (`MIN_POOL_SIZE`, valeur qui fait foi en base) retient un pack qui
 * n'aurait pas encore assez de cartes.
 *
 * Configuration purement déclarative : palettes ton sur ton, emblème et
 * texture. Les prix et les taux de rareté qui font foi vivent en base
 * (`booster_types`, `game_config`) pour être modifiables sans redéploiement ;
 * `pricePixels` ici n'est qu'un repli d'affichage.
 *
 * `genre: null` = pack Mix, pool = toutes les cartes actives.
 */
export type PackColors = {
  /** Haut du dégradé (162°). */
  t1: string;
  /** Bas du dégradé, aussi source de l'ombre portée. */
  t2: string;
  /** Encre du texte principal. */
  ink: string;
  /** Couleur de l'emblème (médaillon). */
  gl: string;
  /** Trait clair des textures. */
  tx: string;
  /** Second trait, pour les textures qui ont besoin d'un contraste doux. */
  tx2?: string;
  /** Ombre portée du pack : `t2` à 50 % d'alpha. */
  glow: string;
};

/** Clés des emblèmes et textures originales de `components/pack-art.tsx`. */
export type PackArtKey =
  | "mix"
  | "action-aventure"
  | "plateforme"
  | "rpg"
  | "mmo"
  | "fps"
  | "inde"
  | "combat"
  | "horreur"
  | "strategie";

export type Pack = {
  id: string;
  name: string;
  subtitle: string;
  genre: GenreSlug | null;
  pricePixels: number;
  /** Taille de titre souhaitée, en `cqw`. Le hook peut la réduire. */
  titleSize: number;
  /** Inclinaison au repos, en degrés (le survol redresse le pack). */
  tilt: { bx: number; by: number };
  colors: PackColors;
  /** Clé de l'emblème SVG du médaillon. */
  emblem: PackArtKey;
  /** Clé de la texture SVG de fond. */
  texture: PackArtKey;
};

/**
 * Inclinaison au repos, commune à tous les posters.
 *
 * Les packs penchaient autrefois en alternance, chaque tuile avec son angle :
 * sur une grille, l'œil ne savait plus où était l'horizontale. Tous penchent
 * maintenant du même côté ; le survol et la sélection les redressent.
 */
export const PACK_TILT = { bx: -2, by: 12 } as const;

export const PACKS: Pack[] = [
  {
    id: "mix",
    name: "Mix",
    subtitle: "Tous les genres",
    genre: null,
    pricePixels: 20,
    titleSize: 15,
    tilt: PACK_TILT,
    colors: {
      t1: "#d9ccff", t2: "#ffb8d8", ink: "#2b2150", gl: "#ffe08a",
      tx: "rgba(255,255,255,0.4)", glow: "#ffb8d880",
    },
    emblem: "mix",
    texture: "mix",
  },
  {
    id: "action-aventure",
    name: "Action-aventure",
    subtitle: "Exploration",
    genre: "action-aventure",
    pricePixels: 30,
    titleSize: 12.5,
    tilt: PACK_TILT,
    colors: {
      t1: "#86d9b0", t2: "#1f6e55", ink: "#06251c", gl: "#7ff0bc",
      tx: "rgba(255,255,255,0.28)", glow: "#1f6e5580",
    },
    emblem: "action-aventure",
    texture: "action-aventure",
  },
  {
    id: "plateforme",
    name: "Plateforme",
    subtitle: "Sauts et pixels",
    genre: "plateforme",
    pricePixels: 30,
    titleSize: 11.5,
    tilt: PACK_TILT,
    colors: {
      t1: "#ffe27a", t2: "#ff6f61", ink: "#4a1608", gl: "#ffd95a",
      tx: "rgba(255,255,255,0.42)", tx2: "rgba(120,28,18,0.3)", glow: "#ff6f6180",
    },
    emblem: "plateforme",
    texture: "plateforme",
  },
  {
    id: "rpg",
    name: "RPG",
    subtitle: "Mondes et destins",
    genre: "rpg",
    pricePixels: 30,
    titleSize: 15,
    tilt: PACK_TILT,
    colors: {
      t1: "#a99dff", t2: "#3a2d9c", ink: "#f1eeff", gl: "#bfb6ff",
      tx: "rgba(255,255,255,0.25)", glow: "#3a2d9c80",
    },
    emblem: "rpg",
    texture: "rpg",
  },
  {
    id: "mmo",
    name: "MMO",
    subtitle: "Mondes en ligne",
    genre: "mmo",
    pricePixels: 30,
    titleSize: 15,
    tilt: PACK_TILT,
    colors: {
      t1: "#8fefee", t2: "#0e6f86", ink: "#032a31", gl: "#7cf5ea",
      tx: "rgba(255,255,255,0.4)", glow: "#0e6f8680",
    },
    emblem: "mmo",
    texture: "mmo",
  },
  {
    id: "fps",
    name: "FPS",
    subtitle: "Tir subjectif",
    genre: "fps",
    pricePixels: 30,
    titleSize: 15,
    tilt: PACK_TILT,
    colors: {
      t1: "#97ad9d", t2: "#2d4236", ink: "#eaf3ec", gl: "#b8d6c1",
      tx: "rgba(255,255,255,0.2)", glow: "#2d423680",
    },
    emblem: "fps",
    texture: "fps",
  },
  {
    id: "inde",
    name: "Indé",
    subtitle: "Pépites créatives",
    genre: "inde",
    pricePixels: 30,
    titleSize: 15,
    tilt: PACK_TILT,
    colors: {
      t1: "#ffcde2", t2: "#f27fad", ink: "#4a1230", gl: "#ffa3c8",
      tx: "rgba(255,255,255,0.55)", glow: "#f27fad80",
    },
    emblem: "inde",
    texture: "inde",
  },
  {
    id: "combat",
    name: "Combat",
    subtitle: "Duels et arènes",
    genre: "combat",
    pricePixels: 30,
    titleSize: 14,
    tilt: PACK_TILT,
    colors: {
      t1: "#ff9fa6", t2: "#9c1d34", ink: "#fff0ee", gl: "#ff8c98",
      tx: "rgba(255,255,255,0.2)", glow: "#9c1d3480",
    },
    emblem: "combat",
    texture: "combat",
  },
  {
    id: "horreur",
    name: "Horreur",
    subtitle: "Frissons garantis",
    genre: "horreur",
    pricePixels: 30,
    titleSize: 13.5,
    tilt: PACK_TILT,
    colors: {
      t1: "#5f7f6e", t2: "#0f1915", ink: "#e6f2e3", gl: "#a8ea9c",
      tx: "rgba(255,255,255,0.14)", glow: "#0f191580",
    },
    emblem: "horreur",
    texture: "horreur",
  },
  {
    id: "strategie",
    name: "Stratégie",
    subtitle: "Tactique, empires",
    genre: "strategie",
    pricePixels: 30,
    titleSize: 12,
    tilt: PACK_TILT,
    colors: {
      t1: "#e8c286", t2: "#7a4a1d", ink: "#fff3e0", gl: "#f6cb82",
      tx: "rgba(255,255,255,0.22)", glow: "#7a4a1d80",
    },
    emblem: "strategie",
    texture: "strategie",
  },
];

/**
 * Seuil de personnages actifs en dessous duquel un pack est « Bientôt
 * disponible ». Valeur par défaut ; la base fait foi via
 * `game_config.pack_min_pool_size` (migration 015).
 */
export const MIN_POOL_SIZE = 15;

/**
 * Garantie « Rare ou mieux » : désactivée par défaut. Quand elle sera activée,
 * le tirage serveur devra l'appliquer réellement (compteur par joueur et par
 * pack) — l'interface n'affiche la tuile que si ce drapeau est vrai.
 */
export const GUARANTEE_ENABLED = false;

export const PACKS_BY_ID: Record<string, Pack> = Object.fromEntries(
  PACKS.map((pack) => [pack.id, pack]),
);

export function getPack(id: string): Pack | undefined {
  return PACKS_BY_ID[id];
}

/** Pack dont le pool correspond à un genre (ou le Mix pour `null`). */
export function getPackByGenre(genre: GenreSlug | null): Pack | undefined {
  return PACKS.find((pack) => pack.genre === genre);
}
