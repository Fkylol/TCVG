"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { recycleAllDuplicates } from "@/app/actions";
import { CardFlip } from "@/components/card-flip";
import { ReportCardButton } from "@/components/report-card-button";
import { SellCardButton } from "@/components/sell-card-button";
import {
  CARDS,
  UNIVERSES,
  getCard,
  getCardGradient,
  type Card,
  type Rarity,
  type UniverseKey,
} from "@/lib/cards";
import { getCardArt } from "@/lib/card-art";
import { cardStats } from "@/lib/stats";
import { RARITY, RARITY_ORDER } from "@/lib/game";
import type { CardVariant } from "@/lib/variants";
import { framingStyle } from "@/lib/framing";

export type CollectionEntry = {
  cardId: string;
  quantity: number;
  /** Copies brillantes parmi `quantity`. */
  holoQuantity: number;
  /** Misprint de la première copie variante, sinon `normal`. */
  variant: CardVariant;
  /** Carte retirée du catalogue : affichée sans visuel. */
  retired: boolean;
  firstObtainedAt: string;
};

/** L > UR > … > C, puis puissance + aura, puis nom. */
function compareCards(a: Card, b: Card): number {
  const rarity = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  if (rarity !== 0) return rarity;
  const power = cardStats(b).power + cardStats(b).aura - (cardStats(a).power + cardStats(a).aura);
  return power !== 0 ? power : a.name.localeCompare(b.name, "fr");
}

type Sorter = (a: Card, b: Card) => number;

const sorters: Record<"recent" | "rarete" | "nom", Sorter> = {
  recent: () => 0,
  rarete: (a, b) =>
    RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name),
  nom: (a, b) => a.name.localeCompare(b.name, "fr"),
};

type Album = {
  key: UniverseKey;
  label: string;
  from: string;
  to: string;
  owned: number;
  total: number;
  /** Meilleure carte possédée de l'univers : elle illustre l'album. */
  best: Card | null;
};

export function CollectionBrowser({
  entries,
  recycleValues,
  owners,
}: {
  entries: CollectionEntry[];
  /** Pixels gagnés par rareté, lus en base. */
  recycleValues: Record<Rarity, number>;
  /** Joueurs possédant chaque carte, comptés en base (vide si indisponible). */
  owners: Record<string, number>;
}) {
  const router = useRouter();
  const [view, setView] = useState<"cards" | "albums">("cards");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [universe, setUniverse] = useState<UniverseKey | "all">("all");
  const [sort, setSort] = useState<keyof typeof sorters>("recent");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);

  const owned = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, card: getCard(entry.cardId) }))
        .filter((item): item is { entry: CollectionEntry; card: Card } => Boolean(item.card)),
    [entries],
  );

  const totalCopies = owned.reduce((sum, { entry }) => sum + entry.quantity, 0);
  const duplicates = totalCopies - owned.length;

  // Doublons normaux recyclables : les holos et la première copie normale sont
  // toujours conservées, comme dans `recycle_all_duplicates()`.
  const bulk = useMemo(() => {
    let cards = 0;
    let amount = 0;
    for (const { card, entry } of owned) {
      const extra = Math.max(0, entry.quantity - entry.holoQuantity - 1);
      if (extra === 0) continue;
      cards += extra;
      amount += extra * (recycleValues[card.rarity] ?? 0);
    }
    return { cards, amount };
  }, [owned, recycleValues]);

  async function recycleAll() {
    if (bulkBusy || bulk.cards === 0) return;
    if (
      !window.confirm(
        `Recycler ${bulk.cards} doublon${bulk.cards > 1 ? "s" : ""} normal${bulk.cards > 1 ? "aux" : ""} pour ◆ ${bulk.amount} ? Les holos ne sont pas touchées.`,
      )
    ) {
      return;
    }

    setBulkBusy(true);
    setBulkNote(null);
    try {
      const result = await recycleAllDuplicates();
      if (result.status === "ok") {
        setBulkNote(
          result.amount > 0
            ? `+${result.amount} ◆ · ${result.cards} doublon${result.cards > 1 ? "s" : ""} recyclé${result.cards > 1 ? "s" : ""}`
            : "Aucun doublon à recycler.",
        );
        router.refresh();
      } else {
        setBulkNote(result.message);
      }
    } finally {
      setBulkBusy(false);
    }
  }

  const albums = useMemo<Album[]>(() => {
    const ownedByUniverse = new Map<UniverseKey, number>();
    const bestByUniverse = new Map<UniverseKey, Card>();
    for (const { card } of owned) {
      ownedByUniverse.set(card.universe, (ownedByUniverse.get(card.universe) ?? 0) + 1);

      // La vignette de l'album est la carte la plus rare piochée dedans ; à
      // rareté égale, la plus puissante, puis l'ordre alphabétique.
      const current = bestByUniverse.get(card.universe);
      if (!current || compareCards(card, current) < 0) bestByUniverse.set(card.universe, card);
    }

    const totals = new Map<UniverseKey, number>();
    for (const card of CARDS) totals.set(card.universe, (totals.get(card.universe) ?? 0) + 1);

    return Array.from(totals.entries())
      .map(([key, total]) => ({
        key,
        total,
        owned: ownedByUniverse.get(key) ?? 0,
        best: bestByUniverse.get(key) ?? null,
        label: UNIVERSES[key].label,
        from: UNIVERSES[key].from,
        to: UNIVERSES[key].to,
      }))
      .sort(
        (a, b) =>
          b.owned / b.total - a.owned / a.total ||
          b.owned - a.owned ||
          a.label.localeCompare(b.label, "fr"),
      );
  }, [owned]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = owned.filter(({ card, entry }) => {
      if (rarity !== "all" && card.rarity !== rarity) return false;
      if (universe !== "all" && card.universe !== universe) return false;
      if (!needle) return true;
      return (
        card.name.toLowerCase().includes(needle) ||
        UNIVERSES[card.universe].label.toLowerCase().includes(needle) ||
        entry.cardId.includes(needle)
      );
    });

    if (sort === "recent") return list;
    return [...list].sort((a, b) => sorters[sort](a.card, b.card));
  }, [owned, query, rarity, universe, sort]);

  const universesInCollection = useMemo(
    () =>
      Array.from(new Set(owned.map(({ card }) => card.universe))).sort((a, b) =>
        UNIVERSES[a].label.localeCompare(UNIVERSES[b].label, "fr"),
      ),
    [owned],
  );

  function openAlbum(key: UniverseKey) {
    setUniverse(key);
    setRarity("all");
    setQuery("");
    setView("cards");
  }

  return (
    <div>
      <div className="toolbar mb-6">
        {view === "cards" ? (
          <>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un personnage, un univers…"
              className="field min-w-[200px] flex-1"
            />

            <select
              value={universe}
              onChange={(event) => setUniverse(event.target.value as UniverseKey | "all")}
              className="field w-auto"
            >
              <option value="all">Tous les univers</option>
              {universesInCollection.map((key) => (
                <option key={key} value={key}>
                  {UNIVERSES[key].label}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as keyof typeof sorters)}
              className="field w-auto"
            >
              <option value="recent">Plus récentes</option>
              <option value="rarete">Rareté</option>
              <option value="nom">Nom</option>
            </select>
          </>
        ) : (
          <p className="flex-1 text-sm text-white/45">
            Progression par album — clique sur un univers pour l&apos;ouvrir.
          </p>
        )}

        <div className="tabs text-xs">
          <button
            type="button"
            onClick={() => setView("albums")}
            className={`tab px-3 py-1.5 ${view === "albums" ? "bg-cyan text-ink" : ""}`}
          >
            Albums
          </button>
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`tab px-3 py-1.5 ${view === "cards" ? "bg-cyan text-ink" : ""}`}
          >
            Cartes
          </button>
        </div>
      </div>

      {view === "cards" && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRarity("all")}
            className={`btn btn-sm ${rarity === "all" ? "btn-primary" : "btn-outline"}`}
          >
            Toutes ({owned.length})
          </button>
          {RARITY_ORDER.map((key) => {
            const info = RARITY[key];
            const count = owned.filter(({ card }) => card.rarity === key).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRarity(key)}
                className={`btn btn-sm ${rarity === key ? "btn-primary" : `btn-outline ${info.text}`}`}
              >
                {info.label} ({count})
              </button>
            );
          })}

          <span className="ml-auto text-xs text-white/40">
            {totalCopies} carte{totalCopies > 1 ? "s" : ""} · {duplicates} doublon
            {duplicates > 1 ? "s" : ""} · {filtered.length} affichée{filtered.length > 1 ? "s" : ""}
          </span>

          {bulk.cards > 0 && (
            <button
              type="button"
              onClick={recycleAll}
              disabled={bulkBusy}
              className="btn btn-sm btn-cyan"
            >
              {bulkBusy
                ? "Recyclage…"
                : `Recycler les doublons · +${bulk.amount} ◆`}
            </button>
          )}
        </div>
      )}

      {bulkNote && (
        <p
          role="status"
          className={`mb-5 border-l-2 px-3 py-2 text-xs ${
            bulkNote.startsWith("+")
              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/60 bg-amber-500/10 text-amber-200"
          }`}
        >
          {bulkNote}
        </p>
      )}

      {view === "albums" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {albums.map((album) => {
            const percent = (album.owned / album.total) * 100;
            const started = album.owned > 0;
            return (
              <button
                key={album.key}
                type="button"
                onClick={() => openAlbum(album.key)}
                className={`panel flex items-center gap-3 p-3 text-left transition ${
                  started ? "hover:brightness-110" : "opacity-55 hover:opacity-90"
                }`}
              >
                <AlbumThumb album={album} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{album.label}</span>
                    <span className="shrink-0 font-mono text-xs text-white/45">
                      {album.owned}/{album.total}
                    </span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden bg-white/10">
                    <span
                      className="block h-full bg-cyan transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-white/15 px-6 py-16 text-center text-white/50">
          {owned.length === 0
            ? "Ta collection est vide. Ouvre ton premier booster pour commencer."
            : "Aucune carte ne correspond à ces filtres."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {filtered.map(({ card, entry }) => {
            // Toute carte possédée est vendable, doublon ou dernière copie.
            const sellable = entry.quantity >= 1;
            return (
              <div key={card.id} className="group flex flex-col">
                <CardFlip
                  card={card}
                  firstObtainedAt={entry.firstObtainedAt}
                  owners={owners[card.id] ?? null}
                  variant={entry.variant}
                  retired={entry.retired}
                  holo={entry.holoQuantity > 0}
                />
                {(entry.holoQuantity > 0 || entry.quantity > 1) && (
                  <div className="mt-1.5 flex items-center justify-end gap-1.5 px-0.5 text-[10px] text-white/40">
                    {entry.holoQuantity > 0 && (
                      <span
                        className="font-semibold text-amber-300"
                        title={`${entry.holoQuantity} exemplaire(s) holo`}
                      >
                        ✦{entry.holoQuantity}
                      </span>
                    )}
                    {entry.quantity > 1 && (
                      <span className="font-semibold text-white/60">×{entry.quantity}</span>
                    )}
                  </div>
                )}

                {sellable && (
                  <div className="mt-1 flex flex-col items-stretch gap-1 text-center">
                    <SellCardButton
                      card={card}
                      quantity={entry.quantity}
                      holoQuantity={entry.holoQuantity}
                    />
                  </div>
                )}

                {/* Un visuel cassé ou une fiche fausse se signale depuis la
                    carte : le message part dans l'atelier pour vérification. */}
                <div className="mt-0.5">
                  <ReportCardButton card={card} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Vignette d'un album : la meilleure carte piochée dans cet univers, ou le
 * dégradé de l'univers tant qu'il est vide.
 */
function AlbumThumb({ album }: { album: Album }) {
  const [failed, setFailed] = useState(false);
  const art = album.best ? getCardArt(album.best.id) : null;
  const gradient = album.best ? getCardGradient(album.best) : album;
  const showArt = Boolean(art) && !failed;

  return (
    <span
      title={album.best?.name}
      className="cut relative h-12 w-9 shrink-0 overflow-hidden ring-1 ring-white/15"
      style={{ background: `linear-gradient(150deg, ${gradient.from}, ${gradient.to})` }}
    >
      {art && showArt ? (
        <Image
          src={art.src}
          alt=""
          fill
          sizes="36px"
          unoptimized={!art.local}
          style={framingStyle(art.framing)}
          onError={() => setFailed(true)}
        />
      ) : album.best ? (
        <span className="absolute inset-0 grid place-items-center text-sm" aria-hidden>
          {album.best.emoji}
        </span>
      ) : null}
    </span>
  );
}
