"use client";

import { useEffect, useRef, useState } from "react";
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

/** Raretés affichées dans les barres de chance (le Commun n'a pas d'intérêt). */
const CHANCE_RARITIES = ["UC", "R", "SR", "UR", "L"] as const;

/** Lots proposés au-dessus du bouton d'ouverture. */
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

/**
 * Page Boosters : les dix packs côte à côte, un seul sélectionné à la fois.
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
  const [sheetOpen, setSheetOpen] = useState(false);
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selected = packs.find((pack) => pack.id === selectedId) ?? packs[0] ?? null;
  const { stock: stockAvailable, nextAt } = projectedStock(stock, anchor, now);
  const available = stockAvailable + bonus;
  const nextIn = nextAt === null ? null : Math.max(0, nextAt - now);
  const readyCount = packs.filter((pack) => pack.stats.available).length;
  // Le lot est plafonné par le total disponible (stock + bonus).
  const keep = Math.min(batch, available);
  const canOpen = Boolean(selected?.stats.available) && available >= 1 && !opening;

  function select(pack: PackView) {
    setSelectedId(pack.id);
    setError(null);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setSheetOpen(true);
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
    setSheetOpen(false);

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

  const panel = selected ? (
    <PackPanel
      pack={selected}
      available={available}
      bonus={bonus}
      keep={keep}
      batch={batch}
      onBatch={setBatch}
      nextIn={nextIn}
      canOpen={canOpen}
      opening={opening}
      onOpen={() => void open()}
      onShowCharacters={() => setCharactersOpen(true)}
    />
  ) : null;

  return (
    <div>
      <div className="mb-6">
        <span className="eyebrow">Boosters</span>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
          <div>
            <h1 className="display text-4xl">Choisis ton booster</h1>
            <span className="title-rule" aria-hidden />
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/45">
            {CARDS_PER_BOOSTER} cartes par pack, un booster toutes les 10 minutes, jusqu&apos;à{" "}
            {BOOSTER_STOCK_MAX} en stock. Tous les packs sont disponibles.
          </p>
        </div>
      </div>

      {/* État en trois chiffres : le stock d'abord, puis l'album et les packs
          ouvrables. Le détail passe au second plan, sous chaque valeur. */}
      <dl className="mb-6 grid divide-y divide-white/10 border border-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-4 py-3">
          <dt className="text-[10px] uppercase tracking-[0.18em] text-white/40">Stock</dt>
          <dd className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-semibold ${
                available > 0 ? "text-acid" : "text-white/40"
              }`}
            >
              {stockAvailable}
            </span>
            <span className="font-mono text-sm text-white/35">/ {BOOSTER_STOCK_MAX}</span>
            {bonus > 0 && (
              <span
                title="Boosters bonus du parrainage : hors plafond, sans expiration"
                className="chip px-1.5 py-0.5 text-[10px] text-acid"
              >
                +{bonus} bonus
              </span>
            )}
            <span className="ml-auto text-right text-[11px] text-white/40">
              {stockAvailable >= BOOSTER_STOCK_MAX
                ? "Plein"
                : nextIn !== null
                  ? `+1 dans ${formatCountdown(nextIn)}`
                  : `+1 toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} min`}
            </span>
          </dd>
        </div>

        <div className="px-4 py-3">
          <dt className="text-[10px] uppercase tracking-[0.18em] text-white/40">Album</dt>
          <dd className="mt-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-semibold">{uniqueOwned}</span>
              <span className="font-mono text-sm text-white/35">/ {totalCards}</span>
            </span>
            <span className="mt-1.5 block h-0.5 bg-white/10">
              <span
                className="block h-full bg-acid"
                style={{ width: `${Math.min(100, Math.round((uniqueOwned / totalCards) * 100))}%` }}
              />
            </span>
          </dd>
        </div>

        <div className="px-4 py-3">
          <dt className="text-[10px] uppercase tracking-[0.18em] text-white/40">
            Packs disponibles
          </dt>
          <dd className="mt-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-semibold">{readyCount}</span>
              <span className="font-mono text-sm text-white/35">/ {packs.length}</span>
            </span>
            <span className="mt-1.5 block h-0.5 bg-white/10">
              <span
                className="block h-full bg-acid"
                style={{
                  width: `${packs.length ? Math.round((readyCount / packs.length) * 100) : 0}%`,
                }}
              />
            </span>
          </dd>
        </div>
      </dl>

      <p className="sr-only" aria-live="polite">
        {selected ? `Pack sélectionné : ${selected.name}` : ""}
      </p>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <ul
            className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4"
            aria-label="Les douze boosters"
          >
            {packs.map((pack) => {
              const isSelected = pack.id === selected?.id;
              const ready = pack.stats.available;

              return (
                <li key={pack.id} className="mx-auto w-full max-w-[190px]">
                  <button
                    type="button"
                    onClick={() => select(pack)}
                    aria-pressed={isSelected}
                    aria-label={
                      ready
                        ? `Booster ${pack.name}, ${CARDS_PER_BOOSTER} cartes, gratuit`
                        : `Booster ${pack.name}, bientôt disponible : ${pack.stats.poolSize} sur ${pack.stats.minPoolSize} persos`
                    }
                    className="block w-full rounded-2xl text-center outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70"
                  >
                    <BoosterPack
                      pack={pack}
                      locked={!ready}
                      selected={isSelected}
                      showPrice={false}
                    />
                    <span
                      className={`mt-3 block font-mono text-[10px] uppercase tracking-[0.12em] ${
                        !ready
                          ? "text-white/35"
                          : isSelected
                            ? "text-acid/80"
                            : "text-white/45"
                      }`}
                    >
                      {ready
                        ? "Gratuit"
                        : `Bientôt · ${pack.stats.poolSize} / ${pack.stats.minPoolSize} persos`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20">{panel}</div>
        </aside>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      {/* Mobile : fiche du pack sélectionné, ouverte au tap. */}
      {sheetOpen && selected && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fermer le détail du booster"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t border-t border-white/10 bg-ink-soft p-4">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSheetOpen(false)}
              >
                Fermer
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}

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

/** Panneau de détails, partagé entre la colonne desktop et la feuille mobile. */
function PackPanel({
  pack,
  available,
  bonus,
  keep,
  batch,
  onBatch,
  nextIn,
  canOpen,
  opening,
  onOpen,
  onShowCharacters,
}: {
  pack: PackView;
  available: number;
  /** Part bonus dans `available`. */
  bonus: number;
  /** Boosters réellement ouverts par le lot sélectionné (plafonné au stock). */
  keep: number;
  batch: (typeof BATCHES)[number];
  onBatch: (value: (typeof BATCHES)[number]) => void;
  nextIn: number | null;
  canOpen: boolean;
  opening: boolean;
  onOpen: () => void;
  onShowCharacters: () => void;
}) {
  const ready = pack.stats.available;

  return (
    <div className="panel overflow-hidden">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
              {ready ? "Disponible" : "Bientôt"}
            </p>
            <h2 className="display mt-1 truncate text-xl">{pack.name}</h2>
            <p className="truncate text-xs text-white/45">{pack.subtitle}</p>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
            N°{String(PACKS.findIndex((entry) => entry.id === pack.id) + 1).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-white/10">
        <div className="px-5 py-3">
          <p className="font-mono text-lg font-semibold">{CARDS_PER_BOOSTER}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/45">cartes par booster</p>
        </div>
        <div className="border-l border-white/10 px-5 py-3">
          {GUARANTEE_ENABLED ? (
            <>
              <p className="font-mono text-lg font-semibold">R+</p>
              <p className="mt-0.5 text-[11px] leading-tight text-white/45">Rare ou mieux, garantie</p>
            </>
          ) : (
            <>
              <p className="font-mono text-lg font-semibold">{pack.stats.poolSize}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-white/45">persos dans le pack</p>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        <button
          type="button"
          onClick={onShowCharacters}
          className="btn btn-outline btn-sm w-full"
          disabled={pack.stats.poolSize === 0}
        >
          Voir les {pack.stats.poolSize} persos
        </button>
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Chance par booster</p>
          <p className="font-mono text-[10px] text-white/25">≥ 1 carte</p>
        </div>
        <ul className="mt-3 space-y-2.5">
          {CHANCE_RARITIES.map((key) => {
            const info = RARITY[key];
            const chance = pack.stats.chances[key];
            const percent = typeof chance === "number" ? chance * 100 : null;

            return (
              <li key={key}>
                <div className="flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1.5 ${info.text}`}>
                    <span className={`chip px-1 py-0.5 text-[9px] font-bold ${info.badge}`}>
                      {info.short}
                    </span>
                    {info.label}
                  </span>
                  <span className="font-mono text-white/60">
                    {percent === null ? "—" : formatChance(percent / 100)}
                  </span>
                </div>
                <div
                  className="mt-1 h-1 overflow-hidden bg-white/10"
                  role="img"
                  aria-label={`${info.label} : ${
                    percent === null ? "aucune chance" : `${formatChance(percent / 100)} par booster`
                  }`}
                >
                  <div
                    className={`h-full ${info.bar}`}
                    style={{ width: `${Math.min(100, percent ?? 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-white/30">
          Chance d&apos;obtenir au moins une carte de la rareté dans le booster, calculée sur le
          tirage réel du pack.
        </p>
      </div>

      <div className="border-t border-white/10 px-5 py-4">
        {/* Lot d'ouverture : pilules ×1, ×5, ×10 centrées au-dessus du bouton.
            Au-delà du stock, le lot est ramené au nombre de boosters présents. */}
        <div className="mb-3 flex justify-center">
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
                className={`min-w-11 rounded-full px-3 py-1.5 font-mono text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  batch === value
                    ? "bg-acid font-semibold text-ink"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                ×{value}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          disabled={!canOpen}
          className="btn btn-primary w-full"
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

        <p id="pack-open-note" className="mt-2 text-center text-[11px] text-white/40">
          {!ready
            ? `${pack.stats.poolSize} / ${pack.stats.minPoolSize} persos — le pack s'ouvrira tout seul au seuil atteint.`
            : available < 1
              ? nextIn !== null
                ? `Prochain booster dans ${formatCountdown(nextIn)}`
                : `Un booster toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes.`
              : `Stock commun : ${available - bonus} / ${BOOSTER_STOCK_MAX}${
                  bonus > 0 ? ` · +${bonus} bonus` : ""
                } · un toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes.`}
        </p>
      </div>
    </div>
  );
}
