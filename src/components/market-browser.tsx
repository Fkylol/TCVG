"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buyListing, cancelListing } from "@/app/actions";
import { CardFace } from "@/components/card-face";
import { getCard, getCardNumber, type Rarity } from "@/lib/cards";
import type { GenreOption, MarketListing } from "@/lib/data";
import { RARITY, RARITY_ORDER } from "@/lib/game";

type Note = { tone: "ok" | "bad"; text: string } | null;
type Sort = "recent" | "price-asc" | "price-desc";

const STATUS_LABEL: Record<MarketListing["status"], string> = {
  active: "En vente",
  sold: "Vendu",
  cancelled: "Annulé",
};

const STATUS_STYLE: Record<MarketListing["status"], string> = {
  active: "bg-acid/15 text-acid",
  sold: "bg-emerald-400/15 text-emerald-300",
  cancelled: "bg-white/10 text-white/45",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function MarketBrowser({
  listings,
  genres,
  pixels,
  userId,
}: {
  listings: MarketListing[];
  genres: GenreOption[];
  pixels: number;
  userId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [genre, setGenre] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [currentPixels, setCurrentPixels] = useState(pixels);

  const active = useMemo(() => listings.filter((listing) => listing.status === "active"), [listings]);
  const mine = useMemo(
    () => listings.filter((listing) => listing.mine || listing.sellerId === userId),
    [listings, userId],
  );
  const myActive = mine.filter((listing) => listing.status === "active");
  const myFinished = mine.filter((listing) => listing.status !== "active").slice(0, 20);

  const filtered = useMemo(() => {
    const low = Number.parseInt(minPrice, 10);
    const high = Number.parseInt(maxPrice, 10);
    const list = active.filter((listing) => {
      const card = getCard(listing.cardId);
      if (!card) return false;
      if (rarity !== "all" && card.rarity !== rarity) return false;
      if (genre !== "all" && !listing.genres.includes(genre)) return false;
      if (Number.isFinite(low) && listing.price < low) return false;
      if (Number.isFinite(high) && listing.price > high) return false;
      return true;
    });

    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [active, rarity, genre, minPrice, maxPrice, sort]);

  async function buy(listing: MarketListing) {
    const card = getCard(listing.cardId);
    if (!card || busy !== null || listing.mine || currentPixels < listing.price) return;

    const label = `${card.name}${listing.holo ? " (holo)" : ""}`;
    if (!window.confirm(`Acheter ${label} pour ◆ ${listing.price} ?`)) return;

    setBusy(listing.id);
    setNote(null);

    const result = await buyListing(listing.id);

    if (result.status === "ok") {
      setCurrentPixels(result.pixels);
      setNote({ tone: "ok", text: `${label} rejoint ta collection pour ◆ ${result.price}.` });
      router.refresh();
    } else if (result.status === "insufficient") {
      setCurrentPixels(result.pixels);
      setNote({
        tone: "bad",
        text: `Solde insuffisant : il te manque ${result.price - result.pixels} ◆.`,
      });
    } else if (result.status === "own") {
      setNote({ tone: "bad", text: "Cette annonce est la tienne." });
    } else if (result.status === "unavailable") {
      setNote({ tone: "bad", text: "Annonce déjà vendue ou annulée." });
      router.refresh();
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(null);
  }

  async function cancel(listing: MarketListing) {
    const card = getCard(listing.cardId);
    if (!card || busy !== null) return;
    if (!window.confirm(`Retirer l'annonce de ${card.name} ? La copie revient dans ta collection.`)) {
      return;
    }

    setBusy(listing.id);
    setNote(null);

    const result = await cancelListing(listing.id);

    if (result.status === "ok") {
      setNote({ tone: "ok", text: `Annonce retirée : ${card.name} est de retour dans ta collection.` });
      router.refresh();
    } else if (result.status === "unavailable") {
      setNote({ tone: "bad", text: "Annonce déjà terminée." });
      router.refresh();
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("market")}
            className={`rounded-lg px-3 py-1.5 transition ${
              tab === "market" ? "bg-acid text-ink" : "text-white/55 hover:text-white"
            }`}
          >
            Annonces ({active.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`rounded-lg px-3 py-1.5 transition ${
              tab === "mine" ? "bg-acid text-ink" : "text-white/55 hover:text-white"
            }`}
          >
            Mes annonces ({myActive.length})
          </button>
        </div>

        <span className="ml-auto rounded-full border border-acid/30 bg-acid/10 px-3 py-1.5 text-xs font-semibold text-acid tabular-nums">
          ◆ {currentPixels}
        </span>
      </div>

      {note && (
        <p
          role="status"
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            note.tone === "ok"
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/30 bg-rose-500/10 text-rose-200"
          }`}
        >
          {note.text}
        </p>
      )}

      {tab === "market" ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <select
              value={rarity}
              onChange={(event) => setRarity(event.target.value as Rarity | "all")}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-acid/60"
            >
              <option value="all">Toutes les raretés</option>
              {RARITY_ORDER.map((key) => (
                <option key={key} value={key}>
                  {RARITY[key].label}
                </option>
              ))}
            </select>

            <select
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-acid/60"
            >
              <option value="all">Tous les genres</option>
              {genres.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder="Prix min"
              className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-acid/60"
            />
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder="Prix max"
              className="w-24 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/35 focus:border-acid/60"
            />

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-acid/60"
            >
              <option value="recent">Plus récentes</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </select>

            <span className="ml-auto text-xs text-white/40">
              {filtered.length} annonce{filtered.length > 1 ? "s" : ""}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
              {active.length === 0
                ? "Le marché est vide pour le moment. Ouvre des boosters, puis mets un doublon en vente depuis sa fiche."
                : "Aucune annonce ne correspond à ces filtres."}
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((listing) => {
                const card = getCard(listing.cardId);
                if (!card) return null;
                const info = RARITY[card.rarity];
                const short = currentPixels < listing.price;
                const working = busy === listing.id;
                const mineListing = listing.mine || listing.sellerId === userId;

                return (
                  <article
                    key={listing.id}
                    className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20"
                  >
                    <Link
                      href={`/card/${card.id}`}
                      className="relative w-20 shrink-0 self-start sm:w-24"
                    >
                      <CardFace card={card} size="sm" className="aspect-[3/4]" />
                      {listing.holo && (
                        <span className="absolute -top-1.5 right-1 z-10 rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 shadow-lg">
                          Holo
                        </span>
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${info.badge}`}>
                          {info.short}
                        </span>
                        <span className="font-mono text-[10px] text-white/30">
                          #{String(getCardNumber(card.id) ?? 0).padStart(2, "0")}
                        </span>
                      </div>

                      <h3 className="mt-1 truncate text-sm font-semibold text-white/90">{card.name}</h3>
                      <p className="truncate text-[11px] text-white/40">
                        Vendeur : <span className="text-white/60">{listing.sellerName}</span>
                      </p>
                      <p className="mt-1 font-mono text-lg font-bold text-acid">◆ {listing.price}</p>

                      {mineListing ? (
                        <button
                          type="button"
                          onClick={() => setTab("mine")}
                          className="mt-auto w-full rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/60 transition hover:border-white/30 hover:text-white"
                        >
                          Ton annonce
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => buy(listing)}
                          disabled={working || short}
                          className="mt-auto w-full rounded-full bg-acid px-3 py-1.5 text-xs font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                        >
                          {working ? "Achat…" : short ? `Il manque ${listing.price - currentPixels} ◆` : "Acheter"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4">
          {myActive.length === 0 && myFinished.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
              Tu n&apos;as aucune annonce.{" "}
              <Link href="/collection" className="text-acid hover:underline">
                Choisis un doublon dans ta collection
              </Link>{" "}
              pour le mettre en vente depuis sa fiche.
            </div>
          ) : (
            <>
              <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">
                En vente ({myActive.length})
              </h2>
              {myActive.length === 0 ? (
                <p className="mt-2 text-sm text-white/45">Aucune annonce active.</p>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myActive.map((listing) => {
                    const card = getCard(listing.cardId);
                    if (!card) return null;
                    const info = RARITY[card.rarity];
                    const working = busy === listing.id;

                    return (
                      <article
                        key={listing.id}
                        className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <Link href={`/card/${card.id}`} className="relative w-20 shrink-0 self-start">
                          <CardFace card={card} size="sm" className="aspect-[3/4]" />
                          {listing.holo && (
                            <span className="absolute -top-1.5 right-1 z-10 rounded-full bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 shadow-lg">
                              Holo
                            </span>
                          )}
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-semibold ${info.badge}`}>
                            {info.short}
                          </span>
                          <h3 className="mt-1 truncate text-sm font-semibold text-white/90">{card.name}</h3>
                          <p className="mt-0.5 font-mono text-base font-bold text-acid">◆ {listing.price}</p>
                          <p className="text-[11px] text-white/35">
                            Mise en vente le {formatDate(listing.createdAt)}
                          </p>
                          <button
                            type="button"
                            onClick={() => cancel(listing)}
                            disabled={working}
                            className="mt-auto w-full rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {working ? "Annulation…" : "Retirer l'annonce"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {myFinished.length > 0 && (
                <>
                  <h2 className="mt-8 text-sm uppercase tracking-[0.18em] text-white/40">
                    Dernières annonces terminées
                  </h2>
                  <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                    {myFinished.map((listing) => {
                      const card = getCard(listing.cardId);
                      if (!card) return null;
                      return (
                        <li key={listing.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                            {card.name}
                            {listing.holo ? " · holo" : ""}
                          </span>
                          <span className="font-mono text-xs text-white/45">◆ {listing.price}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[listing.status]}`}
                          >
                            {STATUS_LABEL[listing.status]}
                          </span>
                          <span className="w-24 text-right text-[11px] text-white/35">
                            {listing.status === "sold"
                              ? `+${listing.payout ?? 0} ◆ net`
                              : formatDate(listing.soldAt ?? listing.createdAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-[11px] text-white/30">
                    Les montants nets affichés tiennent compte de la commission de 5 %.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
