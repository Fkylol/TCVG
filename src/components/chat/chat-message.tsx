"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  blockChatUser,
  clearChatAnnouncements,
  deleteChatMessage,
  loadChatUserHistory,
  moderateDeleteMessage,
  muteChatUser,
  reportChatMessage,
  withdrawChatAnnouncement,
} from "@/app/actions/chat";
import { OfferDialog } from "@/components/chat/offer-dialog";
import { AvatarFrame } from "@/components/avatar-frame";
import { getCardArt } from "@/lib/card-art";
import { getCard, getUniverseLabel } from "@/lib/cards";
import {
  formatChatDateTime,
  formatChatTime,
  MUTE_CHOICES,
  REPORT_REASONS,
} from "@/lib/chat/config";
import type { ChatMessage, ChatUserHistory } from "@/lib/chat/types";
import { chatErrorText } from "@/lib/chat/text";
import { rarityColorVar } from "@/lib/rarity";
import { RARITY } from "@/lib/game";

/**
 * Une ligne du fil : message système discret, texte, ou annonce avec sa carte.
 *
 * Les actions sont contextuelles : signaler et bloquer pour tout le monde,
 * supprimer pour l'auteur, et le menu de modération pour les administrateurs.
 * Chaque action est confirmée en base ; l'interface ne fait que refléter la
 * réponse et redemander le fil.
 */
export function ChatMessageRow({
  message,
  admin,
  currentUserId,
  onChanged,
}: {
  message: ChatMessage;
  admin: boolean;
  currentUserId: string;
  onChanged: () => void;
}) {
  const [menu, setMenu] = useState<"none" | "actions" | "report">("none");
  const [offerOpen, setOfferOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<ChatUserHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? chatErrorText("error"));
        return;
      }
      setMenu("none");
      onChanged();
    });
  };

  if (message.kind === "system") {
    return (
      <p className="px-1 py-1 text-center text-[11px] italic text-white/30">{message.body}</p>
    );
  }

  const card = message.cardId ? getCard(message.cardId) : undefined;
  const art = card ? getCardArt(card.id) : null;
  const avatarArt = message.avatarCardId ? getCardArt(message.avatarCardId) : null;
  const username = message.username ?? "Joueur supprimé";
  const initial = username.trim().charAt(0).toUpperCase() || "?";
  const isAnnouncement = message.kind === "have" || message.kind === "want";
  const activeAnnouncement = message.announcement?.status === "active";

  return (
    <article className="group relative rounded-sm px-1.5 py-1.5 transition hover:bg-white/[0.03]">
      <div className="flex gap-2.5">
        <AvatarFrame
          avatar={avatarArt}
          initial={initial}
          size={28}
          frameId={message.frame}
          className="mt-0.5"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold text-white/80">{username}</span>
            {isAnnouncement && (
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                  message.kind === "have" ? "text-acid/80" : "text-white/65"
                }`}
              >
                {message.kind === "have" ? "J'échange" : "Je cherche"}
              </span>
            )}
            <time dateTime={message.createdAt} className="font-mono text-[10px] text-white/30">
              {formatChatTime(message.createdAt)}
            </time>
            {message.mine && <span className="text-[10px] text-white/25">toi</span>}
          </div>

          {message.body && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/75">
              {message.body}
            </p>
          )}

          {isAnnouncement && card && (
            <div
              className={`mt-2 flex items-center gap-3 rounded-sm border bg-black/30 p-2 ${
                activeAnnouncement ? "" : "opacity-55"
              }`}
              style={{ borderColor: `var(${rarityColorVar(card.rarity)})` }}
            >
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-sm bg-white/5">
                {art ? (
                  <Image
                    src={art.src}
                    alt={`Visuel de ${card.name}`}
                    width={48}
                    height={64}
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
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white/90">{card.name}</p>
                <p className="truncate text-[10px] text-white/45">
                  {getUniverseLabel(card.universe)} · {RARITY[card.rarity].label}
                </p>
                <p
                  className={`mt-0.5 text-[11px] ${message.owned > 0 ? "text-white/40" : "text-acid"}`}
                >
                  {message.owned > 0 ? "Tu l'as déjà" : "Il te manque"}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Link href={`/card/${card.id}`} className="btn btn-outline btn-sm">
                  Voir la fiche
                </Link>

                {/* « J'échange » : on propose une autre carte. « Je cherche » :
                    on apporte la carte demandée, si on la possède. */}
                {!message.mine &&
                  activeAnnouncement &&
                  message.announcement &&
                  (message.kind === "have" || message.owned > 0) && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setOfferOpen(true)}
                    >
                      {message.kind === "have" ? "Proposer un échange" : "Faire une offre"}
                    </button>
                  )}

                <span className="text-[9px] text-white/30">
                  {activeAnnouncement && message.announcement
                    ? `jusqu'à ${formatChatTime(message.announcement.expiresAt)}`
                    : "annonce close"}
                </span>
              </div>
            </div>
          )}

          {isAnnouncement && !card && (
            <p className="mt-1 text-[11px] text-white/40">Carte retirée du catalogue.</p>
          )}

          {notice && <p className="mt-1 text-[11px] text-acid">{notice}</p>}
          {error && <p className="mt-1 text-[11px] text-rose-300">{error}</p>}
        </div>

        <button
          type="button"
          aria-label="Actions sur le message"
          aria-expanded={menu !== "none"}
          onClick={() => setMenu(menu === "none" ? "actions" : "none")}
          className="h-7 w-7 shrink-0 rounded-sm text-white/25 opacity-0 transition hover:bg-white/5 hover:text-white/70 focus-visible:opacity-100 group-hover:opacity-100"
        >
          ⋯
        </button>
      </div>

      {offerOpen && message.announcement && card && (
        <OfferDialog
          mode="offer"
          announcement={{
            id: message.announcement.id,
            kind: message.kind === "have" ? "have" : "want",
            cardId: card.id,
          }}
          onClose={() => setOfferOpen(false)}
          onDone={(text) => {
            setOfferOpen(false);
            setNotice(text);
            onChanged();
          }}
        />
      )}

      {menu === "actions" && (
        <div className="ml-9 mt-1 flex flex-wrap gap-1.5 text-[11px]">
          <button
            type="button"
            className="chip text-white/50 hover:text-white"
            onClick={() => setMenu("report")}
          >
            Signaler
          </button>

          {message.userId && message.userId !== currentUserId && (
            <button
              type="button"
              className="chip text-white/50 hover:text-white"
              disabled={pending}
              onClick={() => run(() => blockChatUser(message.userId as string))}
            >
              Bloquer
            </button>
          )}

          {message.mine && (
            <button
              type="button"
              className="chip text-white/50 hover:text-white"
              disabled={pending}
              onClick={() => run(() => deleteChatMessage(message.id))}
            >
              Supprimer
            </button>
          )}

          {message.mine && message.announcement?.status === "active" && (
            <button
              type="button"
              className="chip text-white/50 hover:text-white"
              disabled={pending}
              onClick={() => run(() => withdrawChatAnnouncement(message.announcement!.id))}
            >
              Retirer l&apos;annonce
            </button>
          )}

          {admin && (
            <>
              <span aria-hidden className="mx-1 h-4 w-px bg-white/15" />
              <button
                type="button"
                className="chip text-rose-300/80 hover:text-rose-200"
                disabled={pending}
                onClick={() => {
                  const reason = window.prompt("Raison de la suppression (facultatif)") ?? "";
                  run(() => moderateDeleteMessage(message.id, reason));
                }}
              >
                Modération : supprimer
              </button>
              {message.userId && (
                <button
                  type="button"
                  className="chip text-white/50 hover:text-white"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const result = await loadChatUserHistory(message.userId as string);
                      if (!result.ok) {
                        setError(result.message);
                        return;
                      }
                      setHistory(result.history);
                    });
                  }}
                >
                  Historique
                </button>
              )}
              {message.userId && (
                <>
                  {MUTE_CHOICES.map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      className="chip text-amber-200/70 hover:text-amber-100"
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt("Raison de la mise au silence (facultatif)") ?? "";
                        run(() => muteChatUser(message.userId as string, choice.minutes, reason));
                      }}
                    >
                      Mute {choice.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chip text-amber-200/70 hover:text-amber-100"
                    disabled={pending}
                    onClick={() => run(() => clearChatAnnouncements(message.userId as string))}
                  >
                    Retirer ses annonces
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {history && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Historique des messages"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4"
        >
          <div className="panel w-full max-w-lg p-4">
            <header className="flex items-start justify-between gap-2">
              <div>
                <h3 className="display text-base">
                  Historique de {history.username ?? "ce joueur"}
                </h3>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {history.messages.length} message(s), y compris supprimés.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistory(null)}
                aria-label="Fermer"
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </header>

            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto text-[11px]">
              {history.messages.length === 0 && (
                <p className="text-white/35">Aucun message enregistré.</p>
              )}
              {history.messages.map((entry) => (
                <p
                  key={entry.id}
                  className={entry.deletedAt ? "text-white/25 line-through" : "text-white/70"}
                >
                  <span className="font-mono text-white/30">
                    {formatChatDateTime(entry.createdAt)}
                  </span>{" "}
                  · {entry.body || "(annonce sans texte)"}
                </p>
              ))}
            </div>

            {history.sanctions.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-2 text-[10px] text-amber-200/70">
                {history.sanctions.map((sanction) => (
                  <p key={sanction.id}>
                    Sanction {formatChatDateTime(sanction.createdAt)} :{" "}
                    {sanction.until
                      ? `jusqu'au ${formatChatDateTime(sanction.until)}`
                      : "définitive"}
                    {sanction.liftedAt ? " (levée)" : ""}
                    {sanction.reason ? ` · ${sanction.reason}` : ""}
                  </p>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setHistory(null)}
              className="btn btn-sm btn-outline mt-3"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {menu === "report" && (
        <div className="ml-9 mt-2 rounded-sm border border-white/10 bg-black/40 p-2">
          <p className="mb-1.5 text-[11px] text-white/50">Motif du signalement</p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason.key}
                type="button"
                className="chip text-white/60 hover:text-white"
                disabled={pending}
                onClick={() => run(() => reportChatMessage(message.id, reason.key, note))}
              >
                {reason.label}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="Précision (facultatif)"
            className="field mt-2 py-1.5 text-xs"
            aria-label="Précision pour la modération"
          />
          <button
            type="button"
            onClick={() => setMenu("none")}
            className="mt-1.5 text-[11px] text-white/35 hover:text-white/60"
          >
            Annuler
          </button>
        </div>
      )}
    </article>
  );
}
