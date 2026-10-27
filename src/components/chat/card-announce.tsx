"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { announceCardHere } from "@/app/actions/chat";
import { APP_CHAT_NAME, CHAT_DEFAULTS, MAX_CHAT_BODY } from "@/lib/chat/config";

/**
 * Annonce d'une carte depuis sa fiche, sans passer par le panneau du marché.
 *
 * Deux chemins seulement, ceux que la base accepte : proposer un doublon
 * (« J'échange ») ou chercher une carte absente / présente dans les envies
 * (« Je cherche »). La vérification finale reste côté serveur ; ces boutons
 * évitent juste de proposer une action qui serait refusée.
 */
export function CardAnnounce({
  cardId,
  cardName,
  canOffer,
  canSeek,
}: {
  cardId: string;
  cardName: string;
  /** Au moins deux exemplaires : la carte peut être proposée à l'échange. */
  canOffer: boolean;
  /** Carte absente de la collection, ou déjà dans les envies. */
  canSeek: boolean;
}) {
  const [kind, setKind] = useState<"have" | "want" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<"have" | "want" | null>(null);
  const [pending, startTransition] = useTransition();

  // Ni doublon ni carte manquante : rien à annoncer depuis cette fiche.
  if (!canOffer && !canSeek) return null;

  const length = Array.from(note).length;

  const publish = () => {
    if (!kind) return;

    startTransition(async () => {
      const result = await announceCardHere(kind, cardId, note);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setError(null);
      setNote("");
      setKind(null);
      setPublished(kind);
    });
  };

  return (
    <section className="panel p-4" aria-label={`Annoncer ${cardName} dans ${APP_CHAT_NAME}`}>
      <p className="eyebrow">{APP_CHAT_NAME}</p>
      <h2 className="display mt-1 text-lg">Échanger cette carte</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-white/40">
        L&apos;annonce part dans ton salon habituel, avec la carte embarquée et la mention
        « Il te manque » ou « Tu l&apos;as déjà » calculée pour chaque lecteur.
      </p>

      {published ? (
        <div className="mt-3 space-y-2">
          <p
            role="status"
            className="border-l-2 border-cyan/60 bg-cyan/[0.06] px-3 py-2 text-[11px] leading-relaxed text-white/70"
          >
            {published === "have"
              ? `${cardName} est proposée à l'échange.`
              : `Tu cherches ${cardName} dans le chat.`}{" "}
            L&apos;annonce expire dans {CHAT_DEFAULTS.announcementMinutes} minutes.
          </p>
          <Link href="/agora" className="btn btn-outline btn-sm w-full">
            Voir dans {APP_CHAT_NAME} →
          </Link>
          <button
            type="button"
            onClick={() => setPublished(null)}
            className="text-[11px] text-white/35 transition hover:text-white/70"
          >
            Annoncer autre chose
          </button>
        </div>
      ) : kind === null ? (
        <div className="mt-3 space-y-2">
          {canOffer && (
            <button
              type="button"
              onClick={() => {
                setKind("have");
                setError(null);
              }}
              className="btn btn-outline btn-sm w-full"
            >
              Proposer mon doublon à l&apos;échange
            </button>
          )}
          {canSeek && (
            <button
              type="button"
              onClick={() => {
                setKind("want");
                setError(null);
              }}
              className="btn btn-outline btn-sm w-full"
            >
              Chercher cette carte dans {APP_CHAT_NAME}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-white/50">
            {kind === "have" ? "J'échange" : "Je cherche"} · {cardName}
          </p>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={MAX_CHAT_BODY}
            placeholder="Un mot pour accompagner l'annonce (facultatif)"
            aria-label="Texte de l'annonce"
            className="field resize-none py-2 text-xs"
          />
          <div className="flex items-center justify-between text-[10px] text-white/30">
            <span>300 caractères au plus</span>
            <span className={length > MAX_CHAT_BODY ? "text-rose-300" : ""}>
              {length}/{MAX_CHAT_BODY}
            </span>
          </div>

          {error && (
            <p role="alert" className="text-[11px] leading-relaxed text-rose-300">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setKind(null);
                setError(null);
              }}
              className="btn btn-outline btn-sm flex-1"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={publish}
              disabled={pending}
              className="btn btn-primary btn-sm flex-1"
            >
              {pending ? "Publication…" : "Publier"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
