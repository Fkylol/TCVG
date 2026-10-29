"use server";

import { revalidatePath } from "next/cache";

import { type CardDraft, type PortraitCandidate, uniqueCardId } from "@/lib/atelier-core";
import {
  detectUniverse,
  draftLore,
  estimateRarity,
  inspectPortraitUrl,
  searchPortraitCandidates,
  suggestedGenres,
  type UniverseGuess,
} from "@/lib/atelier-search";
import { saveDraft, type SaveResult } from "@/lib/atelier-store";
import { genresOf } from "@/lib/card-genres";
import { getCardLore } from "@/lib/card-lore";
import { CARDS, UNIVERSES } from "@/lib/cards";
import { getPortrait, type Portrait } from "@/lib/portraits";
import { inspectImage, namesCharacter } from "../../../../scripts/images/lib/validate";

export type PrepareResult =
  | {
      ok: true;
      draft: CardDraft;
      candidates: PortraitCandidate[];
      notes: string[];
      rarityNote: string;
      /** Franchise devinée à partir du nom, quand aucune n'était choisie. */
      guess: UniverseGuess | null;
    }
  | { ok: false; error: string };

function isKnownUniverse(value: string): value is keyof typeof UNIVERSES {
  return Object.prototype.hasOwnProperty.call(UNIVERSES, value);
}

/**
 * Prépare une carte : visuels vérifiés, fiche rédigée depuis la source,
 * rareté estimée sur la popularité, genres de la franchise.
 *
 * Rien n'est enregistré à ce stade : le formulaire montre tout, modifiable.
 */
export async function prepareAction(input: { universe: string; name: string; universeLabel?: string }): Promise<PrepareResult> {
  const requested = input.universe?.trim() ?? "";
  const requestedLabel = input.universeLabel?.trim().replace(/\s+/g, " ") ?? "";
  const name = input.name?.trim().replace(/\s+/g, " ") ?? "";
  if (name.length < 2) return { ok: false, error: "Indique le nom du personnage (2 caractères minimum)." };
  if (name.length > 60) return { ok: false, error: "Nom trop long (60 caractères maximum)." };

  // Sans franchise choisie, on la déduit du nom (page Wikipédia du personnage).
  let universe = requested;
  let guess: UniverseGuess | null = null;
  if (!requested) {
    guess = await detectUniverse(name);
    if (!guess) {
      return {
        ok: false,
        error:
          `Impossible de deviner la franchise pour « ${name} ». Choisis-la dans la liste, ` +
          "ou ajoute son univers au catalogue si elle n'y est pas encore.",
      };
    }
    universe = guess.universe;
  }
  if (!isKnownUniverse(universe) && (!requested || requested !== requestedLabel)) {
    return { ok: false, error: "Franchise invalide : sélectionne une franchise du catalogue." };
  }
  const universeLabel = isKnownUniverse(universe) ? UNIVERSES[universe].label : requestedLabel;
  if (universeLabel.length < 2 || universeLabel.length > 80) {
    return { ok: false, error: "Le nom de la franchise doit faire entre 2 et 80 caractères." };
  }

  const existing = CARDS.find(
    (card) => card.universe === universe && card.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    return { ok: false, error: `« ${existing.name} » est déjà au catalogue (${existing.id}).` };
  }

  // Portraits et rareté contactent des sources indépendantes : les lancer
  // ensemble évite de faire attendre toute une branche réseau à l'autre.
  const [portraitSearch, estimate] = await Promise.all([
    searchPortraitCandidates({ universe, universeLabel, name }),
    estimateRarity({ universe, name }),
  ]);
  const { candidates, notes } = portraitSearch;
  const best = candidates[0] ?? null;

  // Fiche : la page qui porte exactement le nom (et non « The Characters of
  // Warcraft/… » ou une page de décor), sinon la plus courte des trouvées.
  const normalized = name.toLowerCase();
  const loreCandidates = candidates.filter((candidate) => candidate.pageTitle.length > 0);
  const loreCandidate =
    loreCandidates.find((candidate) => candidate.pageTitle.toLowerCase() === normalized) ??
    [...loreCandidates]
      .filter((candidate) => candidate.pageTitle.toLowerCase().includes(normalized))
      .sort((a, b) => a.pageTitle.length - b.pageTitle.length)[0] ??
    loreCandidates[0] ??
    null;

  const lore = await draftLore({ candidate: loreCandidate, name, universe, universeLabel });

  const draft: CardDraft = {
    id: uniqueCardId(name, CARDS.map((card) => card.id)),
    name,
    universe,
    emoji: "🎮",
    rarity: estimate.rarity,
    genres: suggestedGenres(universe),
    lore,
    portrait: best,
  };

  return { ok: true, draft, candidates, notes, rarityNote: estimate.note, guess };
}

export type PortraitResult = { ok: true; candidate: PortraitCandidate } | { ok: false; error: string };

/**
 * Vérifie un visuel collé depuis une recherche d'images, puis le renvoie prêt
 * à être retenu. Le contrôle est le même que pour les candidats automatiques :
 * une URL qui ne répond pas en image, trop petite ou mal proportionnée est
 * refusée avec la raison, plutôt que d'être acceptée puis cassée sur la carte.
 */
export async function inspectPortraitAction(input: { url: string; name: string }): Promise<PortraitResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "L'atelier est réservé au développement local." };
  }
  return inspectPortraitUrl({ url: input.url ?? "", name: input.name ?? "" });
}

export type LoadResult =
  | { ok: true; draft: CardDraft; candidates: PortraitCandidate[] }
  | { ok: false; error: string };

/**
 * Charge une carte du catalogue dans le formulaire, pour la corriger.
 *
 * Le visuel courant est proposé comme unique candidat : il reste sélectionné
 * tant qu'aucun autre n'est choisi, et l'URL collée peut le remplacer.
 */
export async function loadCardAction(input: { id: string }): Promise<LoadResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "L'atelier est réservé au développement local." };
  }

  const id = (input.id ?? "").trim().toLowerCase();
  if (!id) return { ok: false, error: "Indique l'identifiant de la carte à modifier." };

  const card = CARDS.find((entry) => entry.id === id);
  if (!card) return { ok: false, error: `Aucune carte « ${id} » au catalogue.` };

  const portrait = await withDimensions(getPortrait(card.id) ?? null);
  return {
    ok: true,
    draft: {
      id: card.id,
      name: card.name,
      universe: card.universe,
      emoji: card.emoji,
      rarity: card.rarity,
      genres: genresOf(card.id),
      // Une carte sans fiche arrive avec des champs vides : à compléter, comme
      // une création (la validation exige une accroche et une biographie).
      lore: getCardLore(card.id) ?? { tagline: "", bio: "" },
      portrait,
    },
    candidates: portrait
      ? [
          {
            ...portrait,
            pageTitle: "",
            wiki: safeOrigin(portrait.url),
            named: namesCharacter(portrait.url, card.name),
          },
        ]
      : [],
  };
}

/**
 * Complète les dimensions d'un portrait qui n'en a pas.
 *
 * Les entrées les plus anciennes de `portraits.json` ne portent que l'URL : le
 * rendu s'en passe (`fill`), mais l'enregistrement exige des dimensions. On les
 * mesure donc à l'ouverture, plutôt que de refuser plus tard la correction d'une
 * carte sous prétexte que son ancien visuel est incomplet.
 */
async function withDimensions(portrait: Portrait | null): Promise<Portrait | null> {
  if (!portrait || (portrait.width > 0 && portrait.height > 0)) return portrait;
  const verdict = await inspectImage(portrait.url);
  return verdict.ok ? { ...portrait, width: verdict.width, height: verdict.height } : portrait;
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Enregistre la carte dans les données puis synchronise la base. */
export async function insertAction(draft: CardDraft): Promise<SaveResult> {
  const result = await saveDraft(draft);
  if (result.ok) {
    // Le catalogue a changé : les pages qui comptent les cartes sont relues.
    revalidatePath("/", "layout");
  }
  return result;
}
