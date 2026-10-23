"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createListing } from "@/app/actions";
import type { MarketQuote } from "@/lib/data";

type Note = { tone: "ok" | "bad"; text: string } | null;

export function ListingForm({
  cardId,
  normal,
  holo,
  canSellNormal,
  canSellHolo,
}: {
  cardId: string;
  normal: MarketQuote | null;
  holo: MarketQuote | null;
  canSellNormal: boolean;
  canSellHolo: boolean;
}) {
  const router = useRouter();
  const [isHolo, setIsHolo] = useState(!canSellNormal && canSellHolo);
  const [price, setPrice] = useState(() => {
    const quote = !canSellNormal && canSellHolo ? holo : normal;
    return quote ? String(quote.reference) : "";
  });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const quote = isHolo ? holo : normal;
  const sellable = canSellNormal || canSellHolo;
  const parsed = Number.parseInt(price, 10);
  const valid =
    Boolean(quote) &&
    Number.isInteger(parsed) &&
    parsed >= (quote?.min ?? 0) &&
    parsed <= (quote?.max ?? 0);
  const fee = Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed * 0.05) : 0;
  const payout = Number.isFinite(parsed) && parsed > 0 ? parsed - fee : 0;

  function choose(nextHolo: boolean) {
    setIsHolo(nextHolo);
    const next = nextHolo ? holo : normal;
    if (next) setPrice(String(next.reference));
    setNote(null);
  }

  async function submit() {
    if (busy || !quote || !valid) return;

    setBusy(true);
    setNote(null);

    const result = await createListing(cardId, isHolo, parsed);

    if (result.status === "ok") {
      setNote({ tone: "ok", text: `Annonce publiée à ◆ ${result.price}.` });
      router.refresh();
    } else if (result.status === "keep_one") {
      setNote({ tone: "bad", text: "Garde au moins un exemplaire de cette carte." });
    } else if (result.status === "not_owned") {
      setNote({ tone: "bad", text: "Cette carte n'est plus dans ta collection." });
    } else if (result.status === "out_of_bounds") {
      setNote({
        tone: "bad",
        text: `Prix hors fourchette : ◆ ${result.min} à ◆ ${result.max}.`,
      });
    } else if (result.status === "too_many") {
      setNote({ tone: "bad", text: `Tu as déjà ${result.max} annonces actives.` });
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(false);
  }

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-white/90">Vendre au marché</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/35">
            Une copie quitte ta collection jusqu&apos;à la vente ou l&apos;annulation. Commission de
            5 % à la vente.
          </p>
        </div>
        <Link href="/marche" className="shrink-0 text-[11px] text-acid hover:underline">
          Marché →
        </Link>
      </div>

      {!sellable ? (
        <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-white/40">
          Aucune copie vendable pour le moment : il faut garder un exemplaire normal de chaque
          carte. Ouvre d&apos;autres boosters pour vendre un doublon.
        </p>
      ) : (
        <>
          {canSellNormal && canSellHolo && (
            <div className="mt-3 flex rounded-lg border border-white/10 bg-black/30 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => choose(false)}
                className={`flex-1 rounded-md px-2 py-1.5 transition ${
                  !isHolo ? "bg-acid text-ink" : "text-white/55 hover:text-white"
                }`}
              >
                Normale
              </button>
              <button
                type="button"
                onClick={() => choose(true)}
                className={`flex-1 rounded-md px-2 py-1.5 transition ${
                  isHolo ? "bg-amber-300 text-amber-950" : "text-white/55 hover:text-white"
                }`}
              >
                Holo
              </button>
            </div>
          )}

          {quote && (
            <>
              <p className="mt-3 text-[11px] leading-relaxed text-white/50">
                Prix conseillé{" "}
                <span className="font-mono text-white/80">◆ {quote.reference}</span>
                <span className="text-white/25"> · </span>
                fourchette{" "}
                <span className="font-mono">
                  ◆ {quote.min} – ◆ {quote.max}
                </span>
                {quote.sales > 0 && (
                  <span className="text-white/30"> · {quote.sales} vente(s) récente(s)</span>
                )}
              </p>

              <div className="mt-2 flex items-center gap-2">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Prix de vente en Pixels</span>
                  <input
                    type="number"
                    min={quote.min}
                    max={quote.max}
                    step={1}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-acid/60"
                  />
                </label>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || !valid}
                  className="shrink-0 rounded-xl bg-acid px-3 py-2 text-xs font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                >
                  {busy ? "Publication…" : "Mettre en vente"}
                </button>
              </div>

              <p className="mt-1.5 text-[11px] text-white/40">
                Tu recevras{" "}
                <span className="font-mono text-white/70">◆ {payout}</span> net
                <span className="text-white/25"> · </span>
                commission{" "}
                <span className="font-mono text-white/50">◆ {fee}</span>
              </p>
            </>
          )}

          {note && (
            <p
              role="status"
              className={`mt-2 text-[11px] ${note.tone === "ok" ? "text-emerald-300" : "text-amber-300"}`}
            >
              {note.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}
