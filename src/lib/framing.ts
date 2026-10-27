/**
 * Cadrage d'un visuel de carte : quelle partie de l'image tient dans la
 * fenêtre, et à quel grossissement.
 *
 * Une carte est verticale et un artwork ne l'est pas toujours : sans réglage,
 * `object-fit: cover` centre l'image et coupe la tête d'un personnage ou ne
 * garde que le ciel. Le cadrage se règle donc au cas par cas — à la main dans
 * `portraits.ts` (`PORTRAIT_FRAMING`) pour les visuels du catalogue, et à la
 * souris dans l'atelier pour les nouveaux.
 *
 * Aucune I/O ici : ces fonctions servent au rendu, à l'atelier et aux tests.
 */

import type { CSSProperties } from "react";

export type PortraitFraming = {
  /** `cover` remplit le cadre (quitte à rogner), `contain` garde tout. */
  objectFit: "cover" | "contain";
  /** Position de la fenêtre dans l'image, en pourcentage : « 50% 0% ». */
  objectPosition: string;
  /** Grossissement, de 1 (aucun) à 3. Absent = 1. */
  zoom?: number;
};

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

/** Cadrage par défaut : haut-centre, adapté aux portraits debout. */
export const DEFAULT_FRAMING: PortraitFraming = {
  objectFit: "cover",
  objectPosition: "50% 0%",
};

const POSITION = /^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Coordonnées d'une position CSS, bornées à la fenêtre. */
export function parsePosition(value: string): { x: number; y: number } {
  const match = POSITION.exec((value ?? "").trim());
  if (!match) return parsePosition(DEFAULT_FRAMING.objectPosition);
  return { x: clamp(Number(match[1]), 0, 100), y: clamp(Number(match[2]), 0, 100) };
}

/** Position CSS à partir de coordonnées, au dixième de pourcent. */
export function formatPosition(x: number, y: number): string {
  return `${round(clamp(x, 0, 100))}% ${round(clamp(y, 0, 100))}%`;
}

/**
 * Cadrage valide et complet, à partir de données éventuellement partielles :
 * c'est le point d'entrée de tout ce qui lit un cadrage (données, formulaire,
 * rendu). `zoom` n'est écrit que s'il vaut plus de 1, pour que le cadrage par
 * défaut reste exactement `{ cover, 50% 0% }`.
 */
export function clampFraming(input?: Partial<PortraitFraming> | null): PortraitFraming {
  const objectFit = input?.objectFit === "contain" ? "contain" : "cover";
  const { x, y } = parsePosition(input?.objectPosition ?? DEFAULT_FRAMING.objectPosition);
  const rawZoom = Number(input?.zoom ?? 1);
  const zoom = clamp(Number.isFinite(rawZoom) ? rawZoom : 1, MIN_ZOOM, MAX_ZOOM);

  return {
    objectFit,
    objectPosition: formatPosition(x, y),
    ...(zoom > 1 ? { zoom: Math.round(zoom * 100) / 100 } : {}),
  };
}

/**
 * Déplace le cadrage d'un geste, exprimé en fraction de la fenêtre.
 *
 * `dx`/`dy` valent +1 quand le pointeur a parcouru toute la largeur (ou la
 * hauteur) du cadre. L'image suit le doigt : tirer vers la droite découvre la
 * gauche, donc la position diminue. Le déplacement est divisé par le
 * grossissement, sinon un zoom fort rendrait le geste incontrôlable.
 */
export function panFraming(
  framing: Partial<PortraitFraming> | null | undefined,
  dx: number,
  dy: number,
): PortraitFraming {
  const current = clampFraming(framing);
  const { x, y } = parsePosition(current.objectPosition);
  const zoom = current.zoom ?? 1;
  return clampFraming({
    ...current,
    objectPosition: formatPosition(x - (dx * 100) / zoom, y - (dy * 100) / zoom),
  });
}

/** Change le grossissement, en gardant la position. */
export function zoomFraming(
  framing: Partial<PortraitFraming> | null | undefined,
  zoom: number,
): PortraitFraming {
  return clampFraming({ ...clampFraming(framing), zoom });
}

/** Bascule entre « remplir le cadre » et « garder toute l'image ». */
export function fitFraming(framing: Partial<PortraitFraming> | null | undefined): PortraitFraming {
  const current = clampFraming(framing);
  return clampFraming({
    ...current,
    objectFit: current.objectFit === "cover" ? "contain" : "cover",
  });
}

/**
 * Style CSS à poser sur l'image.
 *
 * Le zoom passe par `transform`, pas par `width` : l'image reste remplie par
 * Next, et l'agrandissement part de la position choisie, qui ne bouge donc pas.
 */
export function framingStyle(framing?: PortraitFraming | null): CSSProperties {
  const current = clampFraming(framing);
  const style: CSSProperties = {
    objectFit: current.objectFit,
    objectPosition: current.objectPosition,
  };
  if (current.zoom && current.zoom > 1) {
    style.transform = `scale(${current.zoom})`;
    style.transformOrigin = current.objectPosition;
  }
  return style;
}
