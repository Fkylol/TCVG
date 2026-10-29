import type { Rarity } from "@/lib/cards";
import { publishCardEdits, type CardEdit } from "@/lib/card-edits";
import { clampFraming, type PortraitFraming } from "@/lib/framing";
import { createClient } from "@/lib/supabase/server";

/**
 * Charge les éditions du catalogue (`public.card_edits`) et les installe pour
 * le rendu courant.
 *
 * Le catalogue est le même pour tous les joueurs : un cache de dix secondes
 * par instance suffit, et évite une requête par page. La fonction renvoie les
 * lignes pour que le layout racine les recopie dans la page — le navigateur
 * doit lire exactement les mêmes valeurs que le serveur, sinon l'hydratation
 * rejoue le catalogue d'origine.
 *
 * `publishCardEdits()` installe la liste dans le graphe serveur *et* la publie
 * dans `globalThis`, que le rendu serveur des composants clients relit : sans
 * ce relais, une carte affichée par un composant client sortait du catalogue
 * d'origine côté serveur et du catalogue édité dans le navigateur.
 */
const TTL = 10_000;
let loadedAt = 0;
let cache: CardEdit[] = [];

/**
 * Cadrage enregistré, ou `null` quand la carte suit le cadrage du catalogue.
 * Les trois colonnes sont indépendantes : un `fit` sans position n'a pas de
 * sens, c'est la position par défaut du site qui complète.
 */
function framingOf(row: Record<string, unknown>): PortraitFraming | null {
  const fit = row.image_fit === "contain" ? "contain" : row.image_fit === "cover" ? "cover" : null;
  const position = typeof row.image_position === "string" ? row.image_position : null;
  const raw = row.image_zoom;
  const zoom = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  const zoomed = zoom !== null && Number.isFinite(zoom) && zoom > 1;

  if (!fit && !position && !zoomed) return null;

  return clampFraming({
    objectFit: fit ?? "cover",
    objectPosition: position ?? "50% 0%",
    zoom: zoomed ? (zoom as number) : 1,
  });
}

export async function installCardEdits(force = false): Promise<CardEdit[]> {
  if (!force && loadedAt !== 0 && Date.now() - loadedAt < TTL) {
    publishCardEdits(cache);
    return cache;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("card_edits")
      .select("card_id, name, rarity, universe, emoji, image_url, image_fit, image_position, image_zoom, hidden, published_card, published_genres, published_tagline, published_bio, published_quote, published_power, image_width, image_height, image_source_name, image_source_page, image_file, image_credit, image_license");

    if (error || !data) return cache;

    cache = (data as Record<string, unknown>[]).map((row) => ({
      cardId: String(row.card_id),
      name: (row.name as string | null) ?? null,
      rarity: (row.rarity as Rarity | null) ?? null,
      universe: (row.universe as string | null) ?? null,
      emoji: (row.emoji as string | null) ?? null,
      imageUrl: (row.image_url as string | null) ?? null,
      framing: framingOf(row),
      hidden: row.hidden === true,
      publishedGenres: Array.isArray(row.published_genres)
        ? row.published_genres.filter((genre): genre is string => typeof genre === "string")
        : null,
      publishedCard: row.published_card && typeof row.published_card === "object"
        ? {
            ...(row.published_card as NonNullable<CardEdit["publishedCard"]>),
            tagline: typeof row.published_tagline === "string" ? row.published_tagline : null,
            bio: typeof row.published_bio === "string" ? row.published_bio : null,
            quote: typeof row.published_quote === "string" ? row.published_quote : null,
            power: typeof row.published_power === "string" ? row.published_power : null,
          }
        : null,
      imageWidth: typeof row.image_width === "number" ? row.image_width : null,
      imageHeight: typeof row.image_height === "number" ? row.image_height : null,
      imageSourceName: typeof row.image_source_name === "string" ? row.image_source_name : null,
      imageSourcePage: typeof row.image_source_page === "string" ? row.image_source_page : null,
      imageFile: typeof row.image_file === "string" ? row.image_file : null,
      imageCredit: typeof row.image_credit === "string" ? row.image_credit : null,
      imageLicense: typeof row.image_license === "string" ? row.image_license : null,
    }));
    loadedAt = Date.now();
    publishCardEdits(cache);
    return cache;
  } catch {
    // Base injoignable : le site reste sur le catalogue du code.
    return cache;
  }
}
