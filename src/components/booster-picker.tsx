"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openPacks } from "@/app/actions";
import { BoosterPack } from "@/components/booster-pack";
import { BoosterReveal, type RevealItem } from "@/components/booster-reveal";
import { PackCharacters } from "@/components/pack-characters";
import { getCard } from "@/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  CARDS_PER_BOOSTER,
  RARITY,
  formatCountdown,
  projectedStock,
} from "@/lib/game";
import { isMotionForced } from "@/lib/motion";
import { GUARANTEE_ENABLED, PACKS, type Pack } from "@/lib/packs";
import { setPendingReveal, usePendingReveal } from "@/lib/reveal-queue";

export type PackView = Pack & {
  stats: {
    poolSize: number;
    minPoolSize: number;
    available: boolean;
    cardsCount: number;
    chances: Record<string, number>;
  };
};

/** Raretés affichées dans les pastilles de chance (le Commun n'a pas d'intérêt). */
const CHANCE_RARITIES = ["UC", "R", "SR", "UR", "L"] as const;

/** Lots proposés à côté du bouton d'ouverture. */
const BATCHES = [1, 5, 10] as const;

/**
 * Pourcentage lisible : deux décimales sous 1 %, une au-dessus, sans « ,0 »
 * inutile. Exemples : 94,1 % · 2 % · 0,33 %.
 */
function formatChance(value: number): string {
  const percent = value * 100;
  if (percent > 0 && percent < 0.05) return "< 0,05 %";
  const text = percent < 1 ? percent.toFixed(2) : percent.toFixed(1);
  return `${text.replace(/\.0+$/, "").replace(".", ",")} %`;
}

/** Halo de la scène : la couleur d'emblème du pack, posée en alpha. */
function haloFor(pack: Pack): string {
  return `${pack.colors.gl}59`;
}

/** Flèche dessinée, pour circuler entre les packs. */
function Chevron({ to }: { to: "left" | "right" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={to === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * Page Boosters, en vitrine : le pack choisi en grand au centre, une flèche de
 * chaque côté, ses chances en pastilles, le lot et l'ouverture, puis l'étagère
 * des douze packs pour circuler.
 *
 * Tous les packs sont gratuits et disponibles en permanence ; seul le stock
 * commun (1 toutes les 10 min, plafond 10) limite le joueur, et un pack dont le
 * pool n'atteint pas son seuil reste « Bientôt ». L'ouverture appelle
 * `openPack(packId)` : le tirage et l'écriture en collection sont faits en base
 * avant l'animation.
 */
export function BoosterPicker({
  packs,
  initialStock,
  initialBonus = 0,
  initialAnchor,
  serverNow,
  uniqueOwned,
  totalCards,
  initialPackId,
  openCharacters,
}: {
  packs: PackView[];
  initialStock: number;
  /** Boosters bonus du parrainage : hors plafond, consommés après le stock. */
  initialBonus?: number;
  initialAnchor: string | null;
  serverNow: number;
  uniqueOwned: number;
  totalCards: number;
  /** Pack demandé dans l'URL (`?pack=`), sinon le Mix. */
  initialPackId?: string | null;
  /** `?persos=1` : rouvre la liste des persos, au retour d'une fiche carte. */
  openCharacters?: boolean;
}) {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState(() =>
    initialPackId && packs.some((pack) => pack.id === initialPackId)
      ? initialPackId
      : (packs.find((pack) => pack.id === "mix")?.id ?? packs[0]?.id ?? ""),
  );
  const [stock, setStock] = useState(initialStock);
  const [bonus, setBonus] = useState(initialBonus);
  const [anchor, setAnchor] = useState(initialAnchor);
  const [now, setNow] = useState(serverNow);
  const [charactersOpen, setCharactersOpen] = useState(
    Boolean(openCharacters && initialPackId && packs.some((pack) => pack.id === initialPackId)),
  );
  const [opening, setOpening] = useState(false);
  const [batch, setBatch] = useState<(typeof BATCHES)[number]>(1);
  const [error, setError] = useState<string | null>(null);
  // Révélation hors composant : elle survit à un remontage pendant l'ouverture.
  const reveal = usePendingReveal();
  // Verrou synchrone : deux clics rapides ne doivent pas tirer deux boosters
  // (l'état `opening` n'est pas encore à jour au deuxième clic).
  const busy = useRef(false);
  // Scène remontée à la main quand un pack est choisi dans l'étagère (mobile).
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selected = packs.find((pack) => pack.id === selectedId) ?? packs[0] ?? null;
  const { stock: stockAvailable, nextAt } = projectedStock(stock, anchor, now);
  const available = stockAvailable + bonus;
  const nextIn = nextAt === null ? null : Math.max(0, nextAt - now);
  // Le lot est plafonné par le total disponible (stock + bonus).
  const keep = Math.min(batch, available);
  const canOpen = Boolean(selected?.stats.available) && available >= 1 && !opening;

  /** Pack suivant ou précédent, en boucle sur les douze. */
  const move = useCallback(
    (delta: number) => {
      setSelectedId((current) => {
        const index = packs.findIndex((pack) => pack.id === current);
        const next = packs[(index + delta + packs.length) % packs.length];
        return next ? next.id : current;
      });
      setError(null);
    },
    [packs],
  );

  // Flèches du clavier, comme dans la vitrine : jamais depuis un champ de
  // saisie, ni pendant la révélation. Sans `preventDefault`, la page défilerait
  // au lieu de changer de pack.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (charactersOpen || opening) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [charactersOpen, move, opening]);

  /** Choix d'un pack dans l'étagère : la scène se remonte pour le montrer. */
  function select(pack: PackView) {
    setSelectedId(pack.id);
    setError(null);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      stage.current?.scrollIntoView({
        block: "center",
        behavior: isMotionForced() ? "smooth" : "auto",
      });
    }
  }

  async function open() {
    if (!selected || busy.current) return;
    if (!selected.stats.available) {
      setError(
        `${selected.name} n'a pas encore assez de personnages (${selected.stats.poolSize}/${selected.stats.minPoolSize}).`,
      );
      return;
    }
    if (available < 1) {
      setError("Aucun booster en stock : le prochain arrive dans quelques minutes.");
      return;
    }

    busy.current = true;
    setOpening(true);
    setError(null);

    // Aucune attente artificielle : la révélation s'ouvre dès que le serveur a
    // écrit le tirage. Il n'y a pas non plus de `router.refresh()` ici — il
    // rejouait tout l'arbre serveur (layout, profil, stats) pendant la
    // déchirure, et pouvait faire disparaître l'overlay. L'accueil est
    // rafraîchi à la fermeture, quand plus rien n'est animé.
    const result = await openPacks(selected.id, keep);

    if (result.status === "ok") {
      const items: RevealItem[] = result.cards.flatMap((entry) => {
        const card = getCard(entry.id);
        return card
          ? [
              {
                card,
                holo: entry.holo,
                isNew: entry.isNew,
                quantity: entry.quantity,
                variant: entry.variant,
              },
            ]
          : [];
      });
      setPendingReveal({ items, packId: selected.id, opened: result.opened });
      setStock(result.stock);
      setBonus(result.bonus);
      setAnchor(result.anchor);
      setNow(result.serverNow);
    } else if (result.status === "empty") {
      setStock(result.stock);
      setBonus(result.bonus);
      setAnchor(result.anchor);
      setError(result.message);
    } else {
      setError(result.message);
    }

    busy.current = false;
    setOpening(false);
  }

  return (
    <div>
      {/* ————— En-tête : le titre au centre, les deux chiffres du joueur ————— */}
      <header className="text-center">
        <span className="eyebrow">Boosters</span>
        <h1 className="display mt-3 text-4xl sm:text-5xl">Choisis ton booster</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/50">
          {CARDS_PER_BOOSTER} cartes par pack, un booster toutes les{" "}
          {Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes, jusqu&apos;à {BOOSTER_STOCK_MAX} en
          stock. Tous les packs sont disponibles.
        </p>

        {/* Deux chiffres seulement : le stock et l'album. Un compteur de packs
            ouvrables se lisait comme un second stock, à côté du vrai. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 font-mono text-xs">
          <span className="chip px-3.5 py-1.5">
            <span className="uppercase tracking-[0.14em] text-white/40">Stock</span>
            <span className={available > 0 ? "text-cyan" : "text-white/40"}>
              {stockAvailable} / {BOOSTER_STOCK_MAX}
            </span>
            {bonus > 0 && (
              <span
                className="text-cyan"
                title="Boosters bonus du parrainage : hors plafond, sans expiration"
              >
                +{bonus} bonus
              </span>
            )}
          </span>
          <span className="chip px-3.5 py-1.5">
            <span className="uppercase tracking-[0.14em] text-white/40">Album</span>
            <span>
              {uniqueOwned} / {totalCards}
            </span>
          </span>
          <span className="chip px-3.5 py-1.5 text-white/45">
            {stockAvailable >= BOOSTER_STOCK_MAX
              ? "Plein"
              : nextIn !== null
                ? `+1 dans ${formatCountdown(nextIn)}`
                : `+1 toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} min`}
          </span>
          {GUARANTEE_ENABLED && <span className="chip px-3.5 py-1.5 text-cyan">Garantie R+</span>}
        </div>
      </header>

      {/* ————— La scène : le pack choisi en grand, une flèche de chaque côté ————— */}
      {/* `mt-14` et non `mt-10` : le cadre assombri d'Halloween remonte de 36 px
          au-dessus de la grille pour laisser flotter le poster, et ces 16 px de
          plus gardent la même distance au bandeau d'en haut. */}
      <div ref={stage} className="relative mt-14">
        {/* Halo du pack choisi : un calque par pack, un seul allumé — la
            sélection se fond au lieu de sauter. */}
        <div className="v-scene" aria-hidden>
          {packs.map((pack) => (
            <span
              key={pack.id}
              className="v-halo"
              data-on={pack.id === selectedId ? "true" : undefined}
              style={{
                backgroundImage: `radial-gradient(34% 44% at 50% 44%, ${haloFor(pack)} 0%, transparent 72%)`,
              }}
            />
          ))}
        </div>

        {/* `data-hw-torch` : zone que l'overlay Halloween assombrit. */}
        <div data-hw-torch className="relative z-10 flex items-center justify-center gap-3 sm:gap-8">
          <button
            type="button"
            onClick={() => move(-1)}
            className="v-arrow"
            aria-label="Booster précédent"
          >
            <Chevron to="left" />
          </button>

          <div className="pack-float w-[210px] sm:w-[260px]">
            {selected && (
              <BoosterPack
                pack={selected}
                locked={!selected.stats.available}
                selected
                showPrice={false}
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            className="v-arrow"
            aria-label="Booster suivant"
          >
            <Chevron to="right" />
          </button>
        </div>

        <p className="sr-only" aria-live="polite">
          {selected ? `Pack sélectionné : ${selected.name}` : ""}
        </p>

        {selected && (
          <PackPanel
            pack={selected}
            available={available}
            keep={keep}
            batch={batch}
            onBatch={setBatch}
            canOpen={canOpen}
            opening={opening}
            onOpen={() => void open()}
            onShowCharacters={() => setCharactersOpen(true)}
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto mt-5 max-w-md border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-center text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      {/* ————— L'étagère : les dix packs sur une bande qui défile ————— */}
      <section className="mt-12">
        <div className="flex items-center gap-3.5 font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">
          <span>Tous les boosters</span>
          <span className="h-px flex-1 bg-white/10" aria-hidden />
        </div>

        <ul className="v-shelf" aria-label="Les dix boosters">
          {packs.map((pack) => {
            const isSelected = pack.id === selected?.id;
            const ready = pack.stats.available;

            return (
              <li key={pack.id} className="flex-none">
                <button
                  type="button"
                  onClick={() => select(pack)}
                  aria-pressed={isSelected}
                  aria-label={
                    ready
                      ? `Booster ${pack.name}, ${CARDS_PER_BOOSTER} cartes, gratuit`
                      : `Booster ${pack.name}, bientôt disponible : ${pack.stats.poolSize} sur ${pack.stats.minPoolSize} persos`
                  }
                  className="v-shelf-tile"
                >
                  <BoosterPack
                    pack={pack}
                    locked={!ready}
                    selected={isSelected}
                    showPrice={false}
                    flat
                  />
                  <span
                    className={`mt-2.5 block text-center font-mono text-[10px] uppercase tracking-[0.12em] ${
                      !ready ? "text-white/35" : isSelected ? "text-cyan/80" : "text-white/45"
                    }`}
                  >
                    {!ready ? "Bientôt" : isSelected ? "Choisi" : "Gratuit"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {charactersOpen && selected && (
        <PackCharacters
          packId={selected.id}
          packName={selected.name}
          onClose={() => setCharactersOpen(false)}
        />
      )}

      {reveal && (
        <BoosterReveal
          title={`Booster ${packs.find((pack) => pack.id === reveal.packId)?.name ?? ""}`}
          subtitle={`${reveal.opened} booster${reveal.opened > 1 ? "s" : ""} · ${reveal.items.length} carte${reveal.items.length > 1 ? "s" : ""}`}
          items={reveal.items}
          pack={packs.find((pack) => pack.id === reveal.packId) ?? packs[0]}
          onClose={() => {
            setPendingReveal(null);
            // Les stocks et l'album viennent du serveur : on les relit une fois
            // l'animation refermée, pas pendant.
            router.refresh();
          }}
          closeLabel="Fermer"
        />
      )}
    </div>
  );
}

/**
 * Fiche du pack choisi, sous la scène : son numéro, ses chances de rareté, le
 * lot d'ouverture et le bouton. Tout est centré, comme la vitrine.
 */
function PackPanel({
  pack,
  available,
  keep,
  batch,
  onBatch,
  canOpen,
  opening,
  onOpen,
  onShowCharacters,
}: {
  pack: PackView;
  available: number;
  /** Boosters réellement ouverts par le lot sélectionné (plafonné au stock). */
  keep: number;
  batch: (typeof BATCHES)[number];
  onBatch: (value: (typeof BATCHES)[number]) => void;
  canOpen: boolean;
  opening: boolean;
  onOpen: () => void;
  onShowCharacters: () => void;
}) {
  const ready = pack.stats.available;
  const number = String(PACKS.findIndex((entry) => entry.id === pack.id) + 1).padStart(2, "0");

  return (
    <div className="relative z-10 mt-9 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/45">
        N°{number} · {ready ? "Disponible" : "Bientôt"} · Gratuit
      </p>

      <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
        {CHANCE_RARITIES.map((key) => {
          const info = RARITY[key];
          const chance = pack.stats.chances[key];
          const percent = typeof chance === "number" ? chance * 100 : null;
          const label =
            percent === null ? "aucune chance" : `${formatChance(percent / 100)} par booster`;

          return (
            <li key={key}>
              <span
                className="chip gap-2 px-3.5 py-1.5 text-xs"
                title={`${info.label} : ${label}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${info.bar}`} aria-hidden />
                <span className="text-white/70">{info.label}</span>
                <span className="text-[11px] text-white/45">
                  {percent === null ? "—" : formatChance(percent / 100)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-white/35">
        Chance d&apos;obtenir au moins une carte de la rareté dans le booster, calculée sur le
        tirage réel du pack.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {/* Lot d'ouverture : pilules ×1, ×5, ×10. Au-delà du stock, le lot est
            ramené au nombre de boosters présents. */}
        <div
          role="group"
          aria-label="Nombre de boosters à ouvrir"
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
        >
          {BATCHES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onBatch(value)}
              disabled={!ready || opening}
              aria-pressed={batch === value}
              aria-label={
                value === 1
                  ? "Ouvrir 1 booster"
                  : `Ouvrir ${value} boosters${available < value ? ` (${available} en stock)` : ""}`
              }
              className={`min-w-11 rounded-full px-3.5 py-2 font-mono text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                batch === value
                  ? "bg-cyan font-semibold text-ink"
                  : "text-white/55 hover:bg-white/5 hover:text-white"
              }`}
            >
              ×{value}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpen}
          disabled={!canOpen}
          className="btn btn-primary btn-lg px-7"
          aria-describedby="pack-open-note"
        >
          {opening ? (
            `Ouverture${keep > 1 ? ` ×${keep}` : ""}…`
          ) : available < 1 ? (
            "Aucun booster en stock"
          ) : ready ? (
            <span className="flex items-center justify-center gap-2.5">
              <span className="font-semibold">Ouvrir{keep > 1 ? ` ×${keep}` : ""}</span>
              <span aria-hidden className="h-3.5 w-px bg-ink/25" />
              <span className="text-[13px] font-normal text-ink/75">
                Gratuit · {available} restant{available > 1 ? "s" : ""}
              </span>
            </span>
          ) : (
            "Bientôt disponible"
          )}
        </button>
      </div>

      <p
        id="pack-open-note"
        className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-white/40"
      >
        {!ready
          ? `${pack.stats.poolSize} / ${pack.stats.minPoolSize} persos — le pack s'ouvrira tout seul au seuil atteint.`
          : `Un booster toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes : le stock se remplit tout seul.`}
      </p>

      <button
        type="button"
        onClick={onShowCharacters}
        className="btn btn-outline btn-sm mt-4"
        disabled={pack.stats.poolSize === 0}
      >
        Voir les {pack.stats.poolSize} persos
      </button>
    </div>
  );
}
