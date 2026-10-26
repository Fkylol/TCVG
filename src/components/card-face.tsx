"use client";

import Image from "next/image";
import { useState } from "react";
import { CARDS, getCardGradient, getCardNumber, getUniverseLabel, type Card } from "@/lib/cards";
import { RARITY } from "@/lib/game";
import { getCardArt } from "@/lib/card-art";
import { cardStats } from "@/lib/stats";
import { useCardTilt } from "@/lib/use-card-tilt";
import { VARIANT_HINTS, VARIANT_LABELS, type CardVariant } from "@/lib/variants";

export type { CardVariant };

type Size = "sm" | "md" | "lg" | "xl";

/**
 * Tailles de rendu. Le CSS (`[data-size]`) gère rayon, typographie et marges ;
 * ici on ne garde que ce que le composant doit connaître.
 */
const SIZES: Record<Size, { emoji: string; imageSizes: string }> = {
  sm: { emoji: "text-3xl", imageSizes: "(max-width: 640px) 30vw, 140px" },
  md: { emoji: "text-5xl", imageSizes: "(max-width: 640px) 45vw, 260px" },
  lg: { emoji: "text-7xl", imageSizes: "(max-width: 640px) 70vw, 380px" },
  // Révélation de booster : la carte occupe la scène, typographie comprise.
  xl: { emoji: "text-8xl", imageSizes: "(max-width: 640px) 86vw, 380px" },
};

/**
 * Variantes misprint : un défaut d'impression cosmétique, jamais une règle de
 * jeu. `normal` est la carte de base ; les autres valeurs sont stylées par le
 * CSS (`[data-variant]`). Les clés et libellés vivent dans `lib/variants`.
 */

export function CardFace({
  card,
  size = "md",
  className = "",
  tilt = true,
  variant = "normal",
  muted = false,
  retired = false,
}: {
  card: Card;
  size?: Size;
  className?: string;
  /** `false` quand un parent porte déjà l'inclinaison (carte retournable). */
  tilt?: boolean;
  /** Défaut d'impression cosmétique (voir `CardVariant`). */
  variant?: CardVariant;
  /** Carte non possédée : rendue en niveaux de gris, contenu lisible. */
  muted?: boolean;
  /** Carte retirée du catalogue : le visuel est coupé, la carte reste lisible. */
  retired?: boolean;
}) {
  const { from, to } = getCardGradient(card);
  const rarity = RARITY[card.rarity];
  const s = SIZES[size];
  // Une carte retirée (par la base ou par `cards.ts`) n'affiche plus son
  // visuel : elle garde son dégradé et son emoji, pour que la collection
  // reste lisible sans image orpheline.
  const gone = retired || card.retired === true;
  const art = gone ? null : getCardArt(card.id);
  const stats = cardStats(card);
  const number = getCardNumber(card.id);
  const total = CARDS.length;
  // Certains CDN (Fandom) filtrent les requêtes : si l'image échoue, on revient
  // au rendu généré plutôt que d'afficher une vignette cassée.
  const [imageFailed, setImageFailed] = useState(false);
  const showArt = Boolean(art) && !imageFailed;
  // Inclinaison + reflet + foil : le CSS lit les variables posées au survol.
  // Désactivée quand le parent gère lui-même l'inclinaison : les variables
  // CSS descendent alors jusqu'ici, le reflet continue de suivre le pointeur.
  const tiltHandlers = useCardTilt<HTMLDivElement>();

  return (
    <div
      {...(tilt ? tiltHandlers : {})}
      data-rarity={card.rarity}
      data-size={size}
      data-variant={variant}
      data-muted={muted ? "true" : undefined}
      data-retired={gone ? "true" : undefined}
      className={`card-face card-shine ${className}`}
    >
      {/* Foil de la carte entière : posé sous l'illustration, il ne sort que
          sur les marges (reverse holo des hautes raretés). */}
      <div className="card-foil" aria-hidden />

      <div className="card-head">
        <p className="card-name" title={card.name}>
          {card.name}
        </p>
        <span className="card-badge" title={rarity.label} aria-label={`Rareté ${rarity.label}`}>
          {rarity.short}
        </span>
      </div>

      {/* Visuel encadré : l'artwork garde ses propres coins arrondis, comme une
          vignette collée sur le carton. */}
      <div
        className="card-art"
        style={{ background: `radial-gradient(115% 90% at 50% -5%, ${from} 0%, ${to} 62%, ${to} 100%)` }}
      >
        {showArt && art ? (
          <Image
            src={art.src}
            alt={`Visuel de ${card.name}`}
            fill
            sizes={s.imageSizes}
            unoptimized={!art.local}
            style={art.framing}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className={`card-emoji ${s.emoji}`} aria-hidden>
            {card.emoji}
          </span>
        )}

        {/* Ombre basse : le numéro d'album reste lisible sur le visuel. */}
        <span className="card-art-shade" aria-hidden />
        <span className="card-number">
          #{String(number ?? 0).padStart(2, "0")}/{total}
        </span>

        {(variant !== "normal" || gone) && (
          <span className="card-tags">
            {variant !== "normal" && (
              <span className="card-misprint" title={VARIANT_HINTS[variant]}>
                {VARIANT_LABELS[variant]}
              </span>
            )}
            {gone && (
              <span className="card-misprint card-retired" title="Retirée du catalogue">
                Retirée
              </span>
            )}
          </span>
        )}

        <div className="card-glare" aria-hidden />
        <div className="holo" aria-hidden />
        <div className="card-sparkle" aria-hidden />
        <div className="grain" aria-hidden />
      </div>

      <p className="card-universe">{getUniverseLabel(card.universe)}</p>

      <div className="card-stats">
        <span>POW {stats.power}</span>
        <span>AURA {stats.aura}</span>
      </div>
    </div>
  );
}
