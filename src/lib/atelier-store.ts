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

import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { type CardDraft, validateDraft } from "./atelier-core";
import { GENRES } from "./card-genres";
import { CARDS, UNIVERSES } from "./cards";
import type { CardLore } from "./card-lore";
import type { Portrait } from "./portraits";

const run = promisify(exec);

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
  const sync = await syncDatabase();
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

/** Lance `npm run db:cards` (recopie du catalogue vers Supabase). */
export async function syncDatabase(): Promise<{ ok: boolean; message: string }> {
  try {
    const { stdout, stderr } = await run("npm run db:cards", {
      cwd: process.cwd(),
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    const output = `${stdout}\n${stderr}`.trim().split("\n").filter(Boolean).slice(-3).join(" · ");
    return { ok: true, message: output || "synchronisé" };
  } catch (error) {
    const failure = error as { message?: string; stdout?: string; stderr?: string };
    const detail = `${failure.stderr ?? ""}${failure.stdout ?? ""}`.trim().split("\n").filter(Boolean).slice(-3).join(" · ");
    return { ok: false, message: detail || failure.message || "échec inconnu" };
  }
}
