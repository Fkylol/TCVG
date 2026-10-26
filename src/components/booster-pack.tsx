"use client";

import type { CSSProperties } from "react";

import { PackEmblem, PackTexture } from "@/components/pack-art";
import { CARDS_PER_BOOSTER } from "@/lib/game";
import type { Pack } from "@/lib/packs";
import { useFitTitle } from "@/lib/use-fit-title";

const TEXTURE_VIEWBOX = "0 0 190 304";
const EMBLEM_VIEWBOX = "0 0 48 48";

/**
 * Une encre claire (blanche) a besoin d'un voile sombre en bas du pack pour
 * rester lisible sur les teintes claires ; une encre sombre s'en passe. */
function hasLightInk(hex: string): boolean {
  const value = hex.replace("#", "");
  if (value.length < 6) return false;
  const channels = [0, 2, 4].map((start) => {
    const channel = Number.parseInt(value.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2] > 0.45;
}

/**
 * Poster d'un booster : un objet DOM, pas une image. Le fond teinté, les bandes
 * crantées, l'emblème et la texture sont dessinés ; `container-type:
 * inline-size` et les unités `cqw` font suivre la typographie à la largeur.
 *
 * L'inclinaison au repos vient de `--bx` / `--by` (définis par pack) et le
 * survol redresse le poster : aucun suivi du pointeur, aucun gyroscope.
 *
 * Le composant ne porte pas de bouton : par défaut la page qui l'affiche
 * fournit le contrôle cliquable et son `aria-label`. `interactive` le rend
 * lui-même focusable (planche `/dev/packs`), à n'utiliser que hors d'un bouton
 * parent pour ne pas imbriquer deux contrôles.
 */
export function BoosterPack({
  pack,
  locked = false,
  float = false,
  selected = false,
  interactive = false,
  showPrice = true,
  flat = false,
  className = "",
}: {
  pack: Pack;
  /** Pack « Bientôt » : désaturé, il ne se redresse pas. */
  locked?: boolean;
  /** Léger flottement, pour la station d'ouverture. */
  float?: boolean;
  /** Pack choisi sur la page Boosters : il reste droit et soulevé. */
  selected?: boolean;
  /** Rend le poster focusable (planche de contrôle uniquement). */
  interactive?: boolean;
  /** Affiche « Gratuit » sous le pack. */
  showPrice?: boolean;
  /** Poster droit et figé (révélation, vignette dans un panneau). */
  flat?: boolean;
  className?: string;
}) {
  const { frameRef, titleRef, subtitleRef } = useFitTitle(0.8);
  const veil = hasLightInk(pack.colors.ink) ? "rgba(8, 9, 14, 0.32)" : "rgba(8, 9, 14, 0)";

  // « Action-aventure » se compose sur deux lignes, à la césure naturelle.
  const titleLines = pack.name.split("-");

  const vars = {
    "--pack-t1": pack.colors.t1,
    "--pack-t2": pack.colors.t2,
    "--pack-ink": pack.colors.ink,
    "--pack-gl": pack.colors.gl,
    "--pack-glow": pack.colors.glow,
    "--pack-tx": pack.colors.tx,
    "--pack-tx2": pack.colors.tx2 ?? pack.colors.tx,
    "--pack-veil": veil,
    "--bx": `${pack.tilt.bx}deg`,
    "--by": `${pack.tilt.by}deg`,
    "--title-size": pack.titleSize,
  } as CSSProperties;

  return (
    <span
      ref={frameRef}
      className={`pack-frame ${float ? "pack-float" : ""} ${className}`.trim()}
    >
      <span
        className="pack-poster"
        style={vars}
        data-locked={locked ? "true" : undefined}
        data-selected={selected ? "true" : undefined}
        data-flat={flat ? "true" : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive ? `Booster ${pack.name}, ${CARDS_PER_BOOSTER} cartes` : undefined
        }
        aria-disabled={interactive && locked ? "true" : undefined}
      >
        <span className="pack-band pack-band-top" aria-hidden />
        <span className="pack-band pack-band-bottom" aria-hidden />

        <svg
          className="pack-texture"
          viewBox={TEXTURE_VIEWBOX}
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
          focusable="false"
        >
          <PackTexture name={pack.texture} />
        </svg>

        <span className="pack-shade" aria-hidden />
        <span className="pack-sheen" aria-hidden />
        <span className="pack-folds" aria-hidden />

        <span className="pack-content">
          <span className="pack-mark">
            <span className="pack-mark-dot" aria-hidden />
            <span>TCVG</span>
          </span>

          <span className="pack-medallion" aria-hidden>
            <svg
              className="pack-emblem"
              viewBox={EMBLEM_VIEWBOX}
              fill="currentColor"
              focusable="false"
            >
              <PackEmblem name={pack.emblem} />
            </svg>
          </span>

          <span className="pack-title" ref={titleRef}>
            {titleLines.map((line) => (
              <span key={line} className="pack-title-line">
                {line}
              </span>
            ))}
          </span>

          <span className="pack-subtitle" ref={subtitleRef}>
            {pack.subtitle}
          </span>

          <span className="pack-count">{CARDS_PER_BOOSTER} cartes</span>
        </span>
      </span>

      {showPrice && <span className="pack-price">Gratuit</span>}
    </span>
  );
}
