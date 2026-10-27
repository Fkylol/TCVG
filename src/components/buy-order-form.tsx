"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBuyOrder, fetchSellQuote } from "@/app/actions";
import type { CardOrderBook, MarketQuote } from "@/lib/data";

type Note = { tone: "ok" | "bad"; text: string } | null;

/**
 * Ordre d'achat : le joueur fixe un prix maximum, la somme est réservée sur son
 * solde et le marché l'exécute dès qu'une annonce passe sous cette limite.
 *
 * Les bornes viennent de `market_quote()` (même fourchette que la vente), et le
 * plafond d'ordres, la réservation et l'appariement sont faits en base.
 */
export function BuyOrderForm({
  cardId,
  cardName,
  pixels,
  orderBook,
}: {
  cardId: string;
  cardName: string;
  pixels: number;
  orderBook: CardOrderBook;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const [normal, setNormal] = useState<MarketQuote | null>(null);
  const [holo, setHolo] = useState<MarketQuote | null>(null);
  const [isHolo, setIsHolo] = useState(false);
  const [price, setPrice] = useState("");

  const quote = isHolo ? holo : normal;
  const parsed = Number.parseInt(price, 10);
  const valid =
    Boolean(quote) &&
    Number.isInteger(parsed) &&
    parsed >= (quote?.min ?? 0) &&
    parsed <= (quote?.max ?? 0) &&
    parsed <= pixels;
  const short = Number.isInteger(parsed) && parsed > pixels;

  async function toggle() {
    const next = !open;
    setOpen(next);
    setNote(null);

    if (!next || normal || holo) return;

    setLoading(true);
    const result = await fetchSellQuote(cardId);
    if (result.status === "ok") {
      setNormal(result.normal);
      setHolo(result.holo);
      const first = result.normal ?? result.holo;
      if (first) {
        // On propose le meilleur ordre existant s'il y en a un, sinon le prix conseillé.
        const best = result.normal ? orderBook.normal.best : orderBook.holo.best;
        setPrice(String(best ?? first.reference));
      }
      setIsHolo(!result.normal && Boolean(result.holo));
    } else {
      setNote({ tone: "bad", text: result.message });
    }
    setLoading(false);
  }

  async function submit() {
    if (busy || !valid) return;

    setBusy(true);
    setNote(null);

    const result = await createBuyOrder(cardId, isHolo, parsed);

    if (result.status === "ok") {
      if (result.filled) {
        setNote({
          tone: "ok",
          text: `Ordre servi immédiatement : ${cardName} achetée ◆ ${result.spent ?? result.max}.`,
        });
      } else {
        setNote({
          tone: "ok",
          text: `Ordre posé à ◆ ${result.max}. ◆ ${result.max} réservés jusqu'à exécution ou annulation.`,
        });
      }
      setPrice("");
      setOpen(false);
      router.refresh();
    } else if (result.status === "insufficient") {
      setNote({
        tone: "bad",
        text: `Solde insuffisant : il te manque ◆ ${result.price - result.pixels}.`,
      });
    } else if (result.status === "out_of_bounds") {
      setNote({
        tone: "bad",
        text: `Prix hors fourchette : ◆ ${result.min} à ◆ ${result.max}.`,
      });
    } else if (result.status === "too_many") {
      setNote({ tone: "bad", text: `Tu as déjà ${result.max} ordres actifs.` });
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(false);
  }

  const bestNormal = orderBook.normal.best;
  const bestHolo = orderBook.holo.best;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="btn btn-outline w-full"
      >
        {open ? "Fermer l'ordre d'achat" : "Poser un ordre d'achat"}
      </button>

      {(bestNormal !== null || bestHolo !== null) && !open && (
        <p className="text-[11px] leading-relaxed text-white/35">
          Carnet :{" "}
          {bestNormal !== null && (
            <span className="font-mono text-white/60">{orderBook.normal.count} à ◆ {bestNormal}</span>
          )}
          {bestNormal !== null && bestHolo !== null && <span className="text-white/20"> · </span>}
          {bestHolo !== null && (
            <span className="font-mono text-amber-200/80">
              {orderBook.holo.count} holo à ◆ {bestHolo}
            </span>
          )}
        </p>
      )}

      {open && (
        <div className="panel space-y-2 p-3 text-sm">
          <p className="text-[11px] leading-relaxed text-white/40">
            Ton prix maximum est réservé sur ton solde. Dès qu&apos;une annonce passe sous cette
            limite, l&apos;achat se fait au prix de l&apos;annonce et le surplus t&apos;est rendu.
          </p>

          {loading ? (
            <p className="text-[11px] text-white/40">Calcul de la fourchette…</p>
          ) : quote ? (
            <>
              {normal && holo && (
                <div className="tabs w-full text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHolo(false);
                      setPrice(String(normal.reference));
                    }}
                    className={`tab flex-1 px-2 py-1.5 ${!isHolo ? "bg-cyan text-ink" : ""}`}
                  >
                    Normale
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHolo(true);
                      setPrice(String(holo.reference));
                    }}
                    className={`tab flex-1 px-2 py-1.5 ${isHolo ? "bg-amber-300 text-amber-950" : ""}`}
                  >
                    Holo
                  </button>
                </div>
              )}

              <p className="text-[11px] text-white/45">
                Fourchette{" "}
                <span className="font-mono text-white/75">
                  ◆ {quote.min} – ◆ {quote.max}
                </span>
                <span className="text-white/25"> · </span>
                conseillé <span className="font-mono">◆ {quote.reference}</span>
              </p>

              <div className="flex items-center gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Prix maximum en Pixels</span>
                  <input
                    type="number"
                    min={quote.min}
                    max={Math.min(quote.max, pixels)}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="field"
                    placeholder="Prix maximum"
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !valid}
                  className="btn btn-primary btn-sm shrink-0"
                >
                  {busy ? "Réservation…" : "Réserver"}
                </button>
              </div>

              <p className="text-[11px] text-white/40">
                {short
                  ? `Solde insuffisant : tu as ◆ ${pixels}.`
                  : `Réservé : ◆ ${Number.isInteger(parsed) && parsed > 0 ? parsed : 0} · solde ◆ ${pixels}`}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-white/40">
              Fourchette indisponible pour le moment.
            </p>
          )}
        </div>
      )}

      {note && (
        <p
          role="status"
          className={`border-l-2 px-3 py-2 text-[11px] leading-relaxed ${
            note.tone === "ok"
              ? "border-cyan/60 bg-cyan/[0.06] text-white/70"
              : "border-white/25 bg-white/[0.04] text-white/60"
          }`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
