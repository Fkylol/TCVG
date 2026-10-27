"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { announceCard, sendChatMessage } from "@/app/actions/chat";
import { CARDS } from "@/lib/cards";
import { formatChatTime, MAX_CHAT_BODY } from "@/lib/chat/config";
import type { ChatCardOptions } from "@/lib/chat/data";
import { checkChatBody, chatErrorText } from "@/lib/chat/text";
import type { ChatWriteGate } from "@/lib/chat/types";
import { RARITY } from "@/lib/game";

/** Tri alphabétique français : un seul collateur, pas un par comparaison. */
const SORT_FR = new Intl.Collator("fr");

/**
 * Pied du panneau : saisie libre, bouton « Annoncer », et bannière de
 * déblocage progressif quand l'écriture n'est pas encore ouverte.
 */
export function ChatComposer({
  roomId,
  canWrite,
  cardOptions,
  onSent,
}: {
  roomId: number;
  canWrite: ChatWriteGate;
  cardOptions: ChatCardOptions;
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [announcing, setAnnouncing] = useState<"have" | "want" | null>(null);
  const [pending, startTransition] = useTransition();

  const length = Array.from(body).length;
  const send = () => {
    const check = checkChatBody(body);
    if (!check.ok) {
      setError(chatErrorText(check.reason));
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await sendChatMessage(roomId, check.body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody("");
      onSent();
    });
  };

  if (!canWrite.ok) {
    return (
      <div className="border-t border-white/10 p-3">
        <div className="rounded-sm border border-cyan/25 bg-cyan/[0.06] p-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan/80">
            Lecture seule pour l&apos;instant
          </p>
          {canWrite.muted ? (
            <p className="mt-1 text-[12px] text-white/60">
              {canWrite.mutedUntil
                ? `Mise au silence jusqu'à ${formatChatTime(canWrite.mutedUntil)}. Tu peux toujours lire le salon.`
                : "Mise au silence définitive. Tu peux toujours lire le salon."}
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-[12px] text-white/60">
              {canWrite.boostersNeeded > 0 && (
                <li>
                  Ouvre encore <span className="text-white/85">{canWrite.boostersNeeded}</span>{" "}
                  booster{canWrite.boostersNeeded > 1 ? "s" : ""} (
                  {canWrite.boosters + canWrite.boostersNeeded} au total, tu en as{" "}
                  {canWrite.boosters}).
                </li>
              )}
              {canWrite.hoursLeft > 0 && (
                <li>
                  Ton compte doit avoir{" "}
                  <span className="text-white/85">{canWrite.hoursNeeded} h</span> : encore{" "}
                  {canWrite.hoursLeft} h.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 p-3">
      {error && (
        <p role="alert" className="mb-2 text-[11px] text-rose-300">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={MAX_CHAT_BODY * 2}
            placeholder="Écris un message… (Entrée pour envoyer)"
            aria-label="Ton message"
            className="field resize-none py-2 text-[13px] leading-relaxed"
          />
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <button
              type="button"
              onClick={() => setAnnouncing("have")}
              className="chip text-white/50 hover:text-cyan"
            >
              + Annoncer une carte
            </button>
            <span className={length > MAX_CHAT_BODY ? "text-rose-300" : "text-white/30"}>
              {length}/{MAX_CHAT_BODY}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={send}
          disabled={pending || length === 0 || length > MAX_CHAT_BODY}
          className="btn btn-primary btn-sm h-9 shrink-0"
        >
          {pending ? "…" : "Envoyer"}
        </button>
      </div>

      {announcing && (
        <AnnounceDialog
          kind={announcing}
          roomId={roomId}
          cardOptions={cardOptions}
          onClose={() => setAnnouncing(null)}
          onDone={() => {
            setAnnouncing(null);
            onSent();
          }}
        />
      )}
    </div>
  );
}

/**
 * Choix de la carte à annoncer.
 *
 * « J'échange » ne liste que les doublons ; « Je cherche » les cartes
 * absentes ou présentes dans les envies. La base revérifie chacune de ces
 * deux règles : la liste n'est qu'une aide à la saisie.
 */
function AnnounceDialog({
  kind,
  roomId,
  cardOptions,
  onClose,
  onDone,
}: {
  kind: "have" | "want";
  roomId: number;
  cardOptions: ChatCardOptions;
  onClose: () => void;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // La saisie reste instantanée : la liste se recalcule sur la valeur différée.
  const deferredQuery = useDeferredValue(query);
  const panelRef = useRef<HTMLDivElement>(null);

  // Le focus entre une seule fois : un re-rendu du panneau ne doit pas le
  // reprendre au champ de recherche pendant la frappe.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const retired = useMemo(() => new Set(cardOptions.retired), [cardOptions.retired]);
  const wishlist = useMemo(() => new Set(cardOptions.wishlist), [cardOptions.wishlist]);

  const candidates = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();

    return CARDS.filter((card) => {
      if (retired.has(card.id)) return false;
      const quantity = cardOptions.quantities[card.id] ?? 0;

      if (kind === "have" && quantity < 2) return false;
      if (kind === "want" && quantity > 0 && !wishlist.has(card.id)) return false;
      if (!normalized) return true;

      return (
        card.name.toLowerCase().includes(normalized) ||
        card.universe.toLowerCase().includes(normalized)
      );
    })
      .sort((a, b) => SORT_FR.compare(a.name, b.name))
      .slice(0, 60);
  }, [retired, wishlist, cardOptions.quantities, kind, deferredQuery]);

  const submit = () => {
    if (!selected) {
      setError("Choisis une carte.");
      return;
    }

    startTransition(async () => {
      const result = await announceCard(kind, selected, roomId, note);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone();
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={kind === "have" ? "Proposer une carte à l'échange" : "Chercher une carte"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4"
    >
      <div ref={panelRef} tabIndex={-1} className="panel w-full max-w-md p-4 outline-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="display text-lg">
              {kind === "have" ? "J'échange" : "Je cherche"}
            </h3>
            <p className="mt-0.5 text-[11px] text-white/45">
              {kind === "have"
                ? "Seuls les doublons peuvent être proposés."
                : "Cartes absentes de ta collection ou présentes dans tes envies."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher une carte…"
          aria-label="Rechercher une carte"
          className="field mt-3 py-2 text-xs"
        />

        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
          {candidates.length === 0 && (
            <li className="px-1 py-3 text-center text-[11px] text-white/35">
              {kind === "have"
                ? "Aucun doublon disponible pour l'instant."
                : "Aucune carte à chercher : tout est déjà dans ta collection."}
            </li>
          )}
          {candidates.map((card) => {
            const active = selected === card.id;
            return (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => setSelected(card.id)}
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between gap-2 rounded-sm border px-2 py-1.5 text-left text-[12px] transition ${
                    active
                      ? "border-cyan/60 bg-cyan/10 text-white"
                      : "border-white/10 text-white/70 hover:border-white/25"
                  }`}
                >
                  <span className="min-w-0 truncate">{card.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-white/35">
                    {RARITY[card.rarity].short}
                    {kind === "have" && ` ×${cardOptions.quantities[card.id] ?? 0}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={MAX_CHAT_BODY}
          placeholder="Un mot pour accompagner l'annonce (facultatif)"
          aria-label="Texte de l'annonce"
          className="field mt-2 resize-none py-2 text-xs"
        />

        {error && (
          <p role="alert" className="mt-2 text-[11px] text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm">
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !selected}
            className="btn btn-primary btn-sm"
          >
            {pending ? "Publication…" : "Publier l'annonce"}
          </button>
        </div>
      </div>
    </div>
  );
}

