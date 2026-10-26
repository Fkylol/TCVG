"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openPack } from "@/app/actions";
import { getCard } from "@/lib/cards";
import { BoosterPack } from "@/components/booster-pack";
import { BoosterReveal, type RevealItem } from "@/components/booster-reveal";
import { getPack } from "@/lib/packs";
import { setPendingReveal, usePendingReveal } from "@/lib/reveal-queue";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  RARITY,
  RARITY_ORDER,
  formatCountdown,
  formatPercent,
  projectedStock,
} from "@/lib/game";

export function BoosterStation({
  initialStock,
  initialAnchor,
  serverNow,
  boostersOpened,
  uniqueOwned,
  totalCards,
}: {
  initialStock: number;
  initialAnchor: string | null;
  /** Horodatage serveur : évite tout décalage d'hydratation avec le compte à rebours. */
  serverNow: number;
  boostersOpened: number;
  uniqueOwned: number;
  totalCards: number;
}) {
  const router = useRouter();
  const [stock, setStock] = useState(initialStock);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [now, setNow] = useState(serverNow);
  // Révélation hors composant : elle survit à un remontage pendant l'ouverture.
  const reveal = usePendingReveal();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Verrou synchrone contre le double-clic : un seul tirage par ouverture.
  const busy = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { stock: available, nextAt } = projectedStock(stock, anchor, now);
  const nextIn = nextAt === null ? null : Math.max(0, nextAt - now);
  const full = available >= BOOSTER_STOCK_MAX;
  const mix = getPack("mix");

  async function open() {
    if (busy.current) return;
    busy.current = true;
    setOpening(true);
    setError(null);

    // Pas d'attente artificielle ni de `router.refresh()` ici : la révélation
    // s'ouvre dès que le serveur a répondu, et l'accueil se relit à la
    // fermeture, quand l'animation ne tourne plus.
    const result = await openPack("mix");

    if (result.status === "ok") {
      // Le serveur a déjà écrit les cartes : l'animation ne fait que révéler.
      const items: RevealItem[] = result.cards.flatMap((entry) => {
        const card = getCard(entry.id);
        return card
          ? [
              {
                card,
                holo: entry.holo,
                isNew: entry.isNew,
                quantity: entry.quantity,
                variant: entry.variant,
              },
            ]
          : [];
      });
      setPendingReveal({ items, packId: "mix", opened: 1 });
      setStock(result.stock);
      setAnchor(result.anchor);
      setNow(result.serverNow);
    } else if (result.status === "empty") {
      setStock(result.stock);
      setAnchor(result.anchor);
      setError(result.message);
    } else {
      setError(result.message);
    }

    busy.current = false;
    setOpening(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section>
        {reveal && mix ? (
          <BoosterReveal
            title="Booster ouvert"
            subtitle={`${reveal.items.length} carte${reveal.items.length > 1 ? "s" : ""}`}
            items={reveal.items}
            pack={mix}
            onClose={() => {
              setPendingReveal(null);
              router.refresh();
            }}
            closeLabel="Retour"
          />
        ) : (
          <div className="panel panel-accent flex flex-col items-center justify-center px-6 py-10 text-center">
            <button
              type="button"
              onClick={open}
              disabled={available < 1 || opening}
              aria-label="Ouvrir un booster"
              className="group relative disabled:cursor-not-allowed"
            >
              <div
                className={`relative w-40 transition sm:w-44 ${
                  opening ? "scale-95 opacity-40" : ""
                }`}
              >
                {mix && (
                  <BoosterPack
                    pack={mix}
                    float={available > 0 && !opening}
                    locked={available < 1}
                  />
                )}
                {available > 0 && (
                  <span className="chip absolute right-0 top-2 z-10 bg-black/70 text-[11px] font-semibold text-white">
                    ×{available}
                  </span>
                )}
              </div>
            </button>

            <div className="mt-6 flex items-center gap-1.5" aria-label={`Stock : ${available} sur ${BOOSTER_STOCK_MAX}`}>
              {Array.from({ length: BOOSTER_STOCK_MAX }, (_, index) => (
                <span
                  key={index}
                  className={`h-2 w-5 transition ${
                    index < available ? "bg-acid" : "bg-white/12"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-xs text-white/45">
              Stock {available}/{BOOSTER_STOCK_MAX}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={open}
                disabled={available < 1 || opening}
                className="btn btn-primary"
              >
                {opening ? "Ouverture…" : available < 1 ? "Aucun booster" : "Ouvrir un booster"}
              </button>
            </div>

            <p className="mt-4 text-xs text-white/45">
              {full
                ? "Stock plein — ouvre avant de continuer à accumuler."
                : nextIn !== null
                  ? `Prochain booster dans ${formatCountdown(nextIn)}`
                  : `Un booster toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes, jusqu'à ${BOOSTER_STOCK_MAX}.`}
            </p>

            {error && (
              <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <div className="panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Collection</p>
          <p className="mt-2 font-mono text-3xl font-semibold">
            {uniqueOwned}
            <span className="text-base font-normal text-white/40"> / {totalCards}</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden bg-white/10">
            <div
              className="h-full bg-acid"
              style={{ width: `${Math.min(100, Math.round((uniqueOwned / totalCards) * 100))}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-white/45">{boostersOpened} booster(s) ouvert(s)</p>
        </div>

        <div className="panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Chances par carte</p>
          <ul className="mt-3 space-y-2">
            {RARITY_ORDER.map((key) => {
              const info = RARITY[key];
              return (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span className={`flex items-center gap-2 ${info.text}`}>
                    <span className={`chip px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                      {info.short}
                    </span>
                    {info.label}
                  </span>
                  <span className="font-mono text-white/55">
                    {formatPercent(info.weight / 1000)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
