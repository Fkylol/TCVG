/**
 * Palette des dos de carte.
 *
 * Même dessin pour tous les packs (voir `components/card-back.tsx`) : seul le
 * jeu de couleurs change. Le dos standard est violet, celui du mockup, et sert
 * de repli quand aucun pack n'est connu ; sinon le dos reprend exactement les
 * couleurs du pack ouvert, comme son poster.
 *
 * C'est le seul fichier à toucher pour retoucher un dos : le cadre, le
 * treillis, les anneaux, le médaillon et le wordmark lisent tous ces valeurs.
 */

import type { Pack } from "./packs";

export type CardBackColors = {
  /** Haut du dégradé de fond (162°). */
  t1: string;
  /** Bas du dégradé de fond. */
  t2: string;
  /** Encre du wordmark TCVG. */
  ink: string;
  /** Couleur de l'emblème du médaillon. */
  gl: string;
  /** Trait du treillis et des anneaux. */
  tx: string;
  /** Trait du cadre, des coins et des pastilles. */
  ln: string;
};

/** Dos standard : violet profond, éclairé au cyan du site. */
export const STANDARD_BACK: CardBackColors = {
  t1: "#6a56d6",
  t2: "#171233",
  ink: "#f1eeff",
  gl: "#36e2ff",
  tx: "rgba(255, 255, 255, 0.15)",
  ln: "rgba(255, 255, 255, 0.42)",
};

/**
 * Trait du cadre et des coins, commun à tous les dos.
 *
 * Les traits du poster varient d'un pack à l'autre (`colors.tx`) ; le cadre du
 * dos reste un blanc franc et unique, sinon les fonds clairs (Mix, Plateforme)
 * perdaient leur liseré.
 */
const FRAME_LINE = "rgba(255, 255, 255, 0.55)";

/** Dos d'un pack : ses couleurs de poster, à l'identique. */
export function backColorsFor(pack: Pack | null | undefined): CardBackColors {
  if (!pack) return STANDARD_BACK;
  return {
    t1: pack.colors.t1,
    t2: pack.colors.t2,
    ink: pack.colors.ink,
    gl: pack.colors.gl,
    tx: pack.colors.tx,
    ln: FRAME_LINE,
  };
}
