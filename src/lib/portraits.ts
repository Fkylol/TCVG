import data from "@/data/portraits.json";

export type Portrait = {
  url: string;
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
 * Visuel hotlinké depuis upload.wikimedia.org, ou undefined si le personnage n'a pas
 * d'article Wikipédia avec image (le rendu retombe alors sur le dégradé + emoji).
 */
export function getPortrait(cardId: string): Portrait | undefined {
  return ITEMS[cardId];
}

export function filePageUrl(portrait: Portrait): string {
  return `https://en.wikipedia.org/wiki/File:${encodeURIComponent(portrait.file.replace(/ /g, "_"))}`;
}
