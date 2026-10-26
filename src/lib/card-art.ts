import manifest from "@/data/card-images.json";
import { isRetiredCard } from "@/lib/cards";
import { getPortrait, getPortraitFraming, sourceLabel, type PortraitFraming } from "@/lib/portraits";

const LOCAL = (manifest as { items: Record<string, string> }).items;

export type CardArt = {
  /** URL à charger : fichier local (`/cards/…`) ou visuel hotlinké. */
  src: string;
  /** Vrai quand le visuel est servi par le site : aucune attribution externe. */
  local: boolean;
  /** Cadrage `object-fit` / `object-position`. */
  framing: PortraitFraming;
  /** Attribution, uniquement pour un visuel externe. */
  credit?: string;
  license?: string;
  sourceLabel?: string;
};

/**
 * Résolution d'un visuel de carte, dans cet ordre :
 *   1. fichier local déclaré dans `src/data/card-images.json` ;
 *   2. visuel hotlinké de `src/data/portraits.json` ;
 *   3. `null` → le rendu retombe sur le dégradé + emoji.
 *
 * Aucune I/O : le manifeste est statique, donc le même résultat côté serveur et
 * côté client (pas de décalage d'hydratation).
 */
export function resolveCardArt(
  cardId: string,
  localPath: string | null | undefined,
): CardArt | null {
  const framing = getPortraitFraming(cardId);

  if (localPath) {
    return { src: localPath, local: true, framing };
  }

  const portrait = getPortrait(cardId);
  if (!portrait) return null;

  return {
    src: portrait.url,
    local: false,
    framing,
    credit: portrait.credit,
    license: portrait.license,
    sourceLabel: sourceLabel(portrait),
  };
}

/**
 * Visuel à afficher pour une carte du catalogue.
 *
 * Une carte retirée ne renvoie rien : son visuel est coupé partout (album,
 * profil, classement, marché), même si le fichier existe encore sur disque.
 */
export function getCardArt(cardId: string): CardArt | null {
  if (isRetiredCard(cardId)) return null;
  return resolveCardArt(cardId, LOCAL[cardId]);
}

/** Nombre de cartes déjà servies par un fichier local (diagnostic / admin). */
export const LOCAL_ART_COUNT = manifest.count ?? 0;
