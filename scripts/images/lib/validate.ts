/**
 * Vérification d'une image candidate (étape 3 du cahier des charges).
 *
 * Une image n'est acceptée que si :
 *   • l'URL répond 200 avec un type image (jpeg, png, webp, gif non animé) ;
 *   • largeur et hauteur ≥ 300 px, rapport largeur/hauteur entre 0,4 et 2,5 ;
 *   • le nom de fichier n'évoque ni logo, ni icône, ni bannière, ni carte, ni
 *     visuel de remplacement ;
 *   • l'accès ne demande ni cookie, ni Referer (le hotlink doit fonctionner).
 *
 * Aucune image n'est conservée : seules les mesures et l'URL le sont.
 */

import { get } from "./http";
import { readSize } from "./size";

export const MIN_SIDE = 300;
export const MIN_RATIO = 0.4;
export const MAX_RATIO = 2.5;

/** Mots interdits dans le nom de fichier (chemins décodés, minuscules). */
const BLOCKED =
  /(logo|icon|banner|placeholder|no[-_ ]?image|noimage|not[-_ ]?available|unavailable|spritesheet|sprite|flag|map|thumbnail_missing|box[-_ ]?art|cover[-_ ]?art)/i;

export type Verdict = {
  url: string;
  ok: boolean;
  /** Motif court, lisible dans le rapport. */
  reason: string;
  status: number;
  contentType: string;
  width: number;
  height: number;
  ratio: number;
  format: string;
  /** URL après redirections : c'est elle qui sera enregistrée. */
  finalUrl: string;
};

function fileName(url: string): string {
  try {
    const parsed = new URL(url);
    // Le nom de fichier n'est pas toujours le dernier segment : Fandom insère
    // `/revision/latest/scale-to-width-down/720` après « MaRender.png ».
    const segments = parsed.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    return segments.join("/");
  } catch {
    return url;
  }
}

function reject(url: string, reason: string, status = 0, contentType = ""): Verdict {
  return {
    url,
    ok: false,
    reason,
    status,
    contentType,
    width: 0,
    height: 0,
    ratio: 0,
    format: "",
    finalUrl: url,
  };
}

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Nom du fichier média cité par l'URL (« BlankRender.png »).
 *
 * Fandom et Wikimedia ajoutent des segments après le fichier
 * (`/revision/latest/scale-to-width-down/720`, `/960px-BlankRender.png`) : on
 * retient donc le premier segment qui ressemble à une image, pas le dernier.
 */
export function assetName(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean).map(decodeURIComponent);
    return segments.find((segment) => /\.(png|jpe?g|webp|gif)$/i.test(segment)) ?? "";
  } catch {
    return "";
  }
}

/** Nom de fichier refusé d'office (logo, icône, bannière, carte, placeholder). */
export function blockedName(url: string): boolean {
  return BLOCKED.test(fileName(url));
}

/**
 * Télécharge l'en-tête de l'image et applique toutes les règles.
 * `fresh` force une nouvelle requête (image qui a pu changer depuis le cache).
 */
export async function inspectImage(
  url: string,
  options: { fresh?: boolean; minSide?: number; minRatio?: number; allowBlockedName?: boolean } = {},
): Promise<Verdict> {
  const minSide = options.minSide ?? MIN_SIDE;
  const minRatio = options.minRatio ?? MIN_RATIO;
  if (!isHttpUrl(url)) return reject(url, "URL absente ou non http(s)");
  if (/\.svg(\?|$)/i.test(url)) return reject(url, "SVG refusé");
  if (!options.allowBlockedName && blockedName(url)) {
    return reject(url, `nom de fichier refusé (${fileName(url)})`);
  }

  let fetched;
  try {
    fetched = await get(url, { fresh: options.fresh });
  } catch (error) {
    return reject(url, `réseau : ${(error as Error).message}`);
  }

  const { status, contentType, bytes } = fetched;
  if (status !== 200) return reject(url, `HTTP ${status}`, status, contentType);
  if (!/^image\/(jpeg|png|webp|gif)/i.test(contentType)) {
    return reject(url, `type non image (${contentType || "inconnu"})`, status, contentType);
  }

  const size = readSize(bytes);
  if (!size) return reject(url, "contenu illisible (format non reconnu)", status, contentType);
  if (size.animated) return reject(url, "image animée refusée", status, contentType);
  if (size.width < minSide || size.height < minSide) {
    return reject(url, `trop petite (${size.width}×${size.height})`, status, contentType);
  }
  const ratio = size.width / size.height;
  if (ratio < minRatio || ratio > MAX_RATIO) {
    return reject(url, `rapport hors bornes (${ratio.toFixed(2)})`, status, contentType);
  }

  return {
    url,
    ok: true,
    reason: "valide",
    status,
    contentType,
    width: size.width,
    height: size.height,
    ratio: Math.round(ratio * 100) / 100,
    format: size.format,
    finalUrl: url,
  };
}

/**
 * Le nom du personnage apparaît-il dans le nom de fichier ?
 * Un visuel d'infobox le porte presque toujours ; une photo sans rapport
 * (« Broye_2003-05-05.jpg » pour Maflon) ne le porte pas.
 */
export function namesCharacter(url: string, name: string): boolean {
  const tokens = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !["the", "der", "les", "des"].includes(token));
  if (tokens.length === 0) return true;
  const haystack = fileName(url)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return tokens.some((token) => haystack.includes(token));
}

/** Clé de déduplication : même fichier servi par deux URLs de vignette. */
export function dedupeKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${decodeURIComponent(parsed.pathname)}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
