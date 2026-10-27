"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createListing, fetchSellQuote } from "@/app/actions";
import { CardFace } from "@/components/card-face";
import type { Card } from "@/lib/cards";
import type { MarketQuote } from "@/lib/data";
import { RARITY } from "@/lib/game";

type Quotes = {
  normal: MarketQuote | null;
  holo: MarketQuote | null;
  median: number | null;
  lowest: number | null;
};

const FEE_RATE = 0.05;

function feeOf(price: number): number {
  return Number.isFinite(price) && price > 0 ? Math.ceil(price * FEE_RATE) : 0;
}

/**
 * Mise en vente depuis la collection.
 *
 * Le bouton ouvre une modale qui reprend les chiffres du marché : prix
 * conseillé, fourchette autorisée, commission et gain net. La fourchette et la
 * commission viennent de la base ; le serveur reste seul juge du prix, de la
 * propriété et du nombre d'annonces.
 */
export function SellCardButton({
  card,
  quantity,
  holoQuantity,
}: {
  card: Card;
  quantity: number;
  holoQuantity: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<Quotes | null>(null);
  const [isHolo, setIsHolo] = useState(false);
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  // Toute copie possédée est vendable, y compris la dernière : une annonce ne
  // demande plus de garder un exemplaire en réserve.
  const canSellNormal = quantity - holoQuantity >= 1;
  const canSellHolo = holoQuantity > 0;
  const normalSellable = Math.max(0, quantity - holoQuantity);
  const holoSellable = holoQuantity;
  const sellable = canSellNormal || canSellHolo;
  const info = RARITY[card.rarity];

  const quote = quotes ? (isHolo ? quotes.holo : quotes.normal) : null;
  const parsed = Number.parseInt(price, 10);
  const valid =
    Boolean(quote) &&
    Number.isInteger(parsed) &&
    parsed >= (quote?.min ?? 0) &&
    parsed <= (quote?.max ?? 0);
  const fee = feeOf(parsed);
  const payout = Number.isFinite(parsed) && parsed > 0 ? parsed - fee : 0;

  // Échap ferme la modale, comme la liste des persos d'un pack.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function openModal() {
    setOpen(true);
    // La variante par défaut est celle qui est réellement vendable.
    const startHolo = !canSellNormal && canSellHolo;
    setIsHolo(startHolo);
    setNote(null);
    setQuotes(null);
    setPrice("");

    if (!sellable) return;

    setLoading(true);
    const result = await fetchSellQuote(card.id);
    setLoading(false);

    if (result.status !== "ok") {
      setNote({ tone: "bad", text: result.message });
      return;
    }

    setQuotes(result);
    const first = startHolo ? result.holo : result.normal;
    if (first) setPrice(String(first.reference));
  }

  function choose(nextHolo: boolean) {
    setIsHolo(nextHolo);
    const next = quotes ? (nextHolo ? quotes.holo : quotes.normal) : null;
    if (next) setPrice(String(next.reference));
    setNote(null);
  }

  async function submit() {
    if (busy || !quote || !valid) return;

    setBusy(true);
    setNote(null);

    const result = await createListing(card.id, isHolo, parsed);

    if (result.status === "ok") {
      setNote({ tone: "ok", text: `Annonce publiée à ◆ ${result.price}.` });
      router.refresh();
      setTimeout(() => setOpen(false), 900);
    } else if (result.status === "not_owned") {
      setNote({ tone: "bad", text: "Cette carte n'est plus dans ta collection." });
    } else if (result.status === "out_of_bounds") {
      setNote({ tone: "bad", text: `Prix hors fourchette : ◆ ${result.min} à ◆ ${result.max}.` });
    } else if (result.status === "too_many") {
      setNote({ tone: "bad", text: `Tu as déjà ${result.max} annonces actives.` });
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openModal()}
        className="btn btn-outline btn-sm w-full px-2 py-1 text-[10px]"
        aria-haspopup="dialog"
      >
        Vendre
      </button>

      {open && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Mettre en vente ${card.name}`}
            className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0a0c0e] p-5 sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="display text-lg text-white">Mettre en vente</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/15 text-white/60 transition hover:text-white"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="w-20 shrink-0">
                <CardFace card={card} size="sm" className="aspect-[3/4]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">{card.name}</p>
                <p className={`text-xs font-semibold ${info.text}`}>{info.label}</p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {isHolo ? holoSellable : normalSellable} copie(s) vendable(s)
                </p>
                <p className="mt-1 font-mono text-[11px] text-white/55">
                  {loading
                    ? "Cote en cours…"
                    : quotes?.median !== null && quotes?.median !== undefined
                      ? `Médiane : ◆ ${quotes.median}`
                      : quote
                        ? `Prix conseillé : ◆ ${quote.reference}`
                        : "Pas assez de ventes récentes"}
                </p>
              </div>
            </div>

            {!sellable ? (
              <p className="mt-4 border-l-2 border-white/15 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-white/45">
                Tu ne possèdes aucune copie de cette carte : ouvre un booster pour pouvoir la
                mettre en vente.
              </p>
            ) : (
              <>
                {canSellNormal && canSellHolo && (
                  <div className="tabs mt-4 w-full text-[11px]">
                    <button
                      type="button"
                      onClick={() => choose(false)}
                      className={`tab flex-1 px-2 py-1.5 ${!isHolo ? "bg-cyan text-ink" : ""}`}
                    >
                      Normale
                    </button>
                    <button
                      type="button"
                      onClick={() => choose(true)}
                      className={`tab flex-1 px-2 py-1.5 ${isHolo ? "bg-amber-300 text-amber-950" : ""}`}
                    >
                      Holo
                    </button>
                  </div>
                )}

                <label className="mt-4 block">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                    Prix (◆)
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={quote?.min}
                    max={quote?.max}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="field mt-1"
                    placeholder={quote ? String(quote.reference) : "—"}
                  />
                </label>

                {quote && (
                  <p className="mt-1.5 text-[11px] text-white/40">
                    Entre <span className="font-mono">◆ {quote.min}</span> et{" "}
                    <span className="font-mono">◆ {quote.max}</span> pour cette rareté
                    {quote.sales > 0 && (
                      <span className="text-white/25"> · {quote.sales} vente(s) récente(s)</span>
                    )}
                  </p>
                )}

                <dl className="mt-4 divide-y divide-white/5 border-y border-white/10 text-[11px]">
                  <div className="flex items-center justify-between py-1.5">
                    <dt className="text-white/45">Taxe de vente (5 %)</dt>
                    <dd className="font-mono text-white/65">− {fee} ◆</dd>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <dt className="text-white/60">Gain net</dt>
                    <dd className="font-mono font-semibold text-cyan">{payout} ◆</dd>
                  </div>
                </dl>

                {quotes?.lowest !== null && quotes?.lowest !== undefined && (
                  <p className="mt-2 text-[11px] text-white/35">
                    Annonce la moins chère actuellement :{" "}
                    <span className="font-mono text-white/60">◆ {quotes.lowest}</span>
                  </p>
                )}

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={busy || !valid}
                    className="btn btn-primary btn-sm"
                  >
                    {busy ? "Publication…" : "Mettre en vente"}
                  </button>
                </div>
              </>
            )}

            {note && (
              <p
                role="status"
                className={`mt-3 text-[11px] ${note.tone === "ok" ? "text-emerald-300" : "text-amber-300"}`}
              >
                {note.text}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
