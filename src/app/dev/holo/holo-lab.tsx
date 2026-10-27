"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { CardFace, type CardVariant } from "@/components/card-face";
import type { Card, Rarity } from "@/lib/cards";
import { RARITY } from "@/lib/game";

/**
 * Banc d'essai des cartes : intensité d'effet réglable, six raretés côte à
 * côte, puis les variantes misprint. L'inclinaison est désactivée (`tilt`
 * faux) pour que le CSS lise `--lab-intensity` au lieu des variables écrites
 * au survol.
 */
export function HoloLab({
  samples,
  variants,
}: {
  samples: { rarity: Rarity; card: Card }[];
  variants: CardVariant[];
}) {
  const [intensity, setIntensity] = useState(0.85);
  const style = { "--lab-intensity": String(intensity) } as CSSProperties;

  return (
    <div className="holo-lab mt-8" style={style}>
      <div className="flex flex-wrap items-center gap-3 border border-white/10 bg-white/[0.02] px-4 py-3">
        <label htmlFor="holo-intensity" className="font-mono text-xs text-white/55">
          Intensité
        </label>
        <input
          id="holo-intensity"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={intensity}
          onChange={(event) => setIntensity(Number(event.target.value))}
          className="h-1 w-48 accent-cyan"
        />
        <span className="font-mono text-xs text-white/70">{intensity.toFixed(2)}</span>
      </div>

      <h2 className="display mt-8 text-xl">Raretés</h2>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {samples.map(({ rarity, card }) => (
          <li key={rarity} className="flex flex-col gap-2">
            <CardFace card={card} size="md" tilt={false} className="aspect-[3/4]" />
            <p className="font-mono text-[11px] text-white/50">
              {RARITY[rarity].label} · {rarity}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="display mt-10 text-xl">Variantes misprint</h2>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {variants.map((variant) => {
          const sample = samples.find((entry) => entry.rarity === "L") ?? samples[0];
          return (
            <li key={variant} className="flex flex-col gap-2">
              <CardFace
                card={sample.card}
                size="md"
                tilt={false}
                variant={variant}
                className="aspect-[3/4]"
              />
              <p className="font-mono text-[11px] text-white/50">{variant}</p>
            </li>
          );
        })}
      </ul>

      <h2 className="display mt-10 text-xl">Non possédée</h2>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <li>
          <CardFace
            card={samples[0].card}
            size="md"
            tilt={false}
            muted
            className="aspect-[3/4]"
          />
        </li>
      </ul>
    </div>
  );
}
