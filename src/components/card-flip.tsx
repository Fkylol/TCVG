"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Durée du retournement : pendant ce temps les effets lourds sont coupés. */
const FLIP_MS = 520;
import { createPortal } from "react-dom";
import { CardFace } from "@/components/card-face";
import { CARDS, getCardNumber, getUniverseLabel, type Card } from "@/lib/cards";
import { RARITY } from "@/lib/game";
import { cardStats } from "@/lib/stats";
import { useCardTilt } from "@/lib/use-card-tilt";
import { VARIANT_LABELS, type CardVariant } from "@/lib/variants";

// Mois abrégés : la date tient sur une ligne dans une case étroite.
const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/**
 * Date formatée en UTC : le rendu serveur et l'hydratation produisent la même
 * chaîne, quel que soit le fuseau du navigateur.
 */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * Carte de la collection : la tuile ouvre une visionneuse plein écran, carte
 * centrée sur fond assombri. Un clic sur la carte la retourne, un second la
 * remet à l'endroit ; Échap, la croix ou le fond ferment la visionneuse.
 *
 * L'inclinaison 3D de la visionneuse est portée par le conteneur : elle reste
 * active une fois la carte retournée, et le reflet suit le pointeur sur les
 * deux faces.
 */
export function CardFlip({
  card,
  firstObtainedAt,
  owners,
  variant = "normal",
  retired = false,
}: {
  card: Card;
  firstObtainedAt: string;
  /** Joueurs possédant la carte, `null` quand le compteur est indisponible. */
  owners: number | null;
  /** Misprint de la copie possédée, appliqué aux deux faces. */
  variant?: CardVariant;
  /** Carte retirée : visuel coupé, étiquette sur la face et le verso. */
  retired?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const tilt = useCardTilt<HTMLDivElement>();
  const closeButton = useRef<HTMLButtonElement>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rarity = RARITY[card.rarity];
  const stats = cardStats(card);
  const number = getCardNumber(card.id) ?? 0;

  // Échap ferme, le défilement de la page est gelé pendant l'ouverture.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  /**
   * Retourne la carte. Le foil, les paillettes et le reflet sont des calques
   * `mix-blend-mode` : les faire pivoter avec la carte en 3D coûtait une
   * recomposition complète à chaque image, d'où les saccades. Ils sont coupés
   * le temps du retournement (`data-flipping`) puis réapparaissent.
   */
  function toggle() {
    setFlipping(true);
    setFlipped((value) => !value);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => setFlipping(false), FLIP_MS + 80);
  }

  useEffect(
    () => () => {
      if (flipTimer.current) clearTimeout(flipTimer.current);
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFlipped(false);
          setOpen(true);
        }}
        className="collection-tile block w-full rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-acid/70"
        aria-haspopup="dialog"
        aria-label={`Ouvrir la carte ${card.name}`}
      >
        {/* Pas d'inclinaison dans la grille : la tuile s'élève au survol, et
            l'effet 3D reste réservé à la visionneuse plein écran. */}
        <CardFace
          card={card}
          size="sm"
          className="aspect-[3/4]"
          tilt={false}
          variant={variant}
          retired={retired}
        />
      </button>

      {/* La visionneuse n'existe qu'après un clic : le portail n'est jamais
          rendu côté serveur, donc `document` est toujours défini ici. */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Carte ${card.name}`}
            className="card-viewer"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Fermer"
              onClick={() => setOpen(false)}
            />

            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              className="fixed right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 text-lg text-white/70 transition hover:border-white/50 hover:text-white"
              aria-label="Fermer"
            >
              ✕
            </button>

            <div className="flip-stage relative flex w-full max-w-[min(92vw,380px)] flex-col items-center">
              <div
                {...tilt}
                data-flipped={flipped}
                data-flipping={flipping ? "true" : undefined}
                data-rarity={card.rarity}
                className="card-flip-tilt w-full"
              >
                <div className="card-flip" data-flipped={flipped}>
                  <button
                    type="button"
                    className="card-flip-face card-flip-front"
                    aria-pressed={flipped}
                    aria-label={`Retourner la carte ${card.name}`}
                    tabIndex={flipped ? -1 : 0}
                    onClick={toggle}
                  >
                    <CardFace
                      card={card}
                      size="md"
                      className="h-full w-full"
                      tilt={false}
                      variant={variant}
                      retired={retired}
                    />
                  </button>

                  {/* Un clic n'importe où sur le verso le remet à l'endroit ; le
                      lien de fiche et le bouton ↺ gardent leur propre action. */}
                  <div
                    className="card-flip-face card-flip-back"
                    aria-hidden={!flipped}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a")) return;
                      setFlipped(false);
                    }}
                  >
                    <div className="flip-back-top">
                      <span className="flip-back-rarity">{rarity.label}</span>
                      <span className="flip-back-number">
                        #{String(number).padStart(2, "0")}/{CARDS.length}
                      </span>
                    </div>

                    {(variant !== "normal" || retired) && (
                      <p className="flip-back-tags">
                        {variant !== "normal" && (
                          <span className="flip-back-tag">{VARIANT_LABELS[variant]}</span>
                        )}
                        {retired && <span className="flip-back-tag">Retirée du catalogue</span>}
                      </p>
                    )}

                    <p className="flip-back-name">{card.name}</p>
                    <p className="flip-back-universe">{getUniverseLabel(card.universe)}</p>

                    <div className="flip-back-grid">
                      <div className="flip-back-cell">
                        <span>POW</span>
                        <strong>{stats.power}</strong>
                      </div>
                      <div className="flip-back-cell">
                        <span>AURA</span>
                        <strong>{stats.aura}</strong>
                      </div>
                      <div className="flip-back-cell">
                        <span>Possesseurs</span>
                        <strong>
                          {owners === null ? "—" : owners.toLocaleString("fr-FR")}
                        </strong>
                      </div>
                      <div className="flip-back-cell">
                        <span>Depuis le</span>
                        <strong className="flip-back-date">{formatDate(firstObtainedAt)}</strong>
                      </div>
                    </div>

                    <div className="flip-back-foot">
                      <Link
                        href={`/card/${card.id}`}
                        className="flip-back-link"
                        tabIndex={flipped ? 0 : -1}
                      >
                        Voir la fiche du perso
                      </Link>
                      <button
                        type="button"
                        className="flip-back-return"
                        aria-label="Remettre la carte à l'endroit"
                        tabIndex={flipped ? 0 : -1}
                        onClick={() => setFlipped(false)}
                      >
                        ↺
                      </button>
                    </div>

                    <div className="card-glare" aria-hidden />
                    <div className="holo" aria-hidden />
                    <div className="grain" aria-hidden />
                  </div>
                </div>
              </div>

              <p className="mt-5 whitespace-nowrap text-center font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
                Clique la carte pour la retourner · Échap ferme
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
