"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createChatOffer, loadSwapCards, respondChatOffer, type SwapCard } from "@/app/actions/swap";
import { getCardArt } from "@/lib/card-art";
import { getCard, getUniverseLabel } from "@/lib/cards";
import { MAX_OFFER_MESSAGE } from "@/lib/chat/offers";
import { rarityColorVar } from "@/lib/rarity";

/**
 * Proposition d'échange : on choisit une de ses copies, on ajoute un mot, et
 * la base séquestre la carte. Le même panneau sert à contre-proposer, avec la
 * carte reçue affichée en regard.
 *
 * Le joueur ne voit que ses propres cartes : aucune collection d'autrui ne
 * transite par ici.
 */
export function OfferDialog({
  mode,
  announcement,
  offerId,
  requestedCardId,
  onClose,
  onDone,
}: {
  mode: "offer" | "counter";
  /** Annonce visée (mode `offer`). */
  announcement?: { id: number; kind: "have" | "want"; cardId: string };
  /** Offre reçue (mode `counter`). */
  offerId?: number;
  /** Carte que le destinataire recevra : elle ne peut pas être offerte en retour. */
  requestedCardId?: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [cards, setCards] = useState<SwapCard[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SwapCard | null>(null);
  const [holo, setHolo] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Clé d'idempotence : stable pour ce panneau, donc un double-clic ne crée
  // pas deux offres (ni deux séquestres).
  const clientKey = useRef<string | null>(null);

  // Le panneau s'ouvre : on charge les copies disponibles une seule fois.
  useEffect(() => {
    let alive = true;
    void loadSwapCards().then((result) => {
      if (!alive) return;
      if (result.ok) setCards(result.cards);
      else setError(result.message);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Échap ferme, et le focus entre dans le panneau.
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const targetCard = mode === "counter" ? (requestedCardId ? getCard(requestedCardId) : null) : null;
  const announcementCard = announcement ? getCard(announcement.cardId) : null;

  // En mode « Je cherche », seule la carte demandée peut être offerte.
  const options = useMemo(() => {
    const list = cards ?? [];
    const allowed =
      mode === "offer" && announcement?.kind === "want"
        ? list.filter((row) => row.cardId === announcement.cardId)
        : mode === "counter"
          ? list.filter((row) => row.cardId !== requestedCardId)
          : list;

    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? allowed.filter((row) => {
          const card = getCard(row.cardId);
          return (
            card?.name.toLowerCase().includes(needle) ||
            (card ? getUniverseLabel(card.universe).toLowerCase().includes(needle) : false)
          );
        })
      : allowed;

    // Les doublons d'abord : ce sont les copies les plus faciles à céder.
    return [...filtered].sort((a, b) => b.quantity - a.quantity);
  }, [cards, announcement, mode, query, requestedCardId]);

  const remaining = Array.from(message).length;

  async function submit() {
    if (pending) return;
    if (!selected) {
      setError("Choisis la carte que tu proposes.");
      return;
    }

    setPending(true);
    setError(null);

    const key = clientKey.current ?? crypto.randomUUID();
    clientKey.current = key;

    const result =
      mode === "offer" && announcement
        ? await createChatOffer({
            announcementId: announcement.id,
            cardId: selected.cardId,
            holo,
            message,
            clientKey: key,
          })
        : await respondChatOffer({
            offerId: offerId ?? 0,
            action: "counter",
            counterCardId: selected.cardId,
            counterHolo: holo,
            counterMessage:            message,
            clientKey: key,
          });

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    onDone(
      mode === "offer"
        ? "Proposition envoyée : ta carte est réservée jusqu'à la réponse."
        : "Contre-proposition envoyée : ta carte est réservée jusqu'à la réponse.",
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-dialog-title"
        tabIndex={-1}
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0a0c0e] p-4 shadow-2xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Échange</span>
            <h2 id="offer-dialog-title" className="display mt-1 text-xl">
              {mode === "offer" ? "Proposer une carte" : "Contre-proposer"}
            </h2>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Fermer
          </button>
        </div>

        {/* Rappel des deux côtés de l'échange. */}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/55">
          <span className="min-w-0 flex-1 truncate">
            {mode === "offer" ? (
              <>
                Tu apportes une carte · tu reçois{" "}
                <span className="text-white/85">{announcementCard?.name ?? "la carte de l'annonce"}</span>
              </>
            ) : (
              <>
                Tu reçois{" "}
                <span className="text-white/85">{targetCard?.name ?? "la carte proposée"}</span> · tu
                donnes une de tes copies
              </>
            )}
          </span>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">Filtrer tes cartes</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher dans tes cartes…"
            className="w-full rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus-visible:border-acid/60"
          />
        </label>

        <div className="mt-2 min-h-24 flex-1 overflow-y-auto rounded-sm border border-white/10 bg-black/30 p-2">
          {cards === null && !error && <p className="p-3 text-xs text-white/40">Chargement…</p>}

          {cards !== null && options.length === 0 && (
            <p className="p-3 text-xs text-white/45">
              {mode === "offer" && announcement?.kind === "want"
                ? "Tu ne possèdes pas la carte recherchée : cette annonce ne peut pas être servie."
                : "Aucune carte disponible : ta collection est vide ou entièrement liée à des ventes."}
            </p>
          )}

          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {options.map((row) => {
              const card = getCard(row.cardId);
              if (!card) return null;
              const art = getCardArt(card.id);
              const isSelected = selected?.cardId === row.cardId;

              return (
                <li key={row.cardId}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelected(row);
                      setHolo(row.holoQuantity > 0);
                    }}
                    className={`w-full rounded-sm border p-1 text-left transition ${
                      isSelected
                        ? "border-acid/70 bg-acid/[0.08]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                    style={{ borderColor: isSelected ? undefined : `var(${rarityColorVar(card.rarity)})` }}
                  >
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-sm bg-white/5">
                      {art ? (
                        <Image
                          src={art.src}
                          alt=""
                          width={96}
                          height={128}
                          unoptimized={!art.local}
                          loading="lazy"
                          style={art.framing}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span aria-hidden className="grid h-full place-items-center text-2xl">
                          {card.emoji}
                        </span>
                      )}
                      {row.quantity > 1 && (
                        <span className="absolute bottom-1 right-1 rounded-sm bg-black/70 px-1 font-mono text-[9px] text-white/80">
                          ×{row.quantity}
                        </span>
                      )}
                      {row.holoQuantity > 0 && (
                        <span className="absolute left-1 top-1 rounded-sm bg-acid px-1 font-mono text-[8px] font-bold uppercase text-ink">
                          Holo
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-[10px] text-white/75">{card.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selected && selected.holoQuantity > 0 && (
          <label className="mt-2 flex items-center gap-2 text-[11px] text-white/60">
            <input
              type="checkbox"
              checked={holo}
              onChange={(event) => setHolo(event.target.checked)}
              className="accent-acid"
            />
            Proposer la copie holo (compte pour une copie brillante)
          </label>
        )}

        <label className="mt-3 block">
          <span className="text-[11px] uppercase tracking-[0.16em] text-white/40">
            Un mot (facultatif)
          </span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MAX_OFFER_MESSAGE}
            rows={2}
            placeholder="« Ça te va ? »"
            className="mt-1 w-full resize-none rounded-sm border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none focus-visible:border-acid/60"
          />
          <span className="mt-0.5 block text-right font-mono text-[10px] text-white/30">
            {remaining} / {MAX_OFFER_MESSAGE}
          </span>
        </label>

        {error && (
          <p role="alert" className="mt-1 border-l-2 border-rose-400/60 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-200">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending || !selected}
          className="btn btn-primary mt-3 w-full"
        >
          {pending ? "Envoi…" : mode === "offer" ? "Envoyer la proposition" : "Envoyer la contre-proposition"}
        </button>
        <p className="mt-1 text-center text-[10px] text-white/35">
          Ta carte est réservée pendant la durée de l&apos;offre : elle ne peut pas être vendue
          ailleurs. Elle revient automatiquement si l&apos;offre est refusée ou expire.
        </p>
      </div>
    </div>
  );
}
