"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CardFace } from "@/components/card-face";
import { UNIVERSES, getCard, type Card, type Rarity, type UniverseKey } from "@/lib/cards";
import { RARITY, RARITY_ORDER } from "@/lib/game";

export type CollectionEntry = {
  cardId: string;
  quantity: number;
  firstObtainedAt: string;
};

type Sorter = (a: Card, b: Card) => number;

const sorters: Record<"recent" | "rarete" | "nom", Sorter> = {
  recent: () => 0,
  rarete: (a, b) =>
    RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name),
  nom: (a, b) => a.name.localeCompare(b.name, "fr"),
};

export function CollectionBrowser({ entries }: { entries: CollectionEntry[] }) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [universe, setUniverse] = useState<UniverseKey | "all">("all");
  const [sort, setSort] = useState<keyof typeof sorters>("recent");

  const owned = useMemo(
    () =>
      entries
        .map((entry) => ({ entry, card: getCard(entry.cardId) }))
        .filter((item): item is { entry: CollectionEntry; card: Card } => Boolean(item.card)),
    [entries],
  );

  const totalCopies = owned.reduce((sum, { entry }) => sum + entry.quantity, 0);

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
    () => Array.from(new Set(owned.map(({ card }) => card.universe))).sort((a, b) =>
      UNIVERSES[a].label.localeCompare(UNIVERSES[b].label, "fr"),
    ),
    [owned],
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un personnage, un univers…"
          className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-violet-400/60"
        />

        <select
          value={universe}
          onChange={(event) => setUniverse(event.target.value as UniverseKey | "all")}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400/60"
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
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-violet-400/60"
        >
          <option value="recent">Plus récentes</option>
          <option value="rarete">Rareté</option>
          <option value="nom">Nom</option>
        </select>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRarity("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            rarity === "all" ? "bg-white text-violet-950" : "border border-white/15 text-white/60 hover:text-white"
          }`}
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
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                rarity === key
                  ? "bg-white text-violet-950"
                  : `${info.badge} hover:brightness-125`
              }`}
            >
              {info.label} ({count})
            </button>
          );
        })}

        <span className="ml-auto text-xs text-white/40">
          {totalCopies} exemplaire{totalCopies > 1 ? "s" : ""} · {filtered.length} affichée(s)
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center text-white/50">
          {owned.length === 0
            ? "Ta collection est vide. Ouvre ton premier booster pour commencer."
            : "Aucune carte ne correspond à ces filtres."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {filtered.map(({ card, entry }) => (
            <Link key={card.id} href={`/card/${card.id}`} className="group relative block">
              <CardFace card={card} size="sm" className="aspect-[3/4] transition group-hover:-translate-y-1" />
              {entry.quantity > 1 && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/20">
                  ×{entry.quantity}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
