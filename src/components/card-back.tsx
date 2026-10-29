"use client";

import { useId, type CSSProperties } from "react";

import { PackEmblem } from "@/components/pack-art";
import { backColorsFor, backOrnamentFor } from "@/lib/card-back";
import type { Pack } from "@/lib/packs";

/**
 * Dos de carte TCVG : médaillon en verre portant l'emblème et le wordmark, au
 * centre d'un cadre fin, d'un treillis de losanges et de quatre anneaux. Même
 * dessin pour tout le monde, teinté des couleurs du pack ouvert (`--cb-*`) ;
 * la lueur de rareté reste posée par `.rip-face-back`, à l'extérieur.
 *
 * Tout est dessiné en DOM — plus d'image raster à charger — et chaque mesure
 * suit la largeur du dos (`cqw`), donc la vignette de 34 px du pied de
 * révélation est une réduction exacte du grand dos.
 */

/** Anneaux concentriques, du plus petit au plus grand ; le dernier déborde. */
const RINGS = [69, 93, 120, 150];

/** Maille du treillis : un losange, ou la maille croisée d'une toile. */
const LATTICE_CELLS = {
  standard: "M0 15L15 0L30 15L15 30Z",
  halloween: "M0 15L15 0L30 15L15 30ZM15 0V30M0 15H30",
} as const;

/** Croix des quatre coins, posées sur le filet intérieur. */
const TICKS: [number, number][] = [
  [51, 57],
  [249, 63],
  [48, 337],
  [252, 331],
];

/** Pastilles des quatre angles. */
const DOTS: [number, number][] = [
  [39, 37],
  [261, 37],
  [39, 363],
  [261, 363],
];

/** Longueur d'une branche de croix, du centre vers le bout. */
const TICK_ARM = 9;

export function CardBack({
  pack,
  className,
}: {
  /** Pack ouvert : c'est lui qui donne ses couleurs au dos. */
  pack?: Pack | null;
  className?: string;
}) {
  const colors = backColorsFor(pack);
  const ornament = backOrnamentFor(pack);
  // Le treillis est un motif SVG : son identifiant doit être unique sur la
  // page, plusieurs dos cohabitent (la carte du dessus et les vignettes).
  const lattice = `card-back-lattice-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const vars = {
    "--cb-t1": colors.t1,
    "--cb-t2": colors.t2,
    "--cb-ink": colors.ink,
    "--cb-gl": colors.gl,
    "--cb-tx": colors.tx,
    "--cb-ln": colors.ln,
  } as CSSProperties;

  return (
    <span className={className ? `card-back ${className}` : "card-back"} style={vars} aria-hidden>
      <svg
        className="card-back-art"
        viewBox="0 0 300 400"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        aria-hidden
        focusable="false"
      >
        <defs>
          <pattern id={lattice} width="30" height="30" patternUnits="userSpaceOnUse">
            <path d={LATTICE_CELLS[ornament]} stroke="var(--cb-tx)" strokeWidth="1.5" />
          </pattern>
        </defs>

        <rect
          x="22"
          y="22"
          width="256"
          height="356"
          rx="10"
          fill={`url(#${lattice})`}
          opacity="0.75"
        />

        {RINGS.map((radius) => (
          <circle
            key={`ring-${radius}`}
            cx="150"
            cy="200"
            r={radius}
            stroke="var(--cb-tx)"
            strokeWidth="1.5"
          />
        ))}

        <rect x="14" y="14" width="272" height="372" rx="15" stroke="var(--cb-ln)" strokeWidth="2.1" />
        <rect x="22" y="22" width="256" height="356" rx="10" stroke="var(--cb-tx)" strokeWidth="1.5" />

        {TICKS.map(([x, y]) => (
          <path
            key={`tick-${x}-${y}`}
            d={`M${x} ${y - TICK_ARM}v${TICK_ARM * 2}M${x - TICK_ARM} ${y}h${TICK_ARM * 2}`}
            stroke="var(--cb-ln)"
            strokeWidth="2.1"
          />
        ))}

        {DOTS.map(([x, y]) => (
          <circle key={`dot-${x}-${y}`} cx={x} cy={y} r="3.6" fill="var(--cb-ln)" />
        ))}
      </svg>

      <span className="card-back-center">
        <span className="card-back-med">
          <span className="card-back-disc">
            {ornament === "halloween" ? (
              /* Le médaillon de la saison : la citrouille du pack, évidée dans
                 l'encre du disque. */
              <svg viewBox="0 0 48 48" fill="currentColor" aria-hidden focusable="false">
                <PackEmblem name="halloween" />
              </svg>
            ) : (
              <svg viewBox="0 0 48 48" aria-hidden focusable="false">
                <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
                <rect
                  x="14.5"
                  y="14.5"
                  width="19"
                  height="19"
                  rx="4"
                  transform="rotate(45 24 24)"
                  fill="currentColor"
                />
                <circle cx="24" cy="24" r="3.4" fill="#0b0b14" />
              </svg>
            )}
          </span>
        </span>
        <span className="card-back-word">TCVG</span>
      </span>

      <span className="card-back-sheen" />
    </span>
  );
}
