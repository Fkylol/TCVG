/**
 * Cartes créées par l'atelier d'ajout (`/atelier/cartes`).
 *
 * Le catalogue de base reste écrit à la main dans `cards.ts`. Ce module lit le
 * fichier de données que l'atelier alimente, et le catalogue final est la
 * concaténation des deux : les cartes ajoutées prennent donc les derniers
 * numéros d'album, et `db:cards` les synchronise comme les autres.
 *
 * Une entrée qui reprend l'identifiant d'une carte de base est une correction :
 * elle remplace cette carte dans `CARDS`, sans la dupliquer ni la renuméroter.
 *
 * Le contenu éditorial (tagline, bio…) vit à part, dans `atelier-lore.ts` : il
 * ne doit jamais partir dans le bundle client.
 *
 * Aucune I/O ici : les JSON sont importés au build, donc le rendu client et le
 * rendu serveur voient exactement la même liste.
 */

import raw from "@/data/atelier-cards.json";

import type { GenreSlug } from "./card-genres";
import type { Card, Rarity } from "./cards";
import type { Portrait } from "./portraits";

/** Une carte telle que l'atelier l'enregistre. */
export type AtelierEntry = {
  id: string;
  name: string;
  universe: string;
  emoji: string;
  rarity: Rarity;
  genres: GenreSlug[];
  /** `null` quand aucun visuel n'a été retenu : la carte retombe sur l'emoji. */
  portrait: Portrait | null;
  /** Date d'ajout, pour retrouver l'ordre des créations. */
  createdAt: string;
};

type Payload = { cards?: AtelierEntry[] };

export const ATELIER_ENTRIES: AtelierEntry[] = (raw as Payload).cards ?? [];

/** Entrées du catalogue, dans l'ordre d'ajout. */
export const ATELIER_CARDS: Card[] = ATELIER_ENTRIES.map((entry) => ({
  id: entry.id,
  name: entry.name,
  universe: entry.universe as Card["universe"],
  emoji: entry.emoji,
  rarity: entry.rarity,
}));

export const ATELIER_GENRES: Record<string, GenreSlug[]> = Object.fromEntries(
  ATELIER_ENTRIES.map((entry) => [entry.id, entry.genres]),
);

export const ATELIER_PORTRAITS: Record<string, Portrait> = Object.fromEntries(
  ATELIER_ENTRIES.filter((entry) => entry.portrait !== null).map((entry) => [
    entry.id,
    entry.portrait as Portrait,
  ]),
);
