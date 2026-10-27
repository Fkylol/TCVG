"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buyListing, toggleWishlist } from "@/app/actions";
import { BuyOrderForm } from "@/components/buy-order-form";
import type { CardOrderBook, CheapestListing } from "@/lib/data";

type Note = { tone: "ok" | "bad"; text: string } | null;

/**
 * Actions de marché de la fiche carte : liste d'envies, achat immédiat de
 * l'annonce la moins chère et ordre d'achat avec prix maximum réservé.
 *
 * Les deux chemins passent par des fonctions SQL qui vérifient prix, solde,
 * séquestre et transfert : rien n'est décidé côté navigateur.
 */
export function CardMarketActions({
  cardId,
  cardName,
  wishlisted,
  cheapest,
  pixels,
  orderBook,
}: {
  cardId: string;
  cardName: string;
  wishlisted: boolean;
  cheapest: CheapestListing | null;
  pixels: number;
  orderBook: CardOrderBook;
}) {
  const router = useRouter();
  const [wished, setWished] = useState(wishlisted);
  const [wishBusy, setWishBusy] = useState(false);
  const [buyBusy, setBuyBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const short = cheapest !== null && pixels < cheapest.price;

  async function toggleWish() {
    if (wishBusy) return;
    setWishBusy(true);
    setNote(null);

    const result = await toggleWishlist(cardId);

    if (result.status === "ok") {
      setWished(result.wished);
      setNote({
        tone: "ok",
        text: result.wished
          ? `${cardName} est dans ta liste d'envies.`
          : `${cardName} a été retiré de ta liste d'envies.`,
      });
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setWishBusy(false);
  }

  async function buyNow() {
    if (!cheapest || buyBusy || short) return;

    const label = `Acheter ${cardName}${cheapest.holo ? " (holo)" : ""} pour ◆ ${cheapest.price} ?`;
    if (!window.confirm(label)) return;

    setBuyBusy(true);
    setNote(null);

    const result = await buyListing(cheapest.id);

    if (result.status === "ok") {
      setNote({ tone: "ok", text: `${cardName} rejoint ta collection pour ◆ ${result.price}.` });
      router.refresh();
    } else if (result.status === "insufficient") {
      setNote({
        tone: "bad",
        text: `Solde insuffisant : il te manque ${result.price - result.pixels} ◆.`,
      });
    } else if (result.status === "own") {
      setNote({ tone: "bad", text: "Cette annonce est la tienne." });
    } else if (result.status === "unavailable") {
      setNote({ tone: "bad", text: "Annonce déjà vendue ou annulée." });
      router.refresh();
    } else if (result.status === "expired") {
      setNote({ tone: "bad", text: "Annonce expirée : la copie est revenue chez son vendeur." });
      router.refresh();
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBuyBusy(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={toggleWish}
        disabled={wishBusy}
        aria-pressed={wished}
        className={`btn w-full ${wished ? "btn-cyan" : "btn-outline"}`}
      >
        <span aria-hidden>{wished ? "★" : "☆"}</span>
        {wishBusy ? "Enregistrement…" : wished ? "Dans mes envies" : "Ajouter à mes envies"}
      </button>

      {cheapest && (
        <>
          <button
            type="button"
            onClick={buyNow}
            disabled={buyBusy || short}
            className="btn btn-primary w-full"
          >
            {buyBusy
              ? "Achat…"
              : short
                ? `Il manque ${cheapest.price - pixels} ◆`
                : `Acheter maintenant · ◆ ${cheapest.price}`}
          </button>
          <p className="text-[11px] leading-relaxed text-white/35">
            Achat immédiat de l&apos;annonce la moins chère
            {cheapest.holo ? " (holo)" : ""}, au prix de l&apos;annonce.
          </p>
        </>
      )}

      <BuyOrderForm
        cardId={cardId}
        cardName={cardName}
        pixels={pixels}
        orderBook={orderBook}
      />

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
