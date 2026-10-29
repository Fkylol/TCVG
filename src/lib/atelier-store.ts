/**
 * Enregistrement d'une carte préparée dans l'atelier.
 *
 * L'atelier écrit dans les fichiers de données (`src/data/atelier-cards.json`
 * et `atelier-lore.json`), pas dans le catalogue écrit à la main : le fichier
 * `cards.ts` reste la source de vérité du catalogue de base, les ajouts
 * viennent s'y concaténer.
 *
 * Après écriture, `db:cards` recopie le catalogue en base. L'étape est lancée
 * ici pour que la carte soit jouable tout de suite ; elle exige `.env` (accès
 * Supabase), donc l'atelier tourne sur la machine de développement.
 *
 * ⚠️ Réservé au serveur : écrit sur le disque et lance un processus enfant.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { type CardDraft, validateDraft } from "./atelier-core";
import { GENRES } from "./card-genres";
import { CARDS, UNIVERSES } from "./cards";
import type { Card } from "./cards";
import { cardStats } from "./stats";
import { openRunner } from "../../scripts/lib/db-runner";
import type { CardLore } from "./card-lore";
import type { Portrait } from "./portraits";

const CARDS_FILE = path.join(process.cwd(), "src", "data", "atelier-cards.json");
const LORE_FILE = path.join(process.cwd(), "src", "data", "atelier-lore.json");

type CardsPayload = {
  note?: string;
  cards: {
    id: string;
    name: string;
    universe: string;
    emoji: string;
    rarity: string;
    genres: string[];
    portrait: Portrait | null;
    createdAt: string;
  }[];
};

type LorePayload = { note?: string; lore: Record<string, CardLore> };

const CARDS_NOTE = "Cartes ajoutées par l'atelier (/atelier/cartes). Fichier écrit par l'outil : ne pas éditer à la main.";
const LORE_NOTE =
  "Contenu éditorial des cartes ajoutées par l'atelier (/atelier/cartes). Réservé au serveur : ne pas importer depuis un composant client.";

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/** Écrit le JSON avec une indentation stable : les diffs restent lisibles. */
async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export type SaveResult =
  | { ok: true; id: string; synced: boolean; message: string }
  | { ok: false; errors: string[] };

/**
 * Ajoute la carte aux fichiers de données, puis synchronise la base.
 *
 * Une carte déjà au catalogue (créée par l'atelier ou écrite à la main dans
 * `cards.ts`) est réécrite sur place : l'atelier sert aussi à corriger un nom,
 * une rareté, une fiche ou un visuel existants.
 *
 * Le brouillon est revalidé ici : l'action serveur ne fait jamais confiance au
 * formulaire (identifiant libre, franchise connue, personnage absent).
 */
export async function saveDraft(draft: CardDraft): Promise<SaveResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, errors: ["L'atelier est réservé au développement local."] };
  }

  const payload = await readJson<CardsPayload>(CARDS_FILE, { cards: [] });
  const lore = await readJson<LorePayload>(LORE_FILE, { lore: {} });

  // L'identifiant visé existe-t-il déjà (carte de base ou ajout précédent) ?
  // Si oui, c'est une correction : on réécrit l'entrée, on n'en ajoute pas une.
  const existing = payload.cards.findIndex((entry) => entry.id === draft.id);
  const editing = existing >= 0 || CARDS.some((card) => card.id === draft.id);
  // Seuls les champs connus sont conservés : le formulaire peut renvoyer le
  // candidat complet (titre de page, hôte du wiki) sans polluer les données.
  const quote = draft.lore?.quote?.trim();
  const power = draft.lore?.power?.trim();
  const candidate: CardDraft = {
    ...draft,
    name: draft.name?.trim() ?? "",
    emoji: draft.emoji?.trim() ?? "",
    genres: [...new Set(Array.isArray(draft.genres) ? draft.genres : [])],
    lore: {
      tagline: draft.lore?.tagline?.trim() ?? "",
      bio: draft.lore?.bio?.trim() ?? "",
      ...(quote ? { quote } : {}),
      ...(power ? { power } : {}),
    },
    portrait: draft.portrait
      ? {
          url: draft.portrait.url,
          source: draft.portrait.source,
          sourceName: draft.portrait.sourceName,
          wikiHost: draft.portrait.wikiHost,
          page: draft.portrait.page,
          file: draft.portrait.file,
          width: draft.portrait.width,
          height: draft.portrait.height,
          credit: draft.portrait.credit,
          license: draft.portrait.license,
          checkedAt: draft.portrait.checkedAt,
          confidence: draft.portrait.confidence,
          // Cadrage réglé à la souris : sans lui, la carte s'afficherait
          // haut-centre et le travail de recadrage serait perdu.
          ...(draft.portrait.framing ? { framing: draft.portrait.framing } : {}),
        }
      : null,
  };

  const validation = validateDraft(candidate, {
    universes: Object.keys(UNIVERSES),
    cards: CARDS,
    genres: GENRES.map((genre) => genre.slug),
    editingId: editing ? candidate.id : undefined,
  });
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const entry = {
    id: candidate.id,
    name: candidate.name.trim(),
    universe: candidate.universe,
    emoji: candidate.emoji.trim(),
    rarity: candidate.rarity,
    genres: candidate.genres,
    portrait: candidate.portrait,
    // La date de création survit à une correction : elle date l'entrée.
    createdAt: existing >= 0 ? payload.cards[existing].createdAt : new Date().toISOString(),
  };
  payload.cards =
    existing >= 0
      ? payload.cards.map((item, index) => (index === existing ? entry : item))
      : [...payload.cards, entry];
  lore.lore = { ...lore.lore, [candidate.id]: candidate.lore };

  await writeJson(CARDS_FILE, { note: CARDS_NOTE, cards: payload.cards });
  await writeJson(LORE_FILE, { note: LORE_NOTE, lore: lore.lore });

  // Sans `.env`, la synchro échoue : la carte reste écrite, on le dit.
  // Synchronise uniquement cette entrée ; db:cards effectue une purge complète
  // et serait à la fois lent et risqué pour un enregistrement unitaire.
  const sync = await syncCard(candidate, payload.cards);
  const verb = editing ? "Carte mise à jour" : "Carte ajoutée";
  return {
    ok: true,
    id: candidate.id,
    synced: sync.ok,
    message: sync.ok
      ? `${verb} et base synchronisée.`
      : `${verb}, mais la base n'a pas été synchronisée : ${sync.message}`,
  };
}

/** Synchronise une carte sans réécrire ni purger le reste du catalogue. */
async function syncCard(
  card: CardDraft,
  atelierCards: CardsPayload["cards"],
): Promise<{ ok: boolean; message: string }> {
  let runner: Awaited<ReturnType<typeof openRunner>> | undefined;
  try {
    runner = await openRunner();
    const franchise = UNIVERSES[card.universe as keyof typeof UNIVERSES];
    const codeIndex = CARDS.findIndex((entry) => entry.id === card.id);
    const atelierOnly = atelierCards
      .filter((entry) => !CARDS.some((catalogCard) => catalogCard.id === entry.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const atelierIndex = atelierOnly.findIndex((entry) => entry.id === card.id);
    const number = codeIndex >= 0 ? codeIndex + 1 : CARDS.length + atelierIndex + 1;
    const quality = cardStats({
      id: card.id,
      name: card.name,
      universe: card.universe as Card["universe"],
      emoji: card.emoji,
      rarity: card.rarity,
    }).quality;
    const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
    const genres = card.genres
      .map((slug) => {
        const genre = GENRES.find((entry) => entry.slug === slug);
        if (!genre) throw new Error(`Genre inconnu : ${slug}`);
        return `(${quote(genre.slug)}, ${quote(genre.name)})`;
      })
      .join(", ");
    if (!genres) throw new Error("La carte doit avoir au moins un genre.");
    const id = quote(card.id);
    const universe = quote(card.universe);

    const sql = `
with franchise as (
  insert into public.franchises (slug, name)
  values (${universe}, ${quote(franchise.label)})
  on conflict (slug) do update set name = excluded.name
  returning id
), upsert_card as (
  insert into public.cards (id, name, universe, rarity, number, quality, franchise_id, active, retired_reason)
  select ${id}, ${quote(card.name)}, ${universe}, ${quote(card.rarity)}, ${number}, ${quality}, franchise.id, true, null
    from franchise
  on conflict (id) do update
    set name = excluded.name,
        universe = excluded.universe,
        rarity = excluded.rarity,
        number = excluded.number,
        quality = excluded.quality,
        franchise_id = excluded.franchise_id,
        active = true,
        retired_at = null,
        retired_reason = null,
        updated_at = now()
  returning id
), upsert_genres as (
  insert into public.genres (slug, name)
  values ${genres}
  on conflict (slug) do update set name = excluded.name
  returning id, slug
), deleted_genres as (
  delete from public.card_genres
   where card_id = (select id from upsert_card)
  returning card_id
), inserted_genres as (
  insert into public.card_genres (card_id, genre_id)
  select upsert_card.id, upsert_genres.id
    from upsert_card
    cross join upsert_genres
    cross join (select count(*) from deleted_genres) as deletion_done
  on conflict (card_id, genre_id) do nothing
  returning card_id
)
select count(*)::int as genres_linked from inserted_genres;`;
    await runner.query(sql);
    return { ok: true, message: runner.label };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "échec inconnu" };
  } finally {
    await runner?.close();
  }
}
