import data from "@/data/portraits.json";

export type Portrait = {
  url: string;
  /** Source du visuel : article Wikipédia ou wiki Fandom de la franchise. */
  source: "wikipedia" | "fandom";
  /** Hôte du wiki Fandom (« spyro.fandom.com »). */
  wikiHost?: string;
  wikiTitle: string;
  page: string;
  file: string;
  width: number;
  height: number;
  credit?: string;
  license?: string;
};

const ITEMS = data.items as unknown as Record<string, Portrait>;

/**
 * Visuel hotlinké (Wikipédia ou Fandom), ou undefined si le personnage n'a de page
 * avec image sur aucune des deux sources : le rendu retombe alors sur dégradé + emoji.
 */
export function getPortrait(cardId: string): Portrait | undefined {
  return ITEMS[cardId];
}

export function sourceLabel(portrait: Portrait): string {
  return portrait.source === "fandom" ? (portrait.wikiHost ?? "Fandom") : "Wikipédia";
}
