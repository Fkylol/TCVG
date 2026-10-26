"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelChatOffer, loadChatOffers, respondChatOffer } from "@/app/actions/swap";
import { AvatarFrame } from "@/components/avatar-frame";
import { OfferDialog } from "@/components/chat/offer-dialog";
import { getCardArt } from "@/lib/card-art";
import { getCard } from "@/lib/cards";
import { formatChatDateTime, formatRemaining } from "@/lib/chat/config";
import {
  isOfferOpen,
  needsCounter,
  OFFER_DISCORD_NOTE,
  OFFER_STATUS_LABEL,
  type ChatOffer,
  type ChatOfferBoard,
} from "@/lib/chat/offers";
import { RARITY } from "@/lib/game";
import { rarityColorVar } from "@/lib/rarity";

/**
 * Tableau des échanges : les propositions reçues à gauche, celles envoyées à
 * droite. Acceptation, refus et retrait passent par les actions serveur, qui
 * laissent la base trancher (séquestre, expiration, atomicité).
 *
 * Le panneau ne calcule aucune règle : il affiche l'état renvoyé par
 * `chat_offer_list()` après chaque action.
 */
export function OffersBoard({ initial }: { initial: ChatOfferBoard }) {
  const [board, setBoard] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [counterFor, setCounterFor] = useState<ChatOffer | null>(null);

  const refresh = () => {
    startTransition(async () => {
      const result = await loadChatOffers();
      if (result.ok) setBoard(result.board);
      else setError(result.message);
    });
  };

  const respond = (offer: ChatOffer, action: "accept" | "decline") => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await respondChatOffer({ offerId: offer.id, action });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice(action === "accept" ? "Échange conclu : les deux cartes ont changé de main." : "Offre refusée, la carte est rendue.");
      refresh();
    });
  };

  const withdraw = (offer: ChatOffer) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await cancelChatOffer(offer.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNotice("Proposition retirée : ta carte est revenue dans ta collection.");
      refresh();
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Échanges</span>
          <h1 className="display mt-2 text-4xl">Cartes contre cartes</h1>
          <span className="title-rule" aria-hidden />
          <p className="mt-1 max-w-2xl text-sm text-white/50">
            Chaque proposition réserve la carte offerte jusqu&apos;à la réponse. Une offre expire
            au bout de 24 heures, et la copie revient alors à son propriétaire.
          </p>
        </div>

        <Link href="/agora" className="btn btn-outline btn-sm">
          Retour à L&apos;Agora
        </Link>
      </div>

      <p className="panel flex flex-wrap items-center gap-3 p-3 text-xs text-white/65">
        {OFFER_DISCORD_NOTE}
        <span className="text-[10px] text-white/35">
          Le message part du bot du jeu : il faut avoir rejoint le serveur Discord et se connecter
          au site avec ce compte. La notification dans le site reste systématique.
        </span>
      </p>

      {notice && <p className="mt-3 border-l-2 border-acid/60 bg-acid/[0.07] px-3 py-2 text-sm text-acid">{notice}</p>}
      {error && (
        <p role="alert" className="mt-3 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="offers-in">
          <h2 id="offers-in" className="display text-lg">
            Reçues ({board.incoming.filter((offer) => isOfferOpen(offer)).length})
          </h2>
          <ul className="mt-2 space-y-3">
            {board.incoming.length === 0 && <Empty>Aucune proposition reçue pour le moment.</Empty>}
            {board.incoming.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                pending={pending}
                onAccept={() => respond(offer, "accept")}
                onDecline={() => respond(offer, "decline")}
                onCounter={() => setCounterFor(offer)}
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="offers-out">
          <h2 id="offers-out" className="display text-lg">
            Envoyées ({board.outgoing.filter((offer) => isOfferOpen(offer)).length})
          </h2>
          <ul className="mt-2 space-y-3">
            {board.outgoing.length === 0 && <Empty>Aucune proposition envoyée.</Empty>}
            {board.outgoing.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                pending={pending}
                onWithdraw={() => withdraw(offer)}
              />
            ))}
          </ul>
        </section>
      </div>

      {counterFor && (
        <OfferDialog
          mode="counter"
          offerId={counterFor.id}
          requestedCardId={counterFor.offeredCardId}
          onClose={() => setCounterFor(null)}
          onDone={(text) => {
            setCounterFor(null);
            setNotice(text);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <li className="border border-dashed border-white/15 px-4 py-8 text-center text-xs text-white/45">
      {children}
    </li>
  );
}

/** Statut coloré : vert pour un échange conclu, rouge pour un refus. */
const STATUS_TONE: Record<ChatOffer["status"], string> = {
  pending: "bg-white/10 text-white/70",
  accepted: "bg-acid/15 text-acid",
  declined: "bg-rose-500/15 text-rose-200",
  countered: "bg-white/10 text-white/70",
  expired: "bg-white/10 text-white/45",
  cancelled: "bg-white/10 text-white/45",
  removed: "bg-amber-400/15 text-amber-200",
};

function OfferCard({
  offer,
  pending,
  onAccept,
  onDecline,
  onCounter,
  onWithdraw,
}: {
  offer: ChatOffer;
  pending: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCounter?: () => void;
  onWithdraw?: () => void;
}) {
  const open = isOfferOpen(offer);
  const offered = getCard(offer.offeredCardId);
  const requested = offer.requestedCardId ? getCard(offer.requestedCardId) : null;
  const counterpart = offer.direction === "in" ? offer.proposer : offer.owner;
  const counterpartArt = counterpart.avatarCardId ? getCardArt(counterpart.avatarCardId) : null;

  return (
    <li className={`panel p-3 ${open ? "" : "opacity-65"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AvatarFrame
            avatar={counterpartArt}
            initial={counterpart.name.charAt(0)}
            size={24}
            frameId={counterpart.frame}
          />
          <p className="text-xs text-white/65">
            {offer.direction === "in" ? (
              <>
                De <span className="font-semibold text-white/90">{offer.proposer.name}</span>
              </>
            ) : (
              <>
                À <span className="font-semibold text-white/90">{offer.owner.name}</span>
              </>
            )}
          </p>
        </div>
        <span className={`chip px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[offer.status]}`}>
          {OFFER_STATUS_LABEL[offer.status]}
        </span>
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        <MiniCard cardId={offer.offeredCardId} holo={offer.offeredHolo} caption={offered?.name ?? offer.offeredCardId} />
        <span aria-hidden className="self-center text-white/30">
          ⇄
        </span>
        {requested ? (
          <MiniCard cardId={requested.id} caption={requested.name} />
        ) : (
          <div className="flex w-[68px] shrink-0 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-white/20 p-1 text-center">
            <span aria-hidden className="text-lg text-white/30">
              ?
            </span>
            <span className="text-[9px] leading-tight text-white/40">Carte au choix</span>
          </div>
        )}

        <div className="min-w-0 flex-1 self-center text-[11px] leading-relaxed text-white/50">
          {offer.message && <p className="mb-1 text-white/70">« {offer.message} »</p>}
          <p>{open ? `Expire dans ${formatRemaining(offer.expiresAt)}` : formatChatDateTime(offer.createdAt)}</p>
          <p className="text-white/35">
            {offer.direction === "in" ? `Pour ${offer.owner.name}` : `Par ${offer.proposer.name}`}
          </p>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offer.direction === "in" && (
            <>
              {!needsCounter(offer) && (
                <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={onAccept}>
                  Accepter
                </button>
              )}
              <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={onCounter}>
                {needsCounter(offer) ? "Choisir ce que tu donnes" : "Contre-proposer"}
              </button>
              <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={onDecline}>
                Refuser
              </button>
            </>
          )}

          {offer.direction === "out" && (
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={onWithdraw}>
              Retirer la proposition
            </button>
          )}
        </div>
      )}

      {offer.status === "accepted" && (
        <p className="mt-2 text-[11px] text-acid/80">
          {offer.direction === "in"
            ? `${offered?.name ?? "La carte"} a rejoint ta collection.`
            : `${requested?.name ?? "La carte"} a rejoint ta collection.`}{" "}
          <Link href={`/card/${offer.direction === "in" ? offer.offeredCardId : offer.requestedCardId}`} className="text-white/40 hover:text-acid">
            Voir la fiche →
          </Link>
        </p>
      )}

      <p className="sr-only">
        Échange avec {counterpart.name}, carte proposée {offered?.name ?? ""}.
      </p>
    </li>
  );
}

/** Miniature encadrée de la couleur de rareté. */
function MiniCard({ cardId, caption, holo = false }: { cardId: string; caption: string; holo?: boolean }) {
  const card = getCard(cardId);
  const art = card ? getCardArt(card.id) : null;

  return (
    <div className="w-[68px] shrink-0">
      <div
        className="relative aspect-[3/4] overflow-hidden rounded-sm border bg-white/5"
        style={{ borderColor: card ? `var(${rarityColorVar(card.rarity)})` : undefined }}
      >
        {art ? (
          <Image
            src={art.src}
            alt=""
            width={68}
            height={91}
            unoptimized={!art.local}
            loading="lazy"
            style={art.framing}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden className="grid h-full place-items-center text-xl">
            {card?.emoji ?? "?"}
          </span>
        )}
        {holo && (
          <span className="absolute left-0.5 top-0.5 rounded-sm bg-acid px-1 font-mono text-[8px] font-bold uppercase text-ink">
            Holo
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[9px] text-white/60" title={caption}>
        {caption}
      </p>
      {card && <p className="truncate text-[8px] text-white/30">{RARITY[card.rarity].label}</p>}
    </div>
  );
}
