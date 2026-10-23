"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openBoosters } from "@/app/actions";
import { CardFace } from "@/components/card-face";
import type { Card } from "@/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  RARITY,
  formatCountdown,
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
  const [drawn, setDrawn] = useState<Card[] | null>(null);
  const [openedCount, setOpenedCount] = useState(0);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { stock: available, nextAt } = projectedStock(stock, anchor, now);
  const nextIn = nextAt === null ? null : Math.max(0, nextAt - now);
  const full = available >= BOOSTER_STOCK_MAX;

  async function open(count: number) {
    if (opening || count < 1) return;
    setOpening(true);
    setError(null);

    const [result] = await Promise.all([
      openBoosters(count),
      new Promise((resolve) => setTimeout(resolve, 550)),
    ]);

    if (result.status === "ok") {
      setDrawn(result.cards);
      setOpenedCount(result.opened);
      setNewIds(result.newIds);
      setStock(result.stock);
      setAnchor(result.anchor);
      router.refresh();
    } else if (result.status === "empty") {
      setStock(result.stock);
      setAnchor(result.anchor);
      setError(result.message);
    } else {
      setError(result.message);
    }

    setOpening(false);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section>
        {drawn ? (
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white/90">
                {openedCount} booster{openedCount > 1 ? "s" : ""} ouvert{openedCount > 1 ? "s" : ""} ·{" "}
                {drawn.length} cartes
                {newIds.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-emerald-300">
                    dont {newIds.length} nouvelle{newIds.length > 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setDrawn(null)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Retour
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {drawn.map((card, index) => (
                <Link
                  key={`${card.id}-${index}`}
                  href={`/card/${card.id}`}
                  className="card-deal block"
                  style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}
                >
                  <div className="relative">
                    <CardFace card={card} size="sm" className="aspect-[3/4]" />
                    {newIds.includes(card.id) && (
                      <span className="absolute -top-1.5 left-2 z-10 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950 shadow-lg">
                        Nouveau
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
            <button
              type="button"
              onClick={() => open(1)}
              disabled={available < 1 || opening}
              aria-label="Ouvrir un booster"
              className="group relative disabled:cursor-not-allowed"
            >
              {/* Visuel du booster : découpé depuis `booster1.jpg`, ratio 0,6.
                  `unoptimized` évite de dépendre de l'optimiseur d'images du Worker. */}
              <div
                className={`relative h-60 w-36 overflow-hidden rounded-2xl border border-white/25 shadow-2xl transition ${
                  opening
                    ? "scale-95 opacity-40"
                    : available > 0
                      ? "pack-float hover:scale-[1.03]"
                      : "opacity-50 grayscale"
                }`}
              >
                <Image
                  src="/booster/mix.jpg"
                  alt="Booster TCVG"
                  fill
                  sizes="144px"
                  unoptimized
                  className="object-cover"
                />
                {available > 0 && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-white/20">
                    ×{available}
                  </span>
                )}
              </div>
            </button>

            <div className="mt-6 flex items-center gap-1.5" aria-label={`Stock : ${available} sur ${BOOSTER_STOCK_MAX}`}>
              {Array.from({ length: BOOSTER_STOCK_MAX }, (_, index) => (
                <span
                  key={index}
                  className={`h-2 w-5 rounded-full transition ${
                    index < available ? "bg-acid" : "bg-white/12"
                  }`}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-white/45">
              Stock {available}/{BOOSTER_STOCK_MAX}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => open(1)}
                disabled={available < 1 || opening}
                className="rounded-full bg-acid px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/45"
              >
                {opening ? "Ouverture…" : available < 1 ? "Aucun booster" : "Ouvrir un booster"}
              </button>

              {available > 1 && (
                <button
                  type="button"
                  onClick={() => open(available)}
                  disabled={opening}
                  className="rounded-full border border-acid/40 bg-acid/10 px-6 py-3 text-sm font-semibold text-acid transition hover:bg-acid/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tout ouvrir ({available})
                </button>
              )}
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Collection</p>
          <p className="mt-2 text-3xl font-bold">
            {uniqueOwned}
            <span className="text-base font-normal text-white/40"> / {totalCards}</span>
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-acid to-cyan"
              style={{ width: `${Math.min(100, Math.round((uniqueOwned / totalCards) * 100))}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-white/45">{boostersOpened} booster(s) ouvert(s)</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Chances par carte</p>
          <ul className="mt-3 space-y-2">
            {(["L", "UR", "SR", "R", "C"] as const).map((key) => {
              const info = RARITY[key];
              return (
                <li key={key} className="flex items-center justify-between text-sm">
                  <span className={`flex items-center gap-2 ${info.text}`}>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                      {info.short}
                    </span>
                    {info.label}
                  </span>
                  <span className="font-mono text-white/55">{(info.weight / 10).toFixed(1)} %</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
