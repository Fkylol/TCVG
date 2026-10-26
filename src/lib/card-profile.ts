/**
 * Fiche éditoriale d'une carte (`card_profiles` en base).
 *
 * La fonction SQL `card_profile()` ne renvoie les champs que si le joueur
 * possède la carte ; sinon elle répond `{ unlocked: false }`. Ce module est
 * volontairement pur et sans dépendance : il ne fait que lire cette réponse,
 * et refuse tout contenu quand `unlocked` est faux — même si le serveur en
 * envoyait par erreur.
 */
/** Une œuvre où le personnage apparaît, avec son média (manga, jeu, film…). */
export type CardAppearance = { media: string; title: string };

export type CardProfile = {
  /** Résumé de tête de fiche. */
  overview: string | null;
  bio: string | null;
  appearances: CardAppearance[];
  studio: string | null;
  voice: string | null;
  trivia: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
};

type RawProfile = {
  unlocked?: unknown;
  overview?: unknown;
  bio?: unknown;
  appearances?: unknown;
  studio?: unknown;
  voice?: unknown;
  trivia?: unknown;
  source_name?: unknown;
  source_url?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * `null` si la fiche est verrouillée (aucun champ n'est alors lu) ; sinon les
 * champs présents, les absents restant vides.
 */
export function parseCardProfile(payload: unknown): CardProfile | null {
  if (!payload || typeof payload !== "object") return null;

  const raw = payload as RawProfile;
  if (raw.unlocked !== true) return null;

  return {
    overview: text(raw.overview),
    bio: text(raw.bio),
    appearances: Array.isArray(raw.appearances)
      ? raw.appearances.flatMap((item): CardAppearance[] => {
          if (!item || typeof item !== "object") return [];
          const entry = item as { media?: unknown; title?: unknown };
          const title = text(entry.title);
          if (!title) return [];
          return [{ media: text(entry.media) ?? "—", title }];
        })
      : [],
    studio: text(raw.studio),
    voice: text(raw.voice),
    trivia: text(raw.trivia),
    sourceName: text(raw.source_name),
    sourceUrl: text(raw.source_url),
  };
}
