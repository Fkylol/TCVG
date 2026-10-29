"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buyListing, cancelBuyOrder, cancelListing, updateListingPrice } from "@/app/actions";
import { AvatarFrame } from "@/components/avatar-frame";
import { CardFace } from "@/components/card-face";
import { getCardArt } from "@/lib/card-art";
import { getCard, getCardNumber, type Rarity } from "@/lib/cards";
import type { BuyOrder, GenreOption, MarketListing } from "@/lib/data";
import { RARITY, RARITY_ORDER } from "@/lib/game";
import { useLocale } from "@/components/locale-provider";

type Note = { tone: "ok" | "bad"; text: string } | null;
type Sort = "recent" | "price-asc" | "price-desc";

/** Copies déjà possédées pour une carte (les holos sont comptées à part). */
type OwnedCopy = { quantity: number; holoQuantity: number };

const STATUS_LABEL: Record<MarketListing["status"], string> = {
  active: "En vente",
  sold: "Vendu",
  cancelled: "Annulé",
};

const STATUS_STYLE: Record<MarketListing["status"], string> = {
  active: "bg-cyan/15 text-cyan",
  sold: "bg-emerald-400/15 text-emerald-300",
  cancelled: "bg-white/10 text-white/45",
};

/** Libellés des ordres d'achat — mêmes mots que les annonces. */
const ORDER_LABEL: Record<BuyOrder["status"], string> = {
  active: "En attente",
  filled: "Servi",
  cancelled: "Annulé",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** « Expire dans 5 jours » — repère lisible sans dépendre de l'heure exacte. */
function expiryLabel(value: string | null, t: (text: string) => string): string {
  if (!value) return "";
  const days = Math.ceil((Date.parse(value) - Date.now()) / 86_400_000);
  if (days <= 0) return t("Expiration dépassée");
  if (days === 1) return t("Expire demain");
  return `${t("Expire dans ")}${days} ${t("jours")}`;
}

/** Une annulation pour expiration se lit « Expirée », pas « Annulée ». */
function statusLabel(listing: MarketListing, t: (text: string) => string): string {
  if (listing.status === "cancelled" && listing.cancelReason === "expired") return t("Expirée");
  return t(STATUS_LABEL[listing.status]);
}

export function MarketBrowser({
  listings,
  genres,
  pixels,
  userId,
  initialCard = null,
  orders,
  owned,
}: {
  listings: MarketListing[];
  genres: GenreOption[];
  pixels: number;
  userId: string;
  /** Carte sur laquelle le marché est filtré à l'arrivée (`/marche?carte=`). */
  initialCard?: string | null;
  /** Ordres d'achat du joueur, actifs ou terminés. */
  orders: BuyOrder[];
  /** Collection du joueur, indexée par carte : pastille « possédée ». */
  owned: Record<string, OwnedCopy>;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [tab, setTab] = useState<"market" | "mine" | "orders">("market");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [genre, setGenre] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [cardFilter, setCardFilter] = useState<string>(initialCard ?? "all");
  const [busy, setBusy] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [currentPixels, setCurrentPixels] = useState(pixels);

  const active = useMemo(() => listings.filter((listing) => listing.status === "active"), [listings]);
  const mine = useMemo(
    () => listings.filter((listing) => listing.mine || listing.sellerId === userId),
    [listings, userId],
  );
  const myActive = mine.filter((listing) => listing.status === "active");
  const myFinished = mine.filter((listing) => listing.status !== "active").slice(0, 20);
  const activeOrders = orders.filter((order) => order.status === "active");
  const finishedOrders = orders.filter((order) => order.status !== "active").slice(0, 20);
  // Pixels immobilisés par les ordres en attente : le solde affiché reste net.
  const reservedPixels = activeOrders.reduce((sum, order) => sum + order.reserved, 0);

  const filtered = useMemo(() => {
    const low = Number.parseInt(minPrice, 10);
    const high = Number.parseInt(maxPrice, 10);
    const list = active.filter((listing) => {
      const card = getCard(listing.cardId);
      if (!card) return false;
      if (cardFilter !== "all" && listing.cardId !== cardFilter) return false;
      if (rarity !== "all" && card.rarity !== rarity) return false;
      if (genre !== "all" && !listing.genres.includes(genre)) return false;
      if (Number.isFinite(low) && listing.price < low) return false;
      if (Number.isFinite(high) && listing.price > high) return false;
      return true;
    });

    if (sort === "price-asc") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [active, cardFilter, rarity, genre, minPrice, maxPrice, sort]);

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
    } else if (result.status === "expired") {
      setNote({ tone: "bad", text: "Annonce expirée : la copie est revenue chez son vendeur." });
      router.refresh();
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(null);
  }

  async function cancelOrder(order: BuyOrder) {
    const card = getCard(order.cardId);
    if (!card || busy !== null) return;
    if (!window.confirm(`Annuler ton ordre sur ${card.name} ? Les ◆ ${order.reserved} réservés te reviennent.`)) {
      return;
    }

    setBusy(order.id);
    setNote(null);

    const result = await cancelBuyOrder(order.id);

    if (result.status === "ok") {
      setCurrentPixels(result.pixels);
      setNote({ tone: "ok", text: `Ordre annulé : ◆ ${result.refund} rendus.` });
      router.refresh();
    } else if (result.status === "unavailable") {
      setNote({ tone: "bad", text: "Cet ordre est déjà servi ou annulé." });
      router.refresh();
    } else {
      setNote({ tone: "bad", text: result.message });
    }

    setBusy(null);
  }

  async function savePrice(listing: MarketListing) {
    if (!editing || busy !== null) return;
    const card = getCard(listing.cardId);
    const value = Number.parseInt(editing.value, 10);

    if (!Number.isInteger(value) || value < 1) {
      setNote({ tone: "bad", text: "Indique un prix entier en Pixels." });
      return;
    }
    if (value === listing.price) {
      setEditing(null);
      return;
    }

    setBusy(listing.id);
    setNote(null);

    const result = await updateListingPrice(listing.id, value);

    if (result.status === "ok") {
      setNote({
        tone: "ok",
        text: result.sold
          ? `${card?.name ?? "La carte"} est partie à ◆ ${result.price} — l'ordre en attente a été servi.`
          : `Nouveau prix : ◆ ${result.price}.`,
      });
      setEditing(null);
      router.refresh();
    } else if (result.status === "out_of_bounds") {
      setNote({
        tone: "bad",
        text: `Prix hors fourchette : entre ◆ ${result.min} et ◆ ${result.max}.`,
      });
    } else if (result.status === "expired") {
      setNote({ tone: "bad", text: "Annonce expirée : la copie est revenue dans ta collection." });
      setEditing(null);
      router.refresh();
    } else if (result.status === "unavailable") {
      setNote({ tone: "bad", text: "Annonce déjà vendue ou retirée." });
      setEditing(null);
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
        <div className="tabs text-xs">
          <button
            type="button"
            onClick={() => setTab("market")}
            className={`tab px-3 py-1.5 ${tab === "market" ? "bg-cyan text-ink" : ""}`}
          >
            {t("Annonces")} ({active.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`tab px-3 py-1.5 ${tab === "mine" ? "bg-cyan text-ink" : ""}`}
          >
            {t("Mes annonces")} ({myActive.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("orders")}
            className={`tab px-3 py-1.5 ${tab === "orders" ? "bg-cyan text-ink" : ""}`}
          >
            {t("Mes ordres")} ({activeOrders.length})
          </button>
        </div>

        <span className="chip ml-auto py-1.5 font-semibold text-cyan">◆ {currentPixels}</span>
        {reservedPixels > 0 && (
          <span className="chip py-1.5 text-white/45">
            <span className="font-sans text-white/30">{t("réservé")}</span> ◆ {reservedPixels}
          </span>
        )}
      </div>

      {note && (
        <p
          role="status"
          className={`mt-4 border-l-2 px-3 py-2 text-sm ${
            note.tone === "ok"
              ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
              : "border-rose-400/60 bg-rose-500/10 text-rose-200"
          }`}
        >
          {note.text}
        </p>
      )}

      {tab === "market" ? (
        <>
          <div className="toolbar mt-4">
            {cardFilter !== "all" && (
              <span className="chip gap-2 py-1.5 text-white/70">
                {getCard(cardFilter)?.name ?? cardFilter}
                <button
                  type="button"
                  onClick={() => setCardFilter("all")}
                  className="text-white/40 transition hover:text-cyan"
                  aria-label="Retirer le filtre de carte"
                >
                  ✕
                </button>
              </span>
            )}

            <select
              value={rarity}
              onChange={(event) => setRarity(event.target.value as Rarity | "all")}
              className="field w-auto"
            >
              <option value="all">{t("Toutes les raretés")}</option>
              {RARITY_ORDER.map((key) => (
                <option key={key} value={key}>
                  {RARITY[key].label}
                </option>
              ))}
            </select>

            <select
              value={genre}
              onChange={(event) => setGenre(event.target.value)}
              className="field w-auto"
            >
              <option value="all">{t("Tous les genres")}</option>
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
              placeholder={t("Prix min")}
              className="field w-24"
            />
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder={t("Prix max")}
              className="field w-24"
            />

            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="field w-auto"
            >
              <option value="recent">{t("Plus récentes")}</option>
              <option value="price-asc">{t("Prix croissant")}</option>
              <option value="price-desc">{t("Prix décroissant")}</option>
            </select>

            <span className="ml-auto text-xs text-white/40">
              {filtered.length} {t("annonces")}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-6 border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
              {active.length === 0
                ? t("Le marché est vide pour le moment. Ouvre des boosters, puis mets un doublon en vente depuis sa fiche.")
                : cardFilter !== "all"
                  ? `${t("Aucune annonce pour ")}${getCard(cardFilter)?.name ?? t("cette carte")}${t(" pour le moment.")}`
                  : t("Aucune annonce ne correspond à ces filtres.")}
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
                const ownedCopy = owned[card.id];

                // Possession annoncée d'un coup d'œil. Une annonce holo ne se
                // marque que si le joueur possède déjà une brillante : avoir la
                // version normale ne dit rien de celle-ci.
                const ownedLabel = !ownedCopy
                  ? null
                  : listing.holo
                    ? ownedCopy.holoQuantity > 0
                      ? `Holo possédée${ownedCopy.holoQuantity > 1 ? ` ×${ownedCopy.holoQuantity}` : ""}`
                      : null
                    : `Possédée${ownedCopy.quantity > 1 ? ` ×${ownedCopy.quantity}` : ""}`;
                const ownedTitle = ownedCopy
                  ? `Tu en as ${ownedCopy.quantity} exemplaire${ownedCopy.quantity > 1 ? "s" : ""}, dont ${ownedCopy.holoQuantity} holo${ownedCopy.holoQuantity > 1 ? "s" : ""}.`
                  : undefined;

                return (
                  <article
                    key={listing.id}
                    className="panel flex gap-3 p-3 transition hover:brightness-110"
                  >
                    <Link
                      href={`/card/${card.id}`}
                      className="relative w-24 shrink-0 self-start"
                    >
                      <CardFace card={card} size="sm" className="aspect-[3/4]" />
                      {listing.holo && (
                        <span className="chip absolute -top-1.5 right-1 z-10 bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
                          Holo
                        </span>
                      )}
                      {ownedLabel && (
                        <span
                          title={ownedTitle}
                          className={`chip absolute inset-x-1 bottom-1 z-10 justify-center px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            listing.holo
                              ? "bg-amber-300 text-amber-950"
                              : "bg-cyan text-ink"
                          }`}
                        >
                          {ownedLabel}
                        </span>
                      )}
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`chip px-2 py-0.5 text-[10px] font-semibold ${info.badge}`}>
                          {info.short}
                        </span>
                        <span className="font-mono text-[10px] text-white/30">
                          #{String(getCardNumber(card.id) ?? 0).padStart(2, "0")}
                        </span>
                      </div>

                      <h3 className="mt-1 truncate text-sm font-semibold text-white/90">{card.name}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <AvatarFrame
                          avatar={listing.sellerAvatarCardId ? getCardArt(listing.sellerAvatarCardId) : null}
                          initial={listing.sellerName.charAt(0)}
                          size={24}
                          frameId={listing.sellerFrame}
                        />
                        <p className="truncate text-[11px] text-white/40">
                          {t("Vendeur : ")}<span className="text-white/60">{listing.sellerName}</span>
                        </p>
                      </div>
                      <p className="mt-1 font-mono text-lg font-bold text-cyan">◆ {listing.price}</p>

                      {mineListing ? (
                        <button
                          type="button"
                          onClick={() => setTab("mine")}
                          className="btn btn-outline btn-sm mt-auto w-full">{t("Ton annonce")}</button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => buy(listing)}
                          disabled={working || short}
                          className="btn btn-primary btn-sm mt-auto w-full"
                        >
                          {working ? t("Achat…") : short ? `${t("Il manque ")}${listing.price - currentPixels} ◆` : t("Acheter")}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : tab === "mine" ? (
        <div className="mt-4">
          {myActive.length === 0 && myFinished.length === 0 ? (
            <div className="border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
              Tu n&apos;as aucune annonce.{" "}
              <Link href="/collection" className="text-cyan hover:underline">
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
                        className="panel flex gap-3 p-3"
                      >
                        <Link href={`/card/${card.id}`} className="relative w-24 shrink-0 self-start">
                          <CardFace card={card} size="sm" className="aspect-[3/4]" />
                          {listing.holo && (
                            <span className="chip absolute -top-1.5 right-1 z-10 bg-amber-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950">
                              Holo
                            </span>
                          )}
                        </Link>

                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className={`chip self-start px-2 py-0.5 text-[10px] font-semibold ${info.badge}`}>
                            {info.short}
                          </span>
                          <h3 className="mt-1 truncate text-sm font-semibold text-white/90">{card.name}</h3>
                          <p className="mt-0.5 font-mono text-base font-bold text-cyan">◆ {listing.price}</p>
                          <p className="text-[11px] text-white/35">
                            Mise en vente le {formatDate(listing.createdAt)}
                          </p>
                          {listing.expiresAt && (
                            <p className="text-[11px] text-amber-200/60">
                              {expiryLabel(listing.expiresAt, t)}
                            </p>
                          )}

                          {editing?.id === listing.id ? (
                            <div className="mt-auto flex items-center gap-1.5 pt-2">
                              <input
                                type="number"
                                min={1}
                                inputMode="numeric"
                                value={editing.value}
                                onChange={(event) =>
                                  setEditing({ id: listing.id, value: event.target.value })
                                }
                                aria-label={`Nouveau prix pour ${card.name}`}
                                className="field w-20 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => savePrice(listing)}
                                disabled={working}
                                className="btn btn-primary btn-sm flex-1"
                              >
                                {working ? "…" : "Enregistrer"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                disabled={working}
                                aria-label="Annuler le changement de prix"
                                className="btn btn-outline btn-sm"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="mt-auto flex gap-1.5 pt-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditing({ id: listing.id, value: String(listing.price) })
                                }
                                disabled={working}
                                className="btn btn-outline btn-sm flex-1"
                              >
                                Modifier le prix
                              </button>
                              <button
                                type="button"
                                onClick={() => cancel(listing)}
                                disabled={working}
                                className="btn btn-sm bg-rose-500/10 text-rose-200 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.35)]"
                              >
                                {working ? "…" : "Retirer"}
                              </button>
                            </div>
                          )}
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
                  <ul className="mt-3 divide-y divide-white/10 overflow-hidden border border-white/10 bg-white/[0.02]">
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
                            className={`px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[listing.status]}`}
                          >
                            {statusLabel(listing, t)}
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
      ) : (
        <div className="mt-4">
          {orders.length === 0 ? (
            <div className="border border-dashed border-white/15 px-6 py-14 text-center text-sm text-white/50">
              Aucun ordre d&apos;achat. Depuis la fiche d&apos;une carte, « Poser un ordre
              d&apos;achat » réserve ton prix maximum jusqu&apos;à ce qu&apos;une annonce passe en
              dessous.
            </div>
          ) : (
            <>
              <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">
                En attente ({activeOrders.length})
              </h2>
              {activeOrders.length === 0 ? (
                <p className="mt-2 text-sm text-white/45">Aucun ordre en attente.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10 overflow-hidden border border-white/10 bg-white/[0.02]">
                  {activeOrders.map((order) => {
                    const card = getCard(order.cardId);
                    if (!card) return null;
                    const working = busy === order.id;

                    return (
                      <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <Link
                          href={`/card/${card.id}`}
                          className="min-w-0 flex-1 truncate text-sm text-white/80 hover:text-cyan"
                        >
                          {card.name}
                          {order.holo ? " · holo" : ""}
                        </Link>
                        <span className="font-mono text-xs text-cyan">◆ {order.maxPrice}</span>
                        <span className="font-mono text-[11px] text-white/35">
                          réservé ◆ {order.reserved}
                        </span>
                        <span className="w-24 text-[11px] text-white/35">
                          {formatDate(order.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => cancelOrder(order)}
                          disabled={working}
                          className="btn btn-sm bg-rose-500/10 text-rose-200 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.35)]"
                        >
                          {working ? "Annulation…" : "Annuler"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {finishedOrders.length > 0 && (
                <>
                  <h2 className="mt-8 text-sm uppercase tracking-[0.18em] text-white/40">
                    Ordres terminés
                  </h2>
                  <ul className="mt-3 divide-y divide-white/10 overflow-hidden border border-white/10 bg-white/[0.02]">
                    {finishedOrders.map((order) => {
                      const card = getCard(order.cardId);
                      if (!card) return null;
                      return (
                        <li key={order.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                            {card.name}
                            {order.holo ? " · holo" : ""}
                          </span>
                          <span className="font-mono text-xs text-white/45">◆ {order.maxPrice}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[
                              order.status === "filled" ? "sold" : "cancelled"
                            ]}`}
                          >
                            {ORDER_LABEL[order.status]}
                          </span>
                          <span className="w-32 text-right text-[11px] text-white/35">
                            {order.status === "filled"
                              ? `achetée ◆ ${order.paid ?? order.maxPrice}`
                              : `remboursé ◆ ${order.maxPrice}`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
