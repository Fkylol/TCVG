"use client";

import Image from "next/image";
import { useState } from "react";
import { CARDS, getCardGradient, getCardNumber, getUniverseLabel, type Card } from "@/lib/cards";
import { RARITY } from "@/lib/game";
import { getPortrait } from "@/lib/portraits";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { name: string; universe: string; emoji: string; stat: string; pad: string; radius: string }> = {
  sm: { name: "text-[13px] leading-tight", universe: "text-[9px]", emoji: "text-5xl", stat: "text-[10px]", pad: "p-2.5", radius: "rounded-xl" },
  md: { name: "text-base leading-tight", universe: "text-[10px]", emoji: "text-7xl", stat: "text-xs", pad: "p-3.5", radius: "rounded-2xl" },
  lg: { name: "text-xl leading-tight", universe: "text-xs", emoji: "text-9xl", stat: "text-sm", pad: "p-5", radius: "rounded-3xl" },
};

export function CardFace({
  card,
  size = "md",
  className = "",
}: {
  card: Card;
  size?: Size;
  className?: string;
}) {
  const { from, to } = getCardGradient(card);
  const rarity = RARITY[card.rarity];
  const s = SIZES[size];
  const portrait = getPortrait(card.id);
  const number = getCardNumber(card.id);
  const total = CARDS.length;
  // Certains CDN (Fandom) filtrent les requêtes : si l'image échoue, on revient
  // au rendu généré plutôt que d'afficher une vignette cassée.
  const [imageFailed, setImageFailed] = useState(false);
  const showPortrait = Boolean(portrait) && !imageFailed;

  return (
    <div
      data-rarity={card.rarity}
      className={`card-face card-shine ring-1 ${rarity.ring} ${s.radius} ${className}`}
      // Fond propre à l'univers de la carte, derrière un render plein cadre.
      style={{ background: `radial-gradient(115% 90% at 50% -5%, ${from} 0%, ${to} 62%, ${to} 100%)` }}
    >
      {showPortrait && portrait && (
        <>
          {/* Hotlink direct : `unoptimized` évite que Next recopie le fichier. */}
          <Image
            src={portrait.url}
            alt={`Visuel de ${card.name}`}
            fill
            sizes="(max-width: 640px) 45vw, 280px"
            unoptimized
            className="object-cover object-top"
            onError={() => setImageFailed(true)}
          />
          {/* Dégradé de lisibilité : le nom en haut et les stats en bas restent
              lisibles quel que soit le visuel. */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/70 via-black/5 to-black/85" />
          <div className="absolute inset-0 z-[1] bg-[radial-gradient(120%_85%_at_50%_35%,transparent_40%,rgba(0,0,0,0.45)_100%)]" />
        </>
      )}

      <div className={`relative z-[2] flex h-full flex-col ${s.pad}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate font-semibold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] ${s.name}`}>
              {card.name}
            </p>
            <p className={`truncate uppercase tracking-wider text-white/60 drop-shadow ${s.universe}`}>
              {getUniverseLabel(card.universe)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 font-bold backdrop-blur ${s.stat} ${rarity.badge}`}
            title={rarity.label}
          >
            {rarity.short}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          {!showPortrait && (
            <span className={`${s.emoji} drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]`} aria-hidden>
              {card.emoji}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          {/* Numéro d'album : repère de collection, comme le #0001/6736 des cartes
              de référence. Il remplace les anciennes stats de combat. */}
          <span
            className={`whitespace-nowrap font-mono text-white/80 drop-shadow ${s.stat}`}
            title={`Carte n° ${number ?? "?"} sur ${total}`}
          >
            #{String(number ?? 0).padStart(2, "0")}
          </span>
          {/* Sur les vignettes, le libellé de rareté ne tient pas à côté du numéro :
              le badge en haut à droite porte déjà l'information. */}
          {size !== "sm" && (
            <span
              className={`shrink-0 whitespace-nowrap font-semibold uppercase tracking-widest text-white/50 ${s.universe}`}
            >
              {rarity.label}
            </span>
          )}
        </div>
      </div>

      {!showPortrait && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.22),transparent_62%)]" />
          {/* Motif de repli : anneaux façon dos de carte, pour que l'absence de photo
              ressemble à un choix graphique et non à une image cassée. */}
          <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[80%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />
            <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
            <div className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/15 blur-2xl" />
          </div>
        </>
      )}
      {/* Le voile iridescent existe pour toutes les raretés : c'est le CSS qui
          décide de son intensité (`--holo-opacity`), nul pour le Commun. */}
      <div className="holo pointer-events-none absolute inset-0 z-[1]" />
      <div className="grain pointer-events-none absolute inset-0 z-[1] opacity-30" />
    </div>
  );
}
