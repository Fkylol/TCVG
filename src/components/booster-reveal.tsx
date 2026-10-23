"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { CardFace } from "@/components/card-face";
import type { Card, Rarity } from "@/lib/cards";
import { RARITY } from "@/lib/game";

export type RevealItem = {
  card: Card;
  holo: boolean;
  isNew: boolean;
};

/** Couleur du éclat de révélation, par rareté. */
const BURST: Record<Rarity, string> = {
  C: "rgba(255, 255, 255, 0.16)",
  R: "rgba(56, 189, 248, 0.45)",
  SR: "rgba(167, 139, 250, 0.55)",
  UR: "rgba(252, 211, 77, 0.6)",
  L: "rgba(244, 114, 182, 0.65)",
};

/** Durée du suspense avant que la carte ne se retourne. */
const CHARGE_MS = 620;

/**
 * `closed` → `ready` (le dos reste affiché) → `charging` (suspense) → `open`.
 * Il faut donc deux gestes : préparer, puis retourner.
 */
type Phase = "closed" | "ready" | "charging" | "open";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Ouverture d'un booster carte par carte : le dos reste caché, puis chaque
 * clic retourne une carte avec un éclat proportionné à sa rareté. Le tirage
 * est déjà fait côté serveur — cette séquence ne fait que révéler.
 */
export function BoosterReveal({
  title,
  subtitle,
  items,
  onClose,
  closeLabel = "Retour",
}: {
  title: string;
  subtitle?: string;
  items: RevealItem[];
  onClose: () => void;
  closeLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("closed");
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = usePrefersReducedMotion();

  const total = items.length;
  const item = items[index];
  const isLast = index + 1 >= total;
  const revealed = finished ? total : index + (phase === "open" ? 1 : 0);
  const remaining = total - revealed;

  const newCount = new Set(items.filter((entry) => entry.isNew).map((entry) => entry.card.id)).size;
  const holoCount = items.filter((entry) => entry.holo).length;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function reveal() {
    if (finished) return;

    // Premier geste : la carte reste face cachée, elle se prépare.
    if (phase === "closed") {
      setPhase("ready");
      return;
    }

    // Deuxième geste : là seulement, elle se retourne.
    if (phase !== "ready") return;
    if (reduced) {
      setPhase("open");
      return;
    }
    setPhase("charging");
    timer.current = setTimeout(() => setPhase("open"), CHARGE_MS);
  }

  function advance() {
    if (finished || phase !== "open") return;
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
    setPhase("closed");
  }

  function revealAll() {
    if (timer.current) clearTimeout(timer.current);
    setFinished(true);
  }

  const rarity = item ? RARITY[item.card.rarity] : null;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white/90">{title}</p>
          <p className="mt-0.5 text-xs text-white/45">
            {subtitle ? `${subtitle} · ` : ""}
            {finished ? `${total} cartes révélées` : `carte ${Math.min(revealed + 1, total)} sur ${total}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!finished && remaining > 1 && (
            <button
              type="button"
              onClick={revealAll}
              className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/65 transition hover:border-white/30 hover:text-white"
            >
              Tout révéler
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/65 transition hover:border-white/30 hover:text-white"
          >
            {finished ? "Terminé" : closeLabel}
          </button>
        </div>
      </header>

      {!finished && total > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-1" aria-hidden>
          {items.map((entry, position) => (
            <span
              key={`${entry.card.id}-${position}`}
              className={`h-1.5 rounded-full transition-all ${
                position < revealed ? "w-4 bg-acid" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>
      )}

      {finished ? (
        <div className="mt-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((entry, position) => (
              <Link
                key={`${entry.card.id}-${position}`}
                href={`/card/${entry.card.id}`}
                className="card-deal relative block"
                style={{ animationDelay: `${Math.min(position, 12) * 45}ms` }}
              >
                <CardFace card={entry.card} size="sm" className="aspect-[3/4]" />
                {entry.isNew && (
                  <span className="absolute -top-1.5 left-2 z-10 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950 shadow-lg">
                    Nouveau
                  </span>
                )}
                {entry.holo && (
                  <span className="absolute -top-1.5 right-2 z-10 rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 shadow-lg">
                    Holo
                  </span>
                )}
              </Link>
            ))}
          </div>

          <p className="mt-4 text-center text-sm text-white/60">
            {newCount > 0 ? (
              <span className="font-semibold text-emerald-300">
                {newCount} nouvelle{newCount > 1 ? "s" : ""} carte{newCount > 1 ? "s" : ""}
              </span>
            ) : (
              "Aucune nouvelle carte cette fois"
            )}
            {holoCount > 0 && (
              <>
                <span className="text-white/25"> · </span>
                <span className="font-semibold text-amber-200">
                  {holoCount} holo{holoCount > 1 ? "s" : ""}
                </span>
              </>
            )}
          </p>
        </div>
      ) : (
        item &&
        rarity && (
          <>
            <div className="mt-3 flex flex-col items-center">
              <button
                type="button"
                onClick={phase === "open" ? advance : reveal}
                disabled={phase === "charging"}
                data-open={phase === "open"}
                data-ready={phase === "ready"}
                data-charging={phase === "charging"}
                data-rarity={item.card.rarity}
                aria-label={
                  phase === "open"
                    ? isLast
                      ? "Voir le récapitulatif"
                      : "Carte suivante"
                    : phase === "ready"
                      ? "Retourner la carte"
                      : phase === "charging"
                        ? "Révélation en cours"
                        : "Préparer la carte"
                }
                className="reveal-stage relative w-[min(74vw,220px)] sm:w-[248px]"
              >
                <span className="reveal-aura" aria-hidden />
                <span className="reveal-halo" aria-hidden />

                <div className="reveal-inner relative aspect-[3/4] w-full">
                  {/* Dos de carte : sa lueur trahit la rareté avant le retournement. */}
                  <div className="reveal-back">
                    <Image
                      src="/booster/dos-carte.jpg"
                      alt=""
                      fill
                      sizes="260px"
                      unoptimized
                      className="object-contain"
                    />
                    <span className="reveal-glow" aria-hidden />
                  </div>

                  <div className="reveal-front">
                    <CardFace card={item.card} size="md" className="h-full w-full" />
                  </div>
                </div>

                {phase === "open" && (
                  <span
                    key={`burst-${index}`}
                    className="reveal-burst"
                    style={{ "--burst": BURST[item.card.rarity] } as CSSProperties}
                    aria-hidden
                  />
                )}
                {(item.card.rarity === "UR" || item.card.rarity === "L") && phase === "open" && (
                  <span
                    key={`rays-${index}`}
                    className="reveal-rays"
                    style={{ "--burst": BURST[item.card.rarity] } as CSSProperties}
                    aria-hidden
                  />
                )}

                {phase === "open" && item.isNew && (
                  <span className="absolute -top-2 left-3 z-20 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950 shadow-lg">
                    Nouveau
                  </span>
                )}
                {phase === "open" && item.holo && (
                  <span className="absolute -top-2 right-3 z-20 rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 shadow-lg">
                    Holo
                  </span>
                )}
              </button>

              <div className="mt-5 min-h-14 text-center">
                {phase === "open" ? (
                  <div key={`label-${index}`} className="reveal-pop">
                    <p className="flex items-center justify-center gap-2 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rarity.badge}`}>
                        {rarity.short}
                      </span>
                      <span className={`font-semibold ${rarity.text}`}>{rarity.label}</span>
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {item.isNew ? "Nouvelle carte pour ta collection" : "Déjà dans ta collection"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-white/45" aria-live="polite">
                    {phase === "charging"
                      ? "Ça se dévoile…"
                      : phase === "ready"
                        ? "La lueur trahit sa rareté — touche encore pour la retourner"
                        : "Touche la carte pour commencer"}
                  </p>
                )}
              </div>

              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {phase === "open" ? (
                  <button
                    type="button"
                    onClick={advance}
                    className="rounded-full bg-acid px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
                  >
                    {isLast ? "Voir le récap" : "Carte suivante"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={reveal}
                    disabled={phase === "charging"}
                    className="rounded-full bg-acid px-5 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-wait disabled:bg-white/20 disabled:text-white/50"
                  >
                    {phase === "charging"
                      ? "Ouverture…"
                      : phase === "ready"
                        ? "Retourner la carte"
                        : "Préparer la carte"}
                  </button>
                )}
              </div>

              <p className="sr-only" aria-live="polite">
                {phase === "open"
                  ? `${item.card.name}, ${rarity.label}${item.holo ? ", holo" : ""}${
                      item.isNew ? ", nouvelle" : ""
                    }`
                  : ""}
              </p>
            </div>
          </>
        )
      )}
    </section>
  );
}
