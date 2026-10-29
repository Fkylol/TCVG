import data from "@/data/portraits.json";

import { ATELIER_PORTRAITS } from "./atelier-data";
import { cardEdit } from "./card-edits";
import { clampFraming, type PortraitFraming } from "./framing";

export type { PortraitFraming } from "./framing";

export type Portrait = {
  url: string;
  /**
   * Source du visuel : article Wikipédia, wiki Fandom de la franchise, Wikidata,
   * ou une URL fournie à la main dans l'atelier (recherche d'images).
   */
  source: "wikipedia" | "fandom" | "wikidata" | "custom";
  /** Libellé de provenance affiché (« Wikidata (P18) », « zelda.fandom.com »). */
  sourceName?: string;
  /** Hôte du wiki Fandom (« spyro.fandom.com »). */
  wikiHost?: string;
  /** Titre de la page Wikidata/Wikipédia d'où vient le visuel. */
  wikiTitle?: string;
  page?: string;
  file?: string;
  width: number;
  height: number;
  credit?: string;
  license?: string;
  /** Dernière vérification du hotlink (`images:strict`). */
  checkedAt?: string;
  /** Confiance de la source : nom exact Wikidata (`high`) ou wiki de franchise (`medium`). */
  confidence?: "high" | "medium";
  /**
   * Cadrage réglé à la main dans l'atelier (position et zoom). Absent : les
   * réglages de `PORTRAIT_FRAMING`, sinon haut-centre.
   */
  framing?: PortraitFraming;
};

const ITEMS: Record<string, Portrait> = {
  ...(data.items as unknown as Record<string, Portrait>),
  // Murloc : concept art officiel de Blizzard par Samwise Didier, via Warcraft Wiki.
  murloc: {
    url: "https://warcraft.wiki.gg/images/A_Murloc%27s_Ambition_by_Samwise.jpg?83aca1",
    source: "custom",
    sourceName: "Warcraft Wiki · concept art de Samwise Didier",
    page: "https://warcraft.wiki.gg/wiki/File:A_Murloc%27s_Ambition_by_Samwise.jpg",
    file: "A Murloc's Ambition by Samwise.jpg",
    width: 750,
    height: 750,
    checkedAt: "2026-10-27T18:28:49.554Z",
    confidence: "medium",
  },
  // Les visuels choisis dans l'atelier prennent le pas sur un ancien portrait.
  ...ATELIER_PORTRAITS,
};

/** Cadrage par défaut : haut-centre, adapté aux portraits debout. */
const DEFAULT_FRAMING: PortraitFraming = {
  objectFit: "cover",
  objectPosition: "50% 0%",
};

/**
 * Cadrage manuel des visuels qui ne cadrent pas bien en haut-centre.
 *
 * Le rendu par défaut colle le visuel en haut du cadre : parfait pour un
 * personnage debout, mais il coupe la tête d'une illustration large ou ne
 * garde que la pointe d'une arme sur un artwork très allongé. Ces valeurs sont
 * des `object-position` CSS, à ajuster visuellement au cas par cas.
 */
export const PORTRAIT_FRAMING: Record<string, PortraitFraming> = {
  // Rendu large (500×304) sur fond transparent : en `cover`, la tête du dragon
  // part hors cadre à gauche. On garde donc l'image entière, centrée.
  "ender-dragon": { objectFit: "contain", objectPosition: "50% 50%" },
  // Surt : rendu 676×507 du géant de feu, presque carré. En `cover`, les cornes
  // et les bras sortent du cadre ; on garde le monstre entier.
  surt: { objectFit: "contain", objectPosition: "50% 50%" },
  // Artwork très allongé (1:3,7) : le visage est au tiers haut de l'image, il
  // faut donc descendre la fenêtre de cadrage pour le centrer dans la carte.
  ciri: { objectFit: "cover", objectPosition: "50% 34%" },
  // Illustration large : Hornet est à gauche, le centre ne montre que la cape.
  hornet: { objectFit: "cover", objectPosition: "20% 50%" },
  // Aurene : visuel 640×320, la tête du dragon est à gauche du cadre.
  aurene: { objectFit: "cover", objectPosition: "24% 50%" },
  // Illustrations 16:9 : Zéro est à gauche du centre, le Prisonnier tout à fait
  // à gauche. Le cadrage centré ne garderait qu'un pan de décor.
  zero: { objectFit: "cover", objectPosition: "30% 50%" },
  prisonnier: { objectFit: "cover", objectPosition: "15% 50%" },
  // Capture large de Limbo : le garçon est petit et légèrement à droite du
  // centre, le cadrage doit le garder entier.
  "petit-garcon": { objectFit: "cover", objectPosition: "56% 46%" },
  // Illustration large : Beatrix est à droite de la falaise, le centre ne
  // garderait que le ciel.
  beatrix: { objectFit: "cover", objectPosition: "76% 40%" },
  // Rendu large (1890×1331) : le centre ne montre que la lance, le visage est
  // à droite du cadre.
  "bandana-waddle-dee": { objectFit: "cover", objectPosition: "62% 50%" },
};

/**
 * Cadrage à appliquer au visuel de la carte.
 *
 * Priorité au réglage enregistré avec le portrait (atelier : position et zoom
 * choisis à la souris), puis au cadrage écrit à la main par carte, puis au
 * défaut.
 */
export function getPortraitFraming(cardId?: string | null): PortraitFraming {
  if (!cardId) return DEFAULT_FRAMING;
  const edited = cardEdit(cardId)?.framing;
  return clampFraming(edited ?? ITEMS[cardId]?.framing ?? PORTRAIT_FRAMING[cardId] ?? DEFAULT_FRAMING);
}

/**
 * Visuel hotlinké (Wikipédia ou Fandom), ou undefined si le personnage n'a de page
 * avec image sur aucune des deux sources : le rendu retombe alors sur dégradé + emoji.
 */
export function getPortrait(cardId: string): Portrait | undefined {
  const edit = cardEdit(cardId);
  if (edit?.imageUrl) {
    return {
      url: edit.imageUrl,
      source: "custom",
      sourceName: edit.imageSourceName ?? undefined,
      page: edit.imageSourcePage ?? undefined,
      file: edit.imageFile ?? undefined,
      width: edit.imageWidth ?? 1,
      height: edit.imageHeight ?? 1,
      credit: edit.imageCredit ?? undefined,
      license: edit.imageLicense ?? undefined,
    };
  }
  return ITEMS[cardId];
}

export function sourceLabel(portrait: Portrait): string {
  if (portrait.sourceName) return portrait.sourceName;
  if (portrait.source === "fandom") return portrait.wikiHost ?? "Fandom";
  if (portrait.source === "wikidata") return "Wikidata";
  if (portrait.source === "custom") return "Lien externe";
  return "Wikipédia";
}

/**
 * Titre lisible du visuel pour l'attribution : la page ou le fichier source.
 *
 * Les visuels récupérés par `images:fix` ne conservent pas toujours le titre de
 * la page ; le nom du fichier fait alors office de libellé.
 */
export function attributionLabel(portrait: Portrait): string {
  return portrait.wikiTitle || portrait.file || sourceLabel(portrait);
}
