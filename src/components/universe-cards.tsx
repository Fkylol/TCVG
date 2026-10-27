"use client";

import Link from "next/link";
import { useState } from "react";
import { loadUniverseCards, type UniverseTile } from "@/app/actions";
import { CardFace } from "@/components/card-face";
import { RARITY } from "@/lib/game";

/**
 * Autres personnages de la franchise.
 *
 * Six tuiles au départ, puis des lots de six servis par `loadUniverseCards()` :
 * le navigateur ne reçoit jamais toute la franchise d'un coup. Les noms et les
 * visuels sont publics ; seules les cartes du joueur sont en couleur.
 */
export function UniverseCards({
  cardId,
  universe,
  initial,
  total,
}: {
  cardId: string;
  universe: string;
  initial: UniverseTile[];
  /** Nombre de cartes de la franchise, hors carte courante. */
  total: number;
}) {
  const [tiles, setTiles] = useState<UniverseTile[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, total - tiles.length);

  async function loadMore() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await loadUniverseCards(cardId, tiles.length);

    if (result.status === "ok") {
      setTiles((previous) => [...previous, ...result.tiles]);
    } else {
      setError(result.message);
    }

    setBusy(false);
  }

  return (
    <section id="meme-univers" className="mt-12 scroll-mt-24">
      <span className="eyebrow">Franchise</span>
      <h2 className="display mt-2 text-3xl">Autres persos de {universe}</h2>
      <span className="title-rule" aria-hidden />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {tiles.map(({ card, owned }) => {
          const info = RARITY[card.rarity];

          return (
            <Link
              key={card.id}
              href={`/card/${card.id}`}
              className="group block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/70"
            >
              <CardFace
                card={card}
                size="sm"
                className={`aspect-[3/4] transition group-hover:-translate-y-0.5 ${
                  owned ? "" : "opacity-45 grayscale"
                }`}
              />
              <p className="mt-1.5 truncate text-xs text-white/75">{card.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/35">
                {info.label}
                {owned ? "" : " · à trouver"}
              </p>
            </Link>
          );
        })}
      </div>

      {error && (
        <p role="status" className="mt-3 text-[11px] text-amber-200/80">
          {error}
        </p>
      )}

      {remaining > 0 && (
        <button type="button" onClick={() => void loadMore()} disabled={busy} className="btn btn-outline btn-sm mt-4">
          {busy ? "Chargement…" : `Voir plus · ${remaining} restant${remaining > 1 ? "s" : ""}`}
        </button>
      )}
    </section>
  );
}
