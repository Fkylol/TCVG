import type { Rarity } from "@/lib/cards";
import { setCardEdits, type CardEdit } from "@/lib/card-edits";
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
    setCardEdits(cache);
    return cache;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("card_edits")
      .select("card_id, name, rarity, universe, emoji, image_url, image_fit, image_position, image_zoom, hidden");

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
    }));
    loadedAt = Date.now();
    setCardEdits(cache);
    return cache;
  } catch {
    // Base injoignable : le site reste sur le catalogue du code.
    return cache;
  }
}
