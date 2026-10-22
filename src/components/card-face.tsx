import Image from "next/image";
import { getCardGradient, getUniverseLabel, type Card } from "@/lib/cards";
import { RARITY } from "@/lib/game";
import { getPortrait } from "@/lib/portraits";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { name: string; universe: string; emoji: string; stat: string; pad: string; radius: string }> = {
  sm: { name: "text-[13px] leading-tight", universe: "text-[9px]", emoji: "text-4xl", stat: "text-[10px]", pad: "p-2.5", radius: "rounded-xl" },
  md: { name: "text-base leading-tight", universe: "text-[10px]", emoji: "text-6xl", stat: "text-xs", pad: "p-3.5", radius: "rounded-2xl" },
  lg: { name: "text-xl leading-tight", universe: "text-xs", emoji: "text-8xl", stat: "text-sm", pad: "p-5", radius: "rounded-3xl" },
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
  const premium = card.rarity === "UR" || card.rarity === "L";
  const s = SIZES[size];
  const portrait = getPortrait(card.id);

  return (
    <div
      className={`card-face card-shine ring-1 ${rarity.ring} ${s.radius} ${className}`}
      style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}
    >
      {portrait && (
        <>
          {/* Hotlink direct vers Wikipédia : `unoptimized` évite que Next recopie le fichier. */}
          <Image
            src={portrait.url}
            alt={`Visuel de ${card.name}`}
            fill
            sizes="(max-width: 640px) 45vw, 280px"
            unoptimized
            className="object-cover object-top"
          />
          <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/70 via-black/5 to-black/85" />
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
          {!portrait && (
            <span className={`${s.emoji} drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]`} aria-hidden>
              {card.emoji}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className={`flex gap-2 font-mono text-white/90 drop-shadow ${s.stat}`}>
            <span title="Attaque">⚔ {card.atk.toLocaleString("fr-FR")}</span>
            <span title="Défense">🛡 {card.def.toLocaleString("fr-FR")}</span>
          </div>
          <span className={`font-semibold uppercase tracking-widest text-white/50 ${s.universe}`}>
            {rarity.label}
          </span>
        </div>
      </div>

      {!portrait && (
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.22),transparent_62%)]" />
      )}
      {premium && <div className="holo pointer-events-none absolute inset-0 z-[1]" />}
      <div className="grain pointer-events-none absolute inset-0 z-[1] opacity-30" />
    </div>
  );
}
