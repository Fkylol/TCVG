"use client";

import { useState } from "react";
import { loadCardSales } from "@/app/actions";
import type { CardSaleEntry } from "@/lib/data";

function formatSaleDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Historique complet des ventes d'une carte, chargé par pages de douze.
 * Les ventes viennent de `trades` (immuable) : le total ne recule jamais.
 */
export function CardSalesHistory({
  cardId,
  initial,
  total,
}: {
  cardId: string;
  initial: CardSaleEntry[];
  total: number;
}) {
  const [sales, setSales] = useState(initial);
  const [count, setCount] = useState(total);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (busy) return;

    setBusy(true);
    setError(null);

    const result = await loadCardSales(cardId, sales.length);

    if (result.status === "ok") {
      setSales((previous) => [...previous, ...result.sales]);
      setCount(result.total);
    } else {
      setError(result.message);
    }

    setBusy(false);
  }

  const remaining = Math.max(0, count - sales.length);

  return (
    <div>
      {sales.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-white/40">
          Aucune vente enregistrée pour cette carte.
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {sales.map((sale, index) => (
            <li
              key={`${sale.soldAt}-${sale.price}-${index}`}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-acid">◆ {sale.price}</span>
                {sale.holo && (
                  <span className="chip bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
                    Holo
                  </span>
                )}
              </span>
              <span className="text-[11px] text-white/40">{formatSaleDate(sale.soldAt)}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="status" className="px-4 py-2 text-[11px] text-rose-200">
          {error}
        </p>
      )}

      {remaining > 0 && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={busy}
            className="btn btn-outline btn-sm w-full"
          >
            {busy
              ? "Chargement…"
              : `Charger ${Math.min(12, remaining)} vente${Math.min(12, remaining) > 1 ? "s" : ""} de plus`}
          </button>
        </div>
      )}

      <p className="px-4 pb-3 text-[11px] text-white/30">
        {count} vente{count > 1 ? "s" : ""} au total, toutes variantes confondues.
      </p>
    </div>
  );
}
