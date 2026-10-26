"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { BoosterPack } from "@/components/booster-pack";
import { CardFace } from "@/components/card-face";
import { getUniverseLabel, type Card, type Rarity } from "@/lib/cards";
import { RARITY, rarestRarity } from "@/lib/game";
import { getCardArt } from "@/lib/card-art";
import { PACKS, type Pack } from "@/lib/packs";
import { haptic, setSoundOn, sfx, useSoundOn } from "@/lib/sfx";
import { VARIANT_LABELS, type CardVariant } from "@/lib/variants";

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

/** Durée de la déchirure, puis de l'aura avant la première carte. */
const TEAR_MS = 760;
const AURA_MS = 820;

/**
 * Délai avant que l'écran n'accepte les clics. Le second clic d'un double-clic
 * sur « Ouvrir » retombait sinon sur la déchirure ou sur « Passer » : le pack
 * s'ouvrait puis disparaissait aussitôt.
 */
const ARM_MS = 340;

/**
 * `pack` (booster scellé) → `tearing` (découpe) → `aura` (rareté la plus haute)
 * → `cards` (les cartes s'empilent une à une) → `done` (récapitulatif).
 */
type Phase = "pack" | "tearing" | "aura" | "cards" | "done";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Raretés qui déclenchent scintillements et onde : au-dessus de Rare. */
const HOT_RARITIES: Rarity[] = ["SR", "UR", "L"];

/** Au-delà, le récapitulatif quitte l'éventail pour une grille scrollable. */
const FAN_MAX = 12;

/** Étincelles projetées autour de la carte : direction, portée et retard fixes. */
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

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * Ouverture d'un booster : on voit d'abord le pack scellé, on le déchire, une
 * aura trahit la meilleure rareté du tirage, puis les cartes se posent l'une
 * sur l'autre. Le tirage est déjà fait côté serveur — cette séquence ne fait
 * que révéler.
 *
 * Le cadre (`.reveal-stage`) garde la taille d'une carte du début à la fin :
 * le pack, l'aura et les cartes s'y superposent, donc rien ne saute entre les
 * étapes. L'aura démarre pendant la déchirure et reste en fondu derrière les
 * cartes, au lieu d'apparaître et de disparaître sur une coupe franche.
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
  /** Pack à déchirer : le poster est dupliqué dans les deux moitiés. */
  pack?: Pack;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [phase, setPhase] = useState<Phase>("pack");
  const [index, setIndex] = useState(0);
  const [armed, setArmed] = useState(false);
  const reduced = usePrefersReducedMotion();
  const soundOn = useSoundOn();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Les effets sonores lisent le tirage courant sans le mettre en dépendance :
  // un parent qui recrée `items` ne doit pas rejouer le son de la même carte.
  const itemsRef = useRef(items);
  // Les visuels sont hotlinkés : sans préchargement, chaque carte révélée
  // attend son aller-retour réseau et s'affiche vide d'abord. On profite donc
  // du pack scellé et de la déchirure pour télécharger tout le tirage.
  const preloaded = useRef<HTMLImageElement[]>([]);

  const total = items.length;
  const item = items[index];
  const best = rarestRarity(items.map((entry) => entry.card.rarity));
  const aura = AURA[best];
  const hot = item ? HOT_RARITIES.includes(item.card.rarity) : false;

  const newCount = new Set(items.filter((entry) => entry.isNew).map((entry) => entry.card.id)).size;
  const holoCount = items.filter((entry) => entry.holo).length;

  useEffect(() => {
    const timer = setTimeout(() => setArmed(true), ARM_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );

  // Garde le tirage courant sous la main pour les effets, sans le mettre en
  // dépendance de l'effet sonore (un parent qui recrée le tableau rejouerait
  // le son de la même carte).
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Chaque carte posée a son propre son, et une vibration courte calée sur la
  // rareté : c'est ce qui donne du poids au geste, sans image en plus.
  useEffect(() => {
    if (phase !== "cards") return;
    const entry = itemsRef.current[index];
    if (!entry) return;
    sfx.card(entry.card.rarity, { holo: entry.holo });
    haptic(entry.card.rarity);
  }, [phase, index]);

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

  /** Déchire le pack : l'aura prend le relais, puis la première carte. */
  function tear() {
    if (!armed || phase !== "pack") return;
    setPhase("tearing");

    // Le clic sur « Déchirer » est le geste qui autorise l'audio : le son part
    // tout de suite, l'aura monte pendant que la déchirure se termine.
    sfx.tear();
    later(() => sfx.aura(best), 140);

    // Toutes les cartes défilent, y compris les lots de 5 ou 10 boosters :
    // sauter au récapitulatif privait le joueur du dévoilement. « Passer »
    // reste disponible pour qui veut aller droit au but.
    later(() => setPhase("aura"), reduced ? 80 : TEAR_MS);
    later(() => setPhase("cards"), reduced ? 180 : TEAR_MS + AURA_MS);
  }

  function advance() {
    if (phase !== "cards") return;
    if (index + 1 >= total) {
      setPhase("done");
      return;
    }
    setIndex(index + 1);
  }

  function revealAll() {
    if (!armed || phase === "done") return;
    for (const timer of timers.current) clearTimeout(timer);
    setPhase("done");
  }

  /** Fermeture protégée : un clic résiduel du double-clic d'ouverture l'ignore. */
  function close() {
    if (!armed) return;
    onClose();
  }

  // Espace / Entrée / flèche droite : carte suivante, sans quitter le clavier.
  useEffect(() => {
    if (phase !== "cards") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const revealed = phase === "done" ? total : phase === "cards" ? index + 1 : 0;
  const remaining = total - revealed;
  const rarity = item ? RARITY[item.card.rarity] : null;

  const stageStyle = {
    "--aura": aura.glow,
    "--aura-soft": aura.soft,
  } as CSSProperties;

  return (
    <div className="reveal-screen" style={stageStyle} role="dialog" aria-modal="true" aria-label={title}>
      {phase === "cards" && item && (
        <span key={`flash-${index}`} className="reveal-flash" data-rarity={item.card.rarity} aria-hidden />
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
              ? " · déchirure…"
              : phase === "aura"
                ? " · une aura s'échappe…"
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
          <div className="reveal-stage" data-phase={phase} data-heat={hot ? "true" : undefined}>
            {/* L'aura naît pendant la déchirure et reste derrière les cartes :
                elle se contente de s'effacer quand la première carte se pose. */}
            {phase !== "pack" && (
              <div className="aura-stage" data-fading={phase === "cards" ? "true" : undefined} aria-hidden>
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
            )}

            {(phase === "pack" || phase === "tearing") && (
              <button
                type="button"
                onClick={tear}
                disabled={phase === "tearing"}
                aria-label={phase === "pack" ? "Déchirer le booster" : "Déchirure en cours"}
                className="pack-stage group"
                data-tearing={phase === "tearing"}
              >
                {/* Ombre au sol : le pack flotte, elle reste posée. */}
                <span className="pack-cast" aria-hidden />
                <span className="pack-half pack-strip">
                  <BoosterPack pack={pack} flat showPrice={false} />
                </span>
                <span className="pack-half pack-body">
                  <BoosterPack pack={pack} flat showPrice={false} />
                </span>
                <span className="pack-cut" aria-hidden />
              </button>
            )}

            {phase === "cards" && item && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={advance}
                  aria-label={
                    index + 1 >= total
                      ? "Voir le récapitulatif"
                      : `Carte suivante (${index + 2} sur ${total})`
                  }
                  className="stack-scene"
                >
                  {items.map((entry, position) => {
                    const depth = index - position;
                    if (depth < 0 || depth > 2) return null;
                    return (
                      <div
                        key={`${entry.card.id}-${position}`}
                        className={`stack-card ${depth === 0 ? "deal-in" : ""}`}
                        style={{
                          transform:
                            depth === 0
                              ? undefined
                              : `translateY(${depth * 12}px) rotate(${position % 2 ? 1.4 : -1.4}deg)`,
                          opacity: depth === 0 ? 1 : 0.9,
                          zIndex: 10 - depth,
                        }}
                        aria-hidden={depth !== 0}
                      >
                        <CardFace
                          card={entry.card}
                          size="xl"
                          className="h-full w-full"
                          variant={entry.variant}
                        />
                        {/* Reflet qui balaie la carte au moment où elle se pose :
                            une seule passe, plus appuyée sur les hautes raretés. */}
                        {depth === 0 && (
                          <span
                            key={`sheen-${index}`}
                            className="reveal-sheen"
                            data-rarity={entry.card.rarity}
                            aria-hidden
                          >
                            <span className="reveal-sheen-bar" />
                          </span>
                        )}

                        {/* Badges centrés au-dessus de la carte : posés à gauche, ils
                            recouvraient le nom du personnage. */}
                        {depth === 0 && (entry.isNew || entry.holo || entry.variant !== "normal") && (
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
                      </div>
                    );
                  })}
                </div>

                {/* Épique et au-dessus : onde de choc et étincelles autour de la
                    carte. `key` sur l'index pour rejouer l'animation à chaque
                    nouvelle carte. */}
                {hot && <RevealSparks key={`sparks-${index}`} rarity={item.card.rarity} />}
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
                  onClick={tear}
                  disabled={phase === "tearing"}
                  className="btn btn-primary disabled:cursor-wait"
                >
                  {phase === "tearing" ? "Déchirure…" : "Déchirer le booster"}
                </button>
                <p className="text-xs text-white/40">
                  {total} carte{total > 1 ? "s" : ""} à l&apos;intérieur
                </p>
              </>
            )}

            {phase === "aura" && (
              <p className="text-xs uppercase tracking-[0.22em] text-white/45" aria-live="polite">
                Le booster s&apos;ouvre…
              </p>
            )}

            {phase === "cards" && item && rarity && (
              <>
                <div className="min-h-14 text-center" aria-live="polite">
                  <div key={`label-${index}`} className="reveal-pop">
                    <p className="flex items-center justify-center gap-2 text-sm">
                      <span className={`chip px-2 py-0.5 text-[10px] font-bold ${rarity.badge}`}>
                        {rarity.short}
                      </span>
                      <span className={`font-semibold ${rarity.text}`}>{rarity.label}</span>
                    </p>
                    <p className="display mt-1 text-2xl text-white">{item.card.name}</p>
                    <p className="mt-0.5 text-xs text-white/45">
                      {getUniverseLabel(item.card.universe)}
                      <span className="text-white/25"> · </span>
                      {item.isNew ? "Nouvelle carte" : `Doublon ×${item.quantity}`}
                    </p>
                  </div>
                </div>

                {total <= 10 ? (
                  <div className="flex flex-wrap justify-center gap-1.5" aria-hidden>
                    {items.map((entry, position) => (
                      <span
                        key={`thumb-${entry.card.id}-${position}`}
                        className={`deck-thumb ${position <= index ? "" : "deck-thumb-back"}`}
                      >
                        {position <= index ? (
                          <CardThumb card={entry.card} />
                        ) : (
                          <Image
                            src="/booster/dos-carte.jpg"
                            alt=""
                            fill
                            sizes="40px"
                            unoptimized
                            className="object-contain"
                          />
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1" aria-hidden>
                    {items.slice(0, 24).map((entry, position) => (
                      <span
                        key={`dot-${entry.card.id}-${position}`}
                        className={`h-1.5 rounded-full transition-all ${
                          position <= index ? "w-4 bg-acid" : "w-1.5 bg-white/15"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={advance} className="btn btn-primary">
                    {index + 1 >= total ? "Voir le récap" : "Carte suivante"}
                  </button>
                  {remaining > 1 && (
                    <button type="button" onClick={revealAll} className="btn btn-outline">
                      Tout révéler
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-white/35">
                  Espace / Entrée <span className="text-white/20">·</span> carte suivante
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
      style={art.framing}
    />
  );
}
