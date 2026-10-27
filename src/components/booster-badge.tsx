"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BOOSTER_STOCK_MAX, projectedStock } from "@/lib/game";

/** Une tranche de stock arrive toutes les 10 min : 30 s suffisent à l'affichage. */
const REFRESH_MS = 30_000;

/**
 * Compteur de boosters du header, posé à côté des Pixels : stock courant sur
 * le plafond (`7/10`). Il avance tout seul entre deux tranches de 10 minutes,
 * mais le serveur reste la référence — la page relit le profil à chaque
 * navigation et à la fermeture d'une révélation.
 *
 * Même calcul que la page Boosters (`projectedStock`), avec l'heure serveur
 * comme point de départ : aucun décalage d'hydratation.
 */
export function BoosterBadge({
  stock,
  anchor,
  serverNow,
  bonus = 0,
}: {
  /** Stock enregistré en base. */
  stock: number;
  /** Ancre d'accumulation du stock (dernier instant pris en compte). */
  anchor: string | null;
  /** Heure serveur au rendu. */
  serverNow: number;
  /** Boosters bonus (parrainage), hors plafond et sans expiration. */
  bonus?: number;
}) {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const { stock: available, nextAt } = projectedStock(stock, anchor, now);
  const full = available >= BOOSTER_STOCK_MAX;
  const wait = nextAt === null ? null : Math.max(1, Math.ceil((nextAt - now) / 60_000));

  return (
    <Link
      href="/boosters"        title={
          (full
            ? `${BOOSTER_STOCK_MAX} boosters disponibles (plein)`
            : `${available} booster${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}${
                wait ? ` · prochain dans ~${wait} min` : ""
              }`) +
          (bonus > 0
            ? ` · ${bonus} booster${bonus > 1 ? "s" : ""} bonus offert${bonus > 1 ? "s" : ""} (parrainage), hors plafond`
            : "")
        }
      aria-label={`${available} booster${available > 1 ? "s" : ""} disponible${
        available > 1 ? "s" : ""
      } sur ${BOOSTER_STOCK_MAX}${
        bonus > 0 ? `, plus ${bonus} booster${bonus > 1 ? "s" : ""} bonus` : ""
      }`}
      className={`chip gap-1 py-1 transition hover:text-cyan sm:px-2.5 ${
        full ? "text-cyan" : "text-white/70"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 shrink-0"
      >
        <rect x="2.6" y="2.2" width="10.8" height="11.6" rx="1.6" />
        <path d="M2.6 4.6h10.8" strokeDasharray="1.6 1.3" />
        <path d="M2.6 11.4h10.8" strokeDasharray="1.6 1.3" />
        <circle cx="8" cy="8" r="1.7" />
      </svg>
      <span className="font-mono tabular-nums">
        {available}
        <span className="text-white/35">/{BOOSTER_STOCK_MAX}</span>
        {bonus > 0 && (
          <span className="text-cyan">
            {" · "}+{bonus} bonus
          </span>
        )}
      </span>
    </Link>
  );
}
