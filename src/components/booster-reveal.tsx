"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BoosterPack } from "@/components/booster-pack";
import { CardBack } from "@/components/card-back";
import { CardFace } from "@/components/card-face";
import { getUniverseLabel, type Card, type Rarity } from "@/lib/cards";
import { RARITY, rarestRarity } from "@/lib/game";
import { getCardArt } from "@/lib/card-art";
import { PACKS, type Pack } from "@/lib/packs";
import { haptic, setSoundOn, sfx, useSoundOn } from "@/lib/sfx";
import { VARIANT_LABELS, type CardVariant } from "@/lib/variants";
import { framingStyle } from "@/lib/framing";
import { MOTION_EVENT, isMotionForced } from "@/lib/motion";

export type RevealItem = {
  card: Card;
  holo: boolean;
  isNew: boolean;
  /** Total possédé après l'ouverture, pour afficher « Doublon ×N ». */
  quantity: number;
  /** Misprint éventuel tiré avec la carte. */
  variant: CardVariant;
};

/** Couleur de l'aura révélée avant les cartes, par rareté. */
const AURA: Record<Rarity, { glow: string; soft: string }> = {
  C: { glow: "rgba(255, 255, 255, 0.4)", soft: "rgba(255, 255, 255, 0.14)" },
  UC: { glow: "rgba(74, 222, 158, 0.55)", soft: "rgba(74, 222, 158, 0.2)" },
  R: { glow: "rgba(56, 189, 248, 0.62)", soft: "rgba(56, 189, 248, 0.22)" },
  SR: { glow: "rgba(167, 139, 250, 0.72)", soft: "rgba(167, 139, 250, 0.26)" },
  UR: { glow: "rgba(252, 211, 77, 0.82)", soft: "rgba(252, 211, 77, 0.3)" },
  // Pas d'arc-en-ciel : le Mythique garde un platine chaud, comme son foil.
  L: { glow: "rgba(255, 238, 190, 0.92)", soft: "rgba(255, 238, 190, 0.34)" },
};

/** Hauteur de la soudure sur le poster, en pourcentage de sa hauteur. */
const SEAM_Y = 8.4;

/**
 * Profil de la soudure, fixe plutôt qu'aléatoire : le rendu serveur et le
 * rendu client doivent produire exactement le même HTML (pas de décalage
 * d'hydratation). La ligne ondule de part en part, comme un sachet thermoscellé.
 */
const SEAM = Array.from({ length: 41 }, (_, index) => ({
  x: (index / 40) * 100,
  y: SEAM_Y + Math.sin(index * 2.7) * 0.34 + Math.sin(index * 0.9) * 0.26,
}));

/** Étincelles projetées à l'ouverture : direction, portée et retard fixes. */
const SPARKS = Array.from({ length: 18 }, (_, index) => {
  const angle = (index / 18) * Math.PI * 2 - Math.PI / 2;
  const distance = 118 + ((index * 41) % 84);
  return {
    id: index,
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
    delay: (index % 5) * 42,
    size: index % 4 === 0 ? 4 : 2,
  };
});

/**
 * Délai avant que l'écran n'accepte les clics. Le second clic d'un double-clic
 * sur « Ouvrir » retombait sinon sur la déchirure : le pack s'ouvrait puis
 * disparaissait aussitôt.
 */
const ARM_MS = 340;

/** Combien de cartes restent visibles dans l'éventail, la première devant. */
const FAN_VISIBLE = 5;

/** Durée du retournement, puis du départ de la carte vers la rangée du bas. */
const FLIP_HOLD = 900;
const LEAVE_MS = 480;

/** Au-delà, le récapitulatif quitte l'éventail pour une grille scrollable. */
const FAN_MAX = 12;

/** Raretés qui déclenchent scintillements et onde : au-dessus de Rare. */
const HOT_RARITIES: Rarity[] = ["SR", "UR", "L"];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * `pack` (booster scellé) → `tearing` (la soudure cède) → `fan` (les cartes
 * sortent et se retournent une à une) → `done` (récapitulatif).
 *
 * La déchirure se fait au doigt : on glisse le long du haut du sachet, la
 * soudure se sépare en suivant le geste, et la bande part quand le doigt
 * atteint le bord. Un simple appui lance la même ouverture en automatique.
 */
type Phase = "pack" | "tearing" | "fan" | "done";

/**
 * Animations réduites ? Seulement si le joueur a choisi « suivre le système » :
 * beaucoup de téléphones demandent la réduction dès qu'ils passent en économie
 * d'énergie, ce qui éteignait toute l'ouverture. Le mode par défaut les garde.
 */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      window.addEventListener(MOTION_EVENT, onChange);
      return () => {
        query.removeEventListener("change", onChange);
        window.removeEventListener(MOTION_EVENT, onChange);
      };
    },
    () => !isMotionForced() && window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Polygone CSS à partir de points en pourcentage. */
function polygon(points: Array<[number, number]>): string {
  return `polygon(${points
    .map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`)
    .join(",")})`;
}

/** Hauteur de la soudure à l'abscisse `x` (en pourcentage). */
function seamYAt(x: number): number {
  for (let index = 1; index < SEAM.length; index += 1) {
    const left = SEAM[index - 1];
    const right = SEAM[index];
    if (right.x >= x) {
      const ratio = (x - left.x) / (right.x - left.x || 1);
      return left.y + (right.y - left.y) * ratio;
    }
  }
  return SEAM[SEAM.length - 1].y;
}

/**
 * Les trois morceaux du sachet pour une avancée de déchirure `progress` :
 * la bande de gauche (celle que le doigt soulève), la bande de droite (restée
 * en place) et le corps du pack, découpé sous la soudure.
 */
function tearShapes(progress: number) {
  const x = progress * 100;
  const y = seamYAt(x);

  const left: Array<[number, number]> = [
    [0, 0],
    [x, 0],
    [x, y],
  ];
  for (let index = SEAM.length - 1; index >= 0; index -= 1) {
    if (SEAM[index].x < x) left.push([SEAM[index].x, SEAM[index].y]);
  }

  const right: Array<[number, number]> = [
    [x, 0],
    [100, 0],
  ];
  for (let index = SEAM.length - 1; index >= 0; index -= 1) {
    if (SEAM[index].x > x) right.push([SEAM[index].x, SEAM[index].y + 0.35]);
  }
  right.push([x, y + 0.35]);

  const body: Array<[number, number]> = SEAM.map((point) => [point.x, point.y]);
  body.push([100, 100], [0, 100]);

  return { left: polygon(left), right: polygon(right), body: polygon(body), x, y };
}

/**
 * Ouverture d'un booster : le sachet se déchire au doigt le long de la
 * soudure, une aura trahit la meilleure rareté du tirage, puis les cartes
 * sortent en éventail et se retournent au clic, de la plus discrète à la plus
 * rare. Le tirage est déjà fait côté serveur — cette séquence ne fait que
 * révéler.
 */
export function BoosterReveal({
  title,
  subtitle,
  items,
  pack = PACKS[0],
  onClose,
  closeLabel = "Retour",
}: {
  title: string;
  subtitle?: string;
  items: RevealItem[];
  /** Pack à déchirer : le poster est dupliqué dans les trois morceaux. */
  pack?: Pack;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [phase, setPhase] = useState<Phase>("pack");
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [flipped, setFlipped] = useState<number | null>(null);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  const reduced = usePrefersReducedMotion();
  const soundOn = useSoundOn();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frame = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, moved: 0, lastX: 0 });
  // Les visuels sont hotlinkés : sans préchargement, chaque carte révélée
  // attend son aller-retour réseau et s'affiche vide d'abord. On profite donc
  // du pack scellé et de la déchirure pour télécharger tout le tirage.
  const preloaded = useRef<HTMLImageElement[]>([]);

  const total = items.length;
  const current = items[Math.min(revealed, Math.max(total - 1, 0))];
  const best = rarestRarity(items.map((entry) => entry.card.rarity));
  const aura = AURA[best];
  const hot = current ? HOT_RARITIES.includes(current.card.rarity) : false;
  const shapes = tearShapes(progress);

  const newCount = new Set(items.filter((entry) => entry.isNew).map((entry) => entry.card.id)).size;
  const holoCount = items.filter((entry) => entry.holo).length;

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      sfx.stopRip();
    },
    [],
  );

  // Récapitulatif : un accord discret, jamais plus fort que le tirage.
  useEffect(() => {
    if (phase === "done") sfx.recap();
  }, [phase]);

  useEffect(() => {
    const images: HTMLImageElement[] = [];
    for (const entry of items) {
      const art = getCardArt(entry.card.id);
      if (!art) continue;
      const image = new window.Image();
      image.decoding = "async";
      image.src = art.src;
      images.push(image);
    }
    preloaded.current = images;
    return () => {
      preloaded.current = [];
    };
  }, [items]);

  // L'ouverture occupe tout l'écran : on bloque le défilement de la page.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  /** Le sachet cède : le son part, la bande s'envole, les cartes arrivent. */
  function finishOpen() {
    if (phase === "done" || phase === "fan") return;
    setProgress(1);
    setPhase("tearing");
    sfx.stopRip();
    sfx.open(best);
    haptic(best);
    later(() => setPhase("fan"), reduced ? 60 : 460);
  }

  /** Déchirure automatique : la bande suit une courbe douce jusqu'au bord. */
  function tearAutomatically() {
    if (!armed || phase !== "pack") return;
    const from = progress;
    if (reduced) {
      sfx.tear();
      finishOpen();
      return;
    }
    setPhase("tearing");
    sfx.tear();
    const start = performance.now();
    const duration = 620 * (1 - from) + 80;

    const step = (time: number) => {
      const ratio = Math.min(1, (time - start) / duration);
      // Départ et arrivée doux : la bande accroche, puis file.
      const eased = ratio < 0.5 ? 2 * ratio * ratio : 1 - (-2 * ratio + 2) ** 2 / 2;
      setProgress(from + (1 - from) * eased);
      if (ratio < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        frame.current = null;
        finishOpen();
      }
    };
    frame.current = requestAnimationFrame(step);
  }

  /** Le doigt quitte la soudure avant le bord : la bande se remet en place. */
  function settleBack() {
    const from = progress;
    if (reduced || from <= 0) {
      setProgress(0);
      setPhase("pack");
      return;
    }
    const start = performance.now();
    const step = (time: number) => {
      const ratio = Math.min(1, (time - start) / 260);
      setProgress(from * (1 - ratio));
      if (ratio < 1) frame.current = requestAnimationFrame(step);
      else {
        frame.current = null;
        setPhase("pack");
      }
    };
    frame.current = requestAnimationFrame(step);
  }

  /** Abscisse du geste, rapportée au poster (5:8) et non au cadre (3:4). */
  function packX(clientX: number, bounds: DOMRect): number {
    const width = bounds.height * (5 / 8);
    const left = bounds.left + (bounds.width - width) / 2;
    return Math.max(0, Math.min(1, (clientX - left) / width));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!armed || phase !== "pack" || !stage.current) return;
    const bounds = stage.current.getBoundingClientRect();
    // Seul le haut du sachet se déchire : plus bas, le geste ne fait rien.
    if (event.clientY - bounds.top > bounds.height * 0.26) return;
    drag.current = { active: true, startX: event.clientX, moved: 0, lastX: event.clientX };
    stage.current.setPointerCapture(event.pointerId);
    setProgress(Math.min(0.1, packX(event.clientX, bounds)));
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active || !stage.current) return;
    const bounds = stage.current.getBoundingClientRect();
    const moved = Math.abs(event.clientX - drag.current.startX);
    drag.current.moved = Math.max(drag.current.moved, moved);

    const next = Math.max(progress, packX(event.clientX, bounds));
    const speed = Math.min(1, Math.abs(event.clientX - drag.current.lastX) / 28);
    drag.current.lastX = event.clientX;
    if (next > progress && next < 1) sfx.rip(speed);

    if (next >= 0.97) {
      drag.current.active = false;
      setProgress(1);
      finishOpen();
      return;
    }
    setProgress(next);
  }

  function onPointerUp() {
    if (!drag.current.active) return;
    drag.current.active = false;
    sfx.stopRip();
    // Un appui sans glissement vaut un clic : l'ouverture part toute seule.
    if (drag.current.moved < 6) tearAutomatically();
    else settleBack();
  }

  function flipCard() {
    if (phase !== "fan" || flipped !== null || leaving !== null) return;
    const entry = items[revealed];
    if (!entry) return;
    const hold = reduced ? 140 : FLIP_HOLD;
    const leave = reduced ? 60 : LEAVE_MS;

    setFlipped(revealed);
    sfx.card(entry.card.rarity, { holo: entry.holo });
    haptic(entry.card.rarity);

    later(() => setLeaving(revealed), hold);
    later(() => {
      const next = revealed + 1;
      setFlipped(null);
      setLeaving(null);
      setRevealed(next);
      if (next >= total) setPhase("done");
    }, hold + leave);
  }

  function revealAll() {
    if (!armed || phase === "done") return;
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    sfx.stopRip();
    setFlipped(null);
    setLeaving(null);
    setPhase("done");
  }

  /** Fermeture protégée : un clic résiduel du double-clic d'ouverture l'ignore. */
  function close() {
    if (!armed) return;
    onClose();
  }

  // Espace / Entrée / flèche droite : carte suivante, sans quitter le clavier.
  useEffect(() => {
    if (phase !== "fan") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        flipCard();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = items.slice(revealed, revealed + FAN_VISIBLE);
  const rarity = current ? RARITY[current.card.rarity] : null;
  const held = flipped !== null ? items[flipped] : null;

  const stageStyle = {
    "--aura": aura.glow,
    "--aura-soft": aura.soft,
    "--rip-progress": progress,
  } as CSSProperties;

  return (
    <div className="reveal-screen" style={stageStyle} role="dialog" aria-modal="true" aria-label={title}>
      {held && (
        <span key={`flash-${flipped}`} className="reveal-flash" data-rarity={held.card.rarity} aria-hidden />
      )}

      {/* Barre pleine page : sortie à gauche, nom du booster au centre,
          progression à droite — comme une session d'ouverture dédiée. */}
      <header className="reveal-bar">
        <button type="button" onClick={close} className="btn btn-outline btn-sm shrink-0">
          <span aria-hidden>‹</span> {closeLabel}
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-white/90">{title}</p>
          <p className="truncate text-[11px] text-white/40">
            {subtitle ?? "Booster"}
            {phase === "tearing"
              ? " · la soudure cède…"
              : phase === "fan"
                ? " · retourne les cartes"
                : phase === "pack"
                  ? " · booster scellé"
                  : ""}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn(!soundOn)}
            className="btn btn-outline btn-sm px-2"
            aria-pressed={soundOn}
            aria-label={soundOn ? "Couper le son" : "Rétablir le son"}
            title={soundOn ? "Couper le son" : "Rétablir le son"}
          >
            <SoundIcon on={soundOn} />
          </button>
          {phase !== "done" && (
            <button
              type="button"
              onClick={revealAll}
              className="btn btn-outline btn-sm"
              aria-label="Passer l'animation"
            >
              Passer
            </button>
          )}
          <span className="reveal-bar-count">
            {revealed}/{total}
          </span>
        </span>
      </header>

      <div className="reveal-body">
        {phase !== "done" && (
          <div
            ref={stage}
            className="reveal-stage"
            data-phase={phase}
            data-heat={hot ? "true" : undefined}
            data-torn={progress >= 1 ? "true" : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* L'aura naît avec la déchirure et reste derrière les cartes :
                elle se contente de s'effacer quand la première carte sort. */}
            {phase !== "pack" && (
              <div className="aura-stage" data-fading={phase === "fan" ? "true" : undefined} aria-hidden>
                <span className="pack-aura" />
                <span className="aura-ring" />
                <span className="pack-rays" />
                <span className="aura-seed" />
                <span className="aura-motes">
                  {SPARKS.slice(0, 12).map((mote) => (
                    <span
                      key={`mote-${mote.id}`}
                      className="aura-mote"
                      style={
                        {
                          "--mote-x": `${Math.round(mote.x * 0.6)}px`,
                          "--mote-delay": `${mote.delay * 2}ms`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </span>
              </div>
            )}            {/* Un appui sur le sachet l'ouvre aussi ; le bouton du pied reste
                la commande au clavier, et le poster est déjà `aria-hidden`. */}
            <div
              className="pack-stage"
              data-tearing={phase === "tearing" && progress < 1 ? "true" : undefined}
              data-torn={progress >= 1 ? "true" : undefined}
              onClick={tearAutomatically}
            >
                {/* Ombre au sol : le pack flotte, elle reste posée. */}
                <span className="pack-cast" aria-hidden />

                {/* Trois copies du poster : le corps sous la soudure, puis les
                    deux moitiés de la bande, découpées en direct par le geste. */}
                <span
                  className="pack-half pack-body"
                  style={{ clipPath: shapes.body }}
                  aria-hidden
                >
                  <BoosterPack pack={pack} flat showPrice={false} />
                </span>
                <span
                  className="pack-half pack-strip pack-strip-right"
                  style={{ clipPath: shapes.right }}
                  aria-hidden
                >
                  <BoosterPack pack={pack} flat showPrice={false} />
                </span>
                <span
                  className="pack-half pack-strip pack-strip-left"
                  style={{
                    clipPath: shapes.left,
                    transform:
                      progress >= 1
                        ? "translate(35%, -140%) rotate(40deg)"
                        : `rotate(${progress * 18 + 2}deg) translateY(${-progress * 5}px)`,
                    opacity: progress >= 1 ? 0 : 1,
                    transformOrigin: `${shapes.x}% 0%`,
                  }}
                  aria-hidden
                >
                  <BoosterPack pack={pack} flat showPrice={false} />
                </span>

                {/* La ligne de soudure, révélée derrière le doigt. */}
                <svg
                  className="pack-seam"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                  focusable="false"
                  style={{ clipPath: `inset(0 ${100 - shapes.x}% 0 0)` }}
                >
                  <polyline
                    className="pack-seam-line"
                    points={SEAM.map((point) => `${point.x},${point.y}`).join(" ")}
                  />
                </svg>

                <span
                  className="pack-spark"
                  style={{
                    left: `${shapes.x}%`,
                    top: `${shapes.y}%`,
                    opacity: progress > 0 && progress < 1 ? 1 : 0,
                  }}
                  aria-hidden
                />
              <span className="pack-fringe" aria-hidden />
              <span className="pack-flash" aria-hidden />
            </div>

            {phase === "fan" && (
              <>
                <div className="rip-fan" data-hot={hot ? "true" : undefined}>
                  {visible.map((entry, slot) => {
                    const globalIndex = revealed + slot;
                    const isTop = slot === 0;
                    const isFlipped = flipped === globalIndex;
                    const isLeaving = leaving === globalIndex;
                    const marks = isFlipped && (entry.isNew || entry.holo || entry.variant !== "normal");

                    const inner = (
                      <>
                        <span className="rip-card-inner">
                          <span
                            className="rip-face rip-face-back"
                            style={{ "--glow": AURA[entry.card.rarity].glow } as CSSProperties}
                          >
                            <CardBack pack={pack} />
                          </span>
                          <span className="rip-face rip-face-front">
                            <CardFace
                              card={entry.card}
                              size="xl"
                              className="h-full w-full"
                              variant={entry.variant}
                              holo={entry.holo}
                            />
                          </span>
                        </span>

                        {marks && (
                          <span className="pointer-events-none absolute inset-x-0 -top-2 z-20 flex justify-center gap-1">
                            {entry.isNew && (
                              <span className="chip bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950">
                                Nouveau
                              </span>
                            )}
                            {entry.holo && (
                              <span className="chip bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
                                Holo
                              </span>
                            )}
                            {entry.variant !== "normal" && (
                              <span className="chip bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/80">
                                {VARIANT_LABELS[entry.variant]}
                              </span>
                            )}
                          </span>
                        )}
                      </>
                    );

                    const common = {
                      className: "rip-card",
                      "data-slot": slot,
                      "data-flipped": isFlipped ? "true" : undefined,
                      "data-leaving": isLeaving ? "true" : undefined,
                      style: {
                        "--slot": slot,
                        "--glow": AURA[entry.card.rarity].glow,
                        zIndex: 30 - slot,
                      } as CSSProperties,
                    } as const;

                    return isTop ? (
                      <button
                        key={`${entry.card.id}-${globalIndex}`}
                        type="button"
                        {...common}
                        onClick={flipCard}
                        aria-label={
                          isFlipped
                            ? `${entry.card.name}, ${RARITY[entry.card.rarity].label}`
                            : `Retourner ${entry.card.name}`
                        }
                        aria-disabled={isFlipped || isLeaving}
                      >
                        {inner}
                      </button>
                    ) : (
                      <div
                        key={`${entry.card.id}-${globalIndex}`}
                        {...common}
                        aria-hidden
                      >
                        {inner}
                      </div>
                    );
                  })}
                </div>

                {held && hot && <RevealSparks key={`sparks-${flipped}`} rarity={held.card.rarity} />}
              </>
            )}
          </div>
        )}

        {/* Pied de scène : hauteur réservée pour que le cadre ne bouge pas
            quand les contrôles changent d'une étape à l'autre. */}
        {phase !== "done" && (
          <div className="reveal-foot">
            {(phase === "pack" || phase === "tearing") && (
              <>
                <button
                  type="button"
                  onClick={tearAutomatically}
                  disabled={phase === "tearing"}
                  className="btn btn-primary disabled:cursor-wait"
                >
                  {phase === "tearing" ? "Déchirure…" : "Déchirer le booster"}
                </button>
                <p className="text-xs text-white/40">
                  Glisse le long de la soudure, ou touche le bouton
                  <span className="text-white/25"> · </span>
                  {total} carte{total > 1 ? "s" : ""} à l&apos;intérieur
                </p>
              </>
            )}

            {phase === "fan" && current && rarity && (
              <>
                <div className="min-h-14 text-center" aria-live="polite">
                  <p className="flex items-center justify-center gap-2 text-sm">
                    <span className={`chip px-2 py-0.5 text-[10px] font-bold ${rarity.badge}`}>
                      {rarity.short}
                    </span>
                    <span className={`font-semibold ${rarity.text}`}>{rarity.label}</span>
                  </p>
                  <p className="display mt-1 text-2xl text-white">{current.card.name}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {getUniverseLabel(current.card.universe)}
                    <span className="text-white/25"> · </span>
                    {current.isNew ? "Nouvelle carte" : `Doublon ×${current.quantity}`}
                    <span className="text-white/25"> · </span>
                    {revealed + 1} / {total}
                  </p>
                </div>

                {total <= 10 ? (
                  <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
                    {items.map((entry, position) => {
                      const shown = position < revealed || position === flipped;
                      return (
                        <span
                          key={`thumb-${entry.card.id}-${position}`}
                          className={`deck-thumb ${shown ? "" : "deck-thumb-back"} ${
                            position === revealed ? "deck-thumb-live" : ""
                          }`}
                        >
                          {shown ? <CardThumb card={entry.card} /> : <CardBack pack={pack} />}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1" aria-hidden>
                    {items.slice(0, 24).map((entry, position) => (
                      <span
                        key={`dot-${entry.card.id}-${position}`}
                        className={`h-1.5 rounded-full transition-all ${
                          position < revealed ? "w-4 bg-cyan" : "w-1.5 bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={flipCard}
                    disabled={flipped !== null || leaving !== null}
                    className="btn btn-primary"
                  >
                    {flipped !== null ? "Retournée" : "Retourner la carte"}
                  </button>
                  {total - revealed > 1 && (
                    <button type="button" onClick={revealAll} className="btn btn-outline">
                      Tout révéler
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-white/35">
                  Touche la carte <span className="text-white/20">·</span> Espace / Entrée{" "}
                  <span className="text-white/20">·</span> retourner
                </p>
              </>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="mt-1 w-full">
            {/* Petit tirage : éventail. Lot de plusieurs boosters : grille
                scrollable, plus lisible et plus rapide à parcourir. */}
            {items.length > FAN_MAX ? (
              <RevealGrid items={items} />
            ) : (
              <ul className="fan-scene">
                {items.map((entry, position) => {
                  const middle = (items.length - 1) / 2;
                  const offset = position - middle;
                  const step = items.length > 7 ? 5 : 8;
                  return (
                    <li
                      key={`${entry.card.id}-${position}`}
                      className="fan-slot"
                      style={
                        {
                          "--fan-rotate": `${offset * step}deg`,
                          "--fan-drop": `${Math.abs(offset) ** 1.6 * 2.5}px`,
                          "--fan-z": position + 1,
                        } as CSSProperties
                      }
                    >
                      <Link
                        href={`/card/${entry.card.id}`}
                        className="card-deal relative block"
                        style={{ animationDelay: `${Math.min(position, 12) * 45}ms` }}
                      >
                        <CardFace
                          card={entry.card}
                          size="sm"
                          className="aspect-[3/4]"
                          variant={entry.variant}
                          holo={entry.holo}
                        />
                        <span className="pointer-events-none absolute inset-x-0 -top-1.5 z-10 flex justify-center gap-1">
                          {entry.isNew ? (
                            <span className="chip bg-emerald-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950">
                              Nouveau
                            </span>
                          ) : (
                            <span className="chip bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/75">
                              Doublon ×{entry.quantity}
                            </span>
                          )}
                          {entry.holo && (
                            <span className="chip bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
                              Holo
                            </span>
                          )}
                          {entry.variant !== "normal" && (
                            <span className="chip bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/80">
                              {VARIANT_LABELS[entry.variant]}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {items.length <= FAN_MAX && (
              <p className="text-center text-[11px] text-white/35">
                <span className="hidden sm:inline">
                  Survole une carte pour la voir en grand, clique pour ouvrir sa fiche
                </span>
                <span className="sm:hidden">Touche une carte pour ouvrir sa fiche</span>
              </p>
            )}

            <p className="mt-4 text-center text-sm text-white/60">
              {newCount > 0 ? (
                <span className="font-semibold text-emerald-300">
                  {newCount} nouvelle{newCount > 1 ? "s" : ""} carte{newCount > 1 ? "s" : ""}
                </span>
              ) : (
                "Aucune nouvelle carte cette fois"
              )}
              {holoCount > 0 && (
                <>
                  <span className="text-white/25"> · </span>
                  <span className="font-semibold text-amber-200">
                    {holoCount} holo{holoCount > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>

            <div className="mt-6 flex justify-center">
              <button type="button" onClick={onClose} className="btn btn-primary">
                Terminé
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Récapitulatif d'un lot : toutes les cartes d'un coup, dans une grille qui
 * défile. Les pastilles (« Nouveau », « ×N », « Holo ») restent visibles, ce
 * que l'éventail ne permet pas sans survol.
 */
function RevealGrid({ items }: { items: RevealItem[] }) {
  return (
    <ul className="mx-auto grid max-h-[54vh] w-full max-w-3xl grid-cols-3 gap-2.5 overflow-y-auto px-1 pb-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
      {items.map((entry, position) => (
        <li
          key={`${entry.card.id}-${position}`}
          className="card-deal"
          style={{ animationDelay: `${Math.min(position, 12) * 28}ms` }}
        >
          <Link href={`/card/${entry.card.id}`} className="relative block">
            <CardFace
              card={entry.card}
              size="sm"
              className="aspect-[3/4]"
              variant={entry.variant}
              holo={entry.holo}
            />
            <span className="pointer-events-none absolute inset-x-0 -top-1.5 z-10 flex justify-center gap-1">
              {entry.isNew ? (
                <span className="chip bg-emerald-400 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-950">
                  Nouveau
                </span>
              ) : (
                <span className="chip bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/75">
                  ×{entry.quantity}
                </span>
              )}
              {entry.holo && (
                <span className="chip bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
                  Holo
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Étincelles et onde de choc d'une carte rare et plus : une gerbe de points
 * projetés autour de la carte, teintés par la rareté. Purement décoratif —
 * `aria-hidden`, et coupé avec `prefers-reduced-motion`.
 */
function RevealSparks({ rarity }: { rarity: Rarity }) {
  return (
    <span className="reveal-sparks" data-rarity={rarity} aria-hidden>
      <span className="reveal-ring" />
      {SPARKS.map((spark) => (
        <span
          key={spark.id}
          className="reveal-spark"
          style={
            {
              "--spark-x": `${spark.x}px`,
              "--spark-y": `${spark.y}px`,
              "--spark-delay": `${spark.delay}ms`,
              "--spark-size": `${spark.size}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * Icône du réglage son : haut-parleur avec deux ondes quand il est actif,
 * barré quand il est coupé. Purement décorative, le bouton porte le libellé.
 */
function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden focusable="false">
      <path
        d="M2 6.2h2.3L7.6 3.4v9.2L4.3 9.8H2z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {on ? (
        <>
          <path d="M10 5.6a3.2 3.2 0 0 1 0 4.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M12 3.8a5.6 5.6 0 0 1 0 8.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
        </>
      ) : (
        <path d="M10.4 6.2l3.4 3.6M13.8 6.2l-3.4 3.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Vignette de progression : à 34 px, seul un fragment d'artwork est lisible. */
function CardThumb({ card }: { card: Card }) {
  const art = getCardArt(card.id);

  if (!art) {
    return (
      <span className="grid h-full w-full place-items-center text-base" aria-hidden>
        {card.emoji}
      </span>
    );
  }

  return (
    <Image
      src={art.src}
      alt=""
      fill
      sizes="40px"
      unoptimized={!art.local}
      style={framingStyle(art.framing)}
    />
  );
}
