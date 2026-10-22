"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openBooster } from "@/app/actions";
import { CardFace } from "@/components/card-face";
import type { Card } from "@/lib/cards";
import { BOOSTER_COOLDOWN_MS, CARDS_PER_BOOSTER, RARITY, formatCountdown } from "@/lib/game";

export function BoosterStation({
  initialNextAt,
  serverNow,
  boostersOpened,
  uniqueOwned,
  totalCards,
}: {
  initialNextAt: string | null;
  /** Horodatage serveur : évite tout décalage d'hydratation avec le compte à rebours. */
  serverNow: number;
  boostersOpened: number;
  uniqueOwned: number;
  totalCards: number;
}) {
  const router = useRouter();
  const [nextAt, setNextAt] = useState(initialNextAt);
  // Initialisé avec l'heure du serveur pour un premier rendu identique côté client.
  const [now, setNow] = useState(serverNow);
  const [drawn, setDrawn] = useState<Card[] | null>(null);
  const [newIds, setNewIds] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextTs = nextAt ? new Date(nextAt).getTime() : 0;
  const remaining = nextTs === 0 ? 0 : Math.max(0, nextTs - now);
  const ready = remaining === 0;

  async function handleOpen() {
    if (opening || !ready) return;
    setOpening(true);
    setError(null);

    const [result] = await Promise.all([
      openBooster(),
      new Promise((resolve) => setTimeout(resolve, 650)),
    ]);

    if (result.status === "ok") {
      setDrawn(result.cards);
      setNewIds(result.newIds);
      setNextAt(result.nextAt);
      router.refresh();
    } else {
      if (result.status === "cooldown") setNextAt(result.nextAt);
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
                {drawn.filter((c) => newIds.includes(c.id)).length > 0
                  ? "Nouvelles cartes !"
                  : "Booster ouvert"}
              </h2>
              <button
                type="button"
                onClick={() => setDrawn(null)}
                className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/70 transition hover:border-white/30 hover:text-white"
              >
                Retour au pack
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {drawn.map((card, index) => (
                <Link
                  key={`${card.id}-${index}`}
                  href={`/card/${card.id}`}
                  className="card-deal block"
                  style={{ animationDelay: `${index * 130}ms` }}
                >
                  <div className="relative">
                    <CardFace card={card} size="md" className="aspect-[3/4]" />
                    {newIds.includes(card.id) && (
                      <span className="absolute -top-2 left-3 z-10 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-950 shadow-lg">
                        Nouveau
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            <button
              type="button"
              onClick={handleOpen}
              disabled={!ready || opening}
              aria-label="Ouvrir un booster"
              className="group relative disabled:cursor-not-allowed"
            >
              <div
                className={`relative grid h-64 w-44 place-items-center overflow-hidden rounded-2xl border border-white/25 shadow-2xl transition ${
                  opening ? "scale-95 opacity-40" : ready ? "pack-float hover:scale-[1.03]" : "opacity-50 grayscale"
                }`}
                style={{
                  background:
                    "linear-gradient(160deg, #6d28d9 0%, #4c1d95 40%, #1e1b4b 70%, #0ea5e9 100%)",
                }}
              >
                <div className="grain absolute inset-0 opacity-40" />
                <div className="holo absolute inset-0" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <span className="text-5xl">🎴</span>
                  <span className="rarity-shine text-lg font-black tracking-[0.2em]">TCVG</span>
                  <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
                    Booster ×{CARDS_PER_BOOSTER}
                  </span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleOpen}
              disabled={!ready || opening}
              className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/50"
            >
              {opening
                ? "Ouverture…"
                : ready
                  ? "Ouvrir un booster"
                  : `Disponible dans ${formatCountdown(remaining)}`}
            </button>

            <p className="mt-3 text-xs text-white/45">
              Un booster gratuit toutes les {Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes.
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
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400"
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
