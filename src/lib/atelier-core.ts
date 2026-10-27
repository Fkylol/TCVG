/**
 * Règles pures de l'atelier d'ajout de cartes (`/atelier/cartes`).
 *
 * Aucune I/O, aucun import Node : ces fonctions servent au formulaire
 * (aperçu, identifiant proposé), à l'action serveur qui enregistre, et aux
 * tests.
 */

import type { GenreSlug } from "./card-genres";
import { MAX_ZOOM, MIN_ZOOM } from "./framing";
import type { CardLore } from "./card-lore";
import type { Card, Rarity } from "./cards";
import type { Portrait } from "./portraits";

/** Visuel proposé par la recherche, avec de quoi l'afficher et l'attribuer. */
export type PortraitCandidate = Portrait & {
  /** Titre de la page wiki d'où vient le visuel, pour l'extrait et l'attribution. */
  pageTitle: string;
  /** Hôte du wiki (fandom ou wikipedia). */
  wiki: string;
  /** Le nom du personnage apparaît dans le nom du fichier. */
  named: boolean;
};

/** Brouillon complet d'une carte, avant enregistrement. */
export type CardDraft = {
  id: string;
  name: string;
  universe: string;
  emoji: string;
  rarity: Rarity;
  genres: GenreSlug[];
  lore: CardLore;
  portrait: Portrait | null;
};

export type ValidationContext = {
  /** Slugs d'univers connus. */
  universes: string[];
  /** Cartes déjà au catalogue (base + atelier). */
  cards: Card[];
  /** Genres valides. */
  genres: string[];
  /**
   * Carte en cours de modification : ses propres collisions (identifiant, nom
   * dans la franchise) ne sont pas des doublons, c'est elle qu'on réécrit.
   */
  editingId?: string;
};

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Identifiant lisible : minuscules, sans accents, mots séparés par un tiret.
 * « Le Duc de Paille » → « le-duc-de-paille » (comme le catalogue existant).
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Identifiant libre : suffixe `-2`, `-3`… si le slug est déjà pris. */
export function uniqueCardId(base: string, taken: string[]): string {
  const slug = slugify(base) || "carte";
  const used = new Set(taken.map((id) => id.trim().toLowerCase()));
  if (!used.has(slug)) return slug;
  let suffix = 2;
  while (used.has(`${slug}-${suffix}`)) suffix += 1;
  return `${slug}-${suffix}`;
}

/**
 * Rareté d'après le rang de popularité.
 *
 * `fraction` va de 0 (personnage le plus populaire) à 1 (le moins). Les bornes
 * cumulent les parts cibles du catalogue : 2 % Mythique, puis 5 % Légendaire,
 * 11 % Épique, 20 % Rare, 26 % Peu commune, le reste en Commune. C'est une
 * estimation pour une carte isolée, pas le calcul global de `rarity:preview`.
 */
export function rarityFromRank(fraction: number): Rarity {
  const position = Math.min(1, Math.max(0, fraction));
  if (position < 0.02) return "L";
  if (position < 0.07) return "UR";
  if (position < 0.18) return "SR";
  if (position < 0.38) return "R";
  if (position < 0.64) return "UC";
  return "C";
}

/** Paliers, du plus commun au plus rare. */
const TIERS: Rarity[] = ["C", "UC", "R", "SR", "UR", "L"];

/**
 * Plafond par franchise (3 Mythiques, 8 Légendaires) : si le palier est déjà
 * plein dans cet univers, la carte descend d'un cran.
 */
export function capRarity(rarity: Rarity, counts: Partial<Record<Rarity, number>>, caps: Partial<Record<Rarity, number>>): Rarity {
  let index = TIERS.indexOf(rarity);
  while (index > 0) {
    const current = TIERS[index];
    const cap = caps[current];
    if (cap === undefined || (counts[current] ?? 0) < cap) return current;
    index -= 1;
  }
  return TIERS[0];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Vérifie un brouillon avant écriture.
 *
 * Les erreurs sont rédigées pour être affichées telles quelles dans le
 * formulaire : elles disent ce qui manque, pas ce que le code attend.
 */
export function validateDraft(draft: CardDraft, context: ValidationContext): ValidationResult {
  const errors: string[] = [];
  const id = text(draft.id);
  const name = text(draft.name);
  const universe = text(draft.universe);

  if (!id) errors.push("identifiant manquant");
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    errors.push("identifiant invalide : minuscules, chiffres et tirets uniquement");
  }

  if (!name) errors.push("nom du personnage manquant");
  else if (name.length > 60) errors.push("nom trop long (60 caractères maximum)");

  if (!universe) errors.push("franchise manquante");
  else if (!context.universes.includes(universe)) errors.push(`franchise inconnue : ${universe}`);

  if (!(draft.rarity in { C: 1, UC: 1, R: 1, SR: 1, UR: 1, L: 1 })) {
    errors.push(`rareté inconnue : ${String(draft.rarity)}`);
  }

  if (!text(draft.emoji)) errors.push("emoji manquant (il sert de visuel de secours)");

  const genres = Array.isArray(draft.genres) ? draft.genres : [];
  for (const genre of genres) {
    if (!context.genres.includes(genre)) errors.push(`genre inconnu : ${genre}`);
  }
  if (new Set(genres).size !== genres.length) errors.push("genre en double");

  const lore = draft.lore;
  if (!text(lore?.tagline)) errors.push("accroche manquante");
  if (!text(lore?.bio)) errors.push("biographie manquante");

  if (draft.portrait) {
    const url = draft.portrait.url;
    if (!/^https?:\/\//.test(url ?? "")) errors.push("URL de visuel invalide");
    if (!(draft.portrait.width > 0) || !(draft.portrait.height > 0)) {
      errors.push("dimensions du visuel manquantes");
    }

    // Cadrage facultatif : s'il est fourni, il doit être exploitable tel quel.
    const framing = draft.portrait.framing;
    if (framing) {
      if (framing.objectFit !== "cover" && framing.objectFit !== "contain") {
        errors.push("cadrage invalide : ajustement inconnu");
      }
      if (!/^-?\d+(?:\.\d+)?% -?\d+(?:\.\d+)?%$/.test(framing.objectPosition ?? "")) {
        errors.push("cadrage invalide : position illisible");
      }
      if (
        framing.zoom !== undefined &&
        (!Number.isFinite(framing.zoom) || framing.zoom < MIN_ZOOM || framing.zoom > MAX_ZOOM)
      ) {
        errors.push(`cadrage invalide : zoom hors bornes (${MIN_ZOOM} à ${MAX_ZOOM})`);
      }
    }
  }

  if (id) {
    const taken = context.cards.find((card) => card.id === id);
    if (taken && taken.id !== context.editingId) {
      errors.push(`identifiant déjà utilisé par « ${taken.name} »`);
    }
  }

  if (name && universe) {
    const normalized = name.replace(/\s+/g, " ").toLowerCase();
    const duplicate = context.cards.find(
      (card) => card.universe === universe && card.name.replace(/\s+/g, " ").toLowerCase() === normalized,
    );
    if (duplicate && duplicate.id !== context.editingId) {
      errors.push(`« ${duplicate.name} » est déjà dans cette franchise (${duplicate.id})`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
