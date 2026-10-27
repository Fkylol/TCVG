/**
 * Préférence d'animation du joueur.
 *
 * Par défaut (`full`), les effets du jeu tournent toujours — y compris quand
 * l'appareil est en économie d'énergie. C'est volontaire : beaucoup de
 * téléphones et de navigateurs passent `prefers-reduced-motion: reduce` dès
 * que le mode éco ou « supprimer les animations » est actif, ce qui éteignait
 * toute l'ouverture des boosters, les auras et les cadres animés.
 *
 * `auto` rend la main au système : les animations sont alors réduites si
 * l'appareil le demande (les blocs `@media` de `globals.css` ne s'appliquent
 * qu'à ce mode).
 *
 * La préférence vit dans le navigateur (`localStorage`) : elle n'a pas à
 * voyager avec le compte, et l'attribut `data-motion` de `<html>` la rend
 * lisible par le CSS comme par les composants, sans rendu serveur.
 */

export const MOTION_KEY = "tcvg:motion";

export type MotionPreference = "full" | "auto";

/** Mode par défaut : les animations tournent partout. */
export const MOTION_DEFAULT: MotionPreference = "full";

/** Événement émis quand le joueur change de mode (même onglet). */
export const MOTION_EVENT = "tcvg:motion";

/**
 * Script d'amorçage, avant le premier rendu : sans lui, la page sortirait en
 * `full` puis basculerait en `auto`, et une animation démarrerait pour rien.
 */
export const MOTION_BOOT_SCRIPT =
  `try{var m=localStorage.getItem("${MOTION_KEY}");` +
  `document.documentElement.dataset.motion=m==="auto"?"auto":"${MOTION_DEFAULT}"}` +
  `catch(e){document.documentElement.dataset.motion="${MOTION_DEFAULT}"}`;

/** Préférence enregistrée dans ce navigateur. */
export function readMotionPreference(): MotionPreference {
  if (typeof window === "undefined") return MOTION_DEFAULT;
  try {
    return window.localStorage.getItem(MOTION_KEY) === "auto" ? "auto" : MOTION_DEFAULT;
  } catch {
    return MOTION_DEFAULT;
  }
}

/** Vrai quand le joueur a demandé les animations complètes. */
export function isMotionForced(): boolean {
  if (typeof document === "undefined") return MOTION_DEFAULT === "full";
  return document.documentElement.dataset.motion !== "auto";
}

/** Enregistre la préférence et prévient la page (CSS et composants). */
export function setMotionPreference(preference: MotionPreference): void {
  if (typeof document === "undefined") return;
  try {
    window.localStorage.setItem(MOTION_KEY, preference);
  } catch {
    // Navigation privée sans stockage : le mode vaut pour la page en cours.
  }
  document.documentElement.dataset.motion = preference;
  window.dispatchEvent(new Event(MOTION_EVENT));
}
