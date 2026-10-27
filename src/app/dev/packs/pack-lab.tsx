"use client";

import { useState } from "react";

import { BoosterPack } from "@/components/booster-pack";
import { CARDS_PER_BOOSTER } from "@/lib/game";
import { MIN_POOL_SIZE, PACKS } from "@/lib/packs";

/**
 * Planche de contrôle : les douze posters à la même taille, avec un fond clair
 * ou sombre et un pack indisponible simulé.
 *
 * Les posters sont `interactive` : focusables au clavier, sans bouton parent.
 * Aucun appel à `openPack` ici — la planche ne touche ni au stock ni au tirage.
 */
export function PackLab() {
  const [light, setLight] = useState(false);
  const [locked, setLocked] = useState(false);

  return (
    <div className="mt-7">
      <div className="toolbar">
        <div className="flex gap-2" role="group" aria-label="Fond de la planche">
          <button
            type="button"
            className={`btn btn-sm ${light ? "btn-outline" : "btn-cyan"}`}
            aria-pressed={!light}
            onClick={() => setLight(false)}
          >
            Fond sombre
          </button>
          <button
            type="button"
            className={`btn btn-sm ${light ? "btn-cyan" : "btn-outline"}`}
            aria-pressed={light}
            onClick={() => setLight(true)}
          >
            Fond clair
          </button>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          aria-pressed={locked}
          onClick={() => setLocked((value) => !value)}
        >
          {locked ? "Rétablir la disponibilité" : "Simuler un pack indisponible"}
        </button>

        <span className="ml-auto font-mono text-[11px] text-white/40">
          {PACKS.length} packs · {CARDS_PER_BOOSTER} cartes
        </span>
      </div>

      <div
        className={`mt-4 border p-4 sm:p-6 ${
          light
            ? "border-black/10 bg-[#ecebe5] text-[#161616]"
            : "border-white/10 bg-[#101110] text-white"
        }`}
      >
        <ul className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 xl:grid-cols-4">
          {PACKS.map((pack, index) => {
            const unavailable = locked && index === 1;

            return (
              <li key={pack.id} className="flex flex-col">
                <BoosterPack pack={pack} locked={unavailable} interactive showPrice />

                <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] opacity-60">
                  N°{String(index + 1).padStart(2, "0")} · {pack.name}
                </p>
                <p className="text-center font-mono text-[10px] opacity-40">
                  {pack.tilt.bx}° / {pack.tilt.by}° · {pack.titleSize} cqw
                </p>
                {unavailable && (
                  <p className="mt-1 text-center font-mono text-[10px] opacity-70">
                    Bientôt · {MIN_POOL_SIZE - 6} / {MIN_POOL_SIZE} persos
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
