import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardFace } from "@/components/card-face";
import { CardMarketActions } from "@/components/card-market-actions";
import { CardAnnounce } from "@/components/chat/card-announce";
import { CardPriceChart } from "@/components/card-price-chart";
import { CardSalesHistory } from "@/components/card-sales-history";
import { ListingForm } from "@/components/listing-form";
import { RecycleButton } from "@/components/recycle-button";
import { UniverseCards } from "@/components/universe-cards";
import { requireSession } from "@/lib/auth";
import { getCardLore } from "@/lib/card-lore";
import { catalogCards, catalogSize, getCard, getCardNumber, getUniverseLabel } from "@/lib/cards";
import {
  getCardBoosterChances,
  getCardGenres,
  getCardMarketStats,
  getCardOrderBook,
  getCardProfile,
  getCardSalesHistory,
  getCardWishlistCount,
  getMarketQuote,
  getOwnedCardIds,
  getProfile,
  getRecycleValues,
  isCardActive,
  isCardWishlisted,
} from "@/lib/data";
import { RARITY } from "@/lib/game";
import { getCardArt } from "@/lib/card-art";
import { attributionLabel, getPortrait, sourceLabel } from "@/lib/portraits";
import { cardStats } from "@/lib/stats";
import { VARIANT_LABELS, toCardVariant } from "@/lib/variants";

type Params = { params: Promise<{ id: string }> };

/** Paramètres de retour : fiche ouverte depuis la modale des persos du pack. */
type Search = { retour?: string; pack?: string };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const card = getCard(id);
  return {
    title: card ? `${card.name} — TCVG` : "Carte introuvable — TCVG",
    description: card
      ? `${card.name} (${getUniverseLabel(card.universe)}) : rareté, statistiques et cote du marché sur TCVG.`
      : undefined,
  };
}

function formatChance(chance: number): string {
  const percent = chance * 100;
  if (percent < 0.01) return "< 0,01 %";
  const digits = percent < 10 ? 2 : 1;
  return `${percent.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

export default async function CardPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<Search> }) {
  const { id } = await params;
  const { retour, pack } = await searchParams;
  const card = getCard(id);
  if (!card) notFound();

  const { supabase, user } = await requireSession();

  // Une carte retirée ne montre plus rien : ni visuel, ni fiche. `null` signifie
  // que la base ne connaît pas encore la carte (synchro du catalogue en
  // retard) : on la laisse passer plutôt que de casser la fiche.
  const active = await isCardActive(supabase, card.id);
  if (active === false) notFound();

  const sameUniverse = catalogCards().filter(
    (c) => c.universe === card.universe && c.id !== card.id,
  );

  const [
    { data },
    recycleValues,
    normalQuote,
    holoQuote,
    market,
    orderBook,
    chances,
    wishlisted,
    genres,
    ownedUniverse,
    profile,
    cardProfile,
    wishlistCount,
    salesHistory,
  ] = await Promise.all([
    supabase
      .from("collection")
      .select("quantity, holo_quantity, variant, first_obtained_at")
      .eq("user_id", user.id)
      .eq("card_id", card.id)
      .maybeSingle(),
    getRecycleValues(supabase),
    getMarketQuote(supabase, card.id, false),
    getMarketQuote(supabase, card.id, true),
    getCardMarketStats(supabase, card.id),
    getCardOrderBook(supabase, card.id),
    getCardBoosterChances(supabase, card.id),
    isCardWishlisted(supabase, user.id, card.id),
    getCardGenres(supabase, card.id),
    getOwnedCardIds(
      supabase,
      user.id,
      sameUniverse.map((other) => other.id),
    ),
    getProfile(supabase, user),
    getCardProfile(supabase, card.id),
    getCardWishlistCount(supabase, card.id),
    getCardSalesHistory(supabase, card.id, 12, 0),
  ]);

  const quantity = (data?.quantity as number | undefined) ?? 0;
  const holoQuantity = (data?.holo_quantity as number | null | undefined) ?? 0;
  const variant = toCardVariant(data?.variant as string | null | undefined);
  const firstObtained = data?.first_obtained_at as string | undefined;
  const owned = quantity > 0;

  // Le contenu éditorial n'est lu et rendu que pour une carte possédée : rien
  // du pouvoir, de la citation ou de la bio ne part au navigateur sinon.
  const lore = owned ? getCardLore(card.id) : undefined;
  // Le profil éditorial ne quitte le serveur que pour une carte possédée :
  // `getCardProfile` renvoie `null` sinon. Le lore local reste le repli tant
  // que la fiche n'est pas renseignée en base.
  const editorBio = cardProfile?.bio ?? lore?.bio ?? null;

  const normalValue = recycleValues[card.rarity] ?? 0;
  const holoValue = normalValue * 3;
  const recyclableNormals = Math.max(0, quantity - holoQuantity - 1);
  const recyclableHolo = holoQuantity > 0 && quantity > 1;
  // La dernière copie est vendable elle aussi : seule la variante annoncée doit
  // être possédée (une holo ne peut pas être vendue à la place d'une normale).
  const canSellNormal = quantity - holoQuantity >= 1;
  const canSellHolo = holoQuantity > 0;
  const rarity = RARITY[card.rarity];
  const stats = cardStats(card);
  // Un visuel local n'a pas d'attribution à afficher : seuls les hotlinks
  // (Wikipédia / Fandom) portent une source et une licence.
  const art = getCardArt(card.id);
  const portrait = art && !art.local ? getPortrait(card.id) : undefined;
  const number = String(getCardNumber(card.id) ?? 0).padStart(2, "0");
  const universe = getUniverseLabel(card.universe);
  const bestChance = chances[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pb-6">
      {retour === "persos" && pack && (
        <Link
          href={`/boosters?pack=${encodeURIComponent(pack)}&persos=1`}
          className="mb-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/40 transition hover:text-cyan"
        >
          <span aria-hidden>←</span> Retour aux persos du pack
        </Link>
      )}

      <nav
        aria-label="Fil d'Ariane"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35 sm:text-[11px]"
      >
        <Link href="/collection" className="transition hover:text-white/70">
          Wiki
        </Link>
        <span aria-hidden className="text-cyan/60">
          /
        </span>
        <Link href="/collection" className="transition hover:text-white/70">
          {universe}
        </Link>
        <span aria-hidden className="text-cyan/60">
          /
        </span>
        <span className="text-white/60">{card.name}</span>
      </nav>

      <header className="relative mt-5">
        <span
          aria-hidden
          className="display display-ghost pointer-events-none absolute -top-7 right-0 select-none whitespace-nowrap text-[clamp(3.5rem,14vw,8.5rem)] leading-none text-white/[0.035]"
        >
          {universe}
        </span>

        <div className="relative flex flex-wrap items-center gap-2">
          <span className="chip px-2.5 py-1 text-[11px] text-white/60">{universe}</span>
          <span className={`chip px-2.5 py-1 text-[11px] font-semibold ${rarity.badge}`}>
            {rarity.label}
          </span>
          <span
            className={`chip px-2.5 py-1 text-[11px] ${
              owned ? "text-cyan shadow-[inset_0_0_0_1px_var(--cyan-line)]" : "text-white/45"
            }`}
          >
            {owned ? `Possédée ×${quantity}` : "Non possédée"}
          </span>
        </div>

        <div className="relative mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
          <h1 className="display text-[clamp(2.6rem,9vw,5.2rem)] text-white">{card.name}</h1>
          <span className="mb-2 font-mono text-sm text-white/40">
            #{number} <span className="text-white/20">/</span> {catalogSize()}
          </span>
        </div>

        <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-white/55 sm:text-base">
          {(owned ? lore?.tagline : undefined) ?? (owned ? cardProfile?.overview : null) ?? `Personnage de ${universe}${owned ? "." : ", à débloquer dans les boosters."}`}
        </p>
      </header>

      <nav aria-label="Sections de la fiche" className="mt-6 flex flex-wrap gap-1.5">
        {owned && (
          <>
            <SectionLink href="#apercu">Aperçu</SectionLink>
            <SectionLink href="#biographie">Biographie</SectionLink>
            {cardProfile && cardProfile.appearances.length > 0 && (
              <SectionLink href="#apparitions">Apparitions</SectionLink>
            )}
            <SectionLink href="#caracteristiques">Caractéristiques</SectionLink>
          </>
        )}
        <SectionLink href="#cote">Marché</SectionLink>
        {sameUniverse.length > 0 && <SectionLink href="#meme-univers">Autres persos</SectionLink>}
      </nav>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        {/* ————— Colonne principale ————— */}
        <div className="min-w-0">
          {owned ? (
            <>
              {/* 01 — Aperçu : le résumé qui donne envie de lire la suite. */}
              <section id="apercu" className="scroll-mt-24">
                <SectionHeading index={1} label="Aperçu" />
                <p className="mt-3 max-w-2xl text-lg leading-relaxed text-white/80">
                  {cardProfile?.overview ?? lore?.tagline ?? `Personnage de ${universe}.`}
                </p>
              </section>

              {/* 02 — Biographie : le texte long, servi seulement au possesseur. */}
              <section id="biographie" className="mt-10 scroll-mt-24">
                <SectionHeading index={2} label="Biographie" title="Histoire" />
                {editorBio ? (
                  <p className="mt-4 max-w-2xl leading-relaxed text-white/65">{editorBio}</p>
                ) : (
                  <p className="mt-4 text-sm text-white/35">
                    La biographie de {card.name} arrivera bientôt.
                  </p>
                )}
              </section>

              {/* 03 — Apparitions : tableau média / titre, si la fiche en a. */}
              {cardProfile && cardProfile.appearances.length > 0 && (
                <section id="apparitions" className="mt-10 scroll-mt-24">
                  <SectionHeading index={3} label="Apparitions" />
                  <div className="panel mt-4 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.16em] text-white/40">
                          <th scope="col" className="w-28 px-4 py-2 font-medium">
                            Média
                          </th>
                          <th scope="col" className="px-4 py-2 font-medium">
                            Titre
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cardProfile.appearances.map((appearance, index) => (
                          <tr
                            key={`${appearance.title}-${index}`}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="px-4 py-2 text-white/45">{appearance.media}</td>
                            <td className="px-4 py-2 text-white/80">{appearance.title}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section id="caracteristiques" className="panel mt-10 scroll-mt-24 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="display text-sm tracking-[0.16em] text-white/45">
                    Caractéristiques
                  </h2>
                  <span className="chip text-[10px] font-semibold text-white/60">
                    {stats.grade.label} · {stats.quality}/100
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <StatBar label="POW" value={stats.power} tone="cyan" />
                  <StatBar label="AURA" value={stats.aura} tone="white" />
                </div>
              </section>                  {(lore?.power ?? cardProfile?.power) && (
                    <section className="panel panel-accent mt-4 p-5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan/80">Pouvoir</p>
                      <p className="mt-1.5 text-base font-medium text-white/90">{lore?.power ?? cardProfile?.power}</p>
                    </section>
                  )}                  {(lore?.quote ?? cardProfile?.quote) && (
                    <blockquote className="mt-6 border-l-2 border-cyan/50 pl-5">
                      <p className="text-lg italic leading-relaxed text-white/75">« {lore?.quote ?? cardProfile?.quote} »</p>
                    </blockquote>
                  )}

              {cardProfile &&
                (cardProfile.studio || cardProfile.voice || cardProfile.trivia) && (
                  <section className="panel mt-6 p-5">
                    <h2 className="display text-sm tracking-[0.16em] text-white/45">
                      Fiche du personnage
                    </h2>

                    {(cardProfile.studio || cardProfile.voice) && (
                      <dl className="mt-3 text-sm">
                        {cardProfile.studio && (
                          <InfoRow label="Studio">{cardProfile.studio}</InfoRow>
                        )}
                        {cardProfile.voice && (
                          <InfoRow label="Voix">{cardProfile.voice}</InfoRow>
                        )}
                      </dl>
                    )}

                    {cardProfile.trivia && (
                      <p className="mt-4 text-sm leading-relaxed text-white/55">
                        {cardProfile.trivia}
                      </p>
                    )}

                    {cardProfile.sourceName && (
                      <p className="mt-4 border-t border-white/10 pt-3 text-[10px] text-white/30">
                        Données :{" "}
                        {cardProfile.sourceUrl ? (
                          <a
                            href={cardProfile.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="underline underline-offset-2 transition hover:text-white/55"
                          >
                            {cardProfile.sourceName}
                          </a>
                        ) : (
                          cardProfile.sourceName
                        )}
                      </p>
                    )}
                  </section>
                )}

              <section className="panel mt-6 p-5">
                <h2 className="display text-sm tracking-[0.16em] text-white/45">Repères</h2>
                <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  <InfoRow label="Univers">{universe}</InfoRow>
                  <InfoRow label="Numéro">
                    #{number} / {catalogSize()}
                  </InfoRow>
                  <InfoRow label="Rareté">{rarity.label}</InfoRow>
                  <InfoRow label="Genres">
                    {genres.length > 0 ? genres.map((genre) => genre.name).join(" · ") : "—"}
                  </InfoRow>
                </dl>
              </section>

              <section className="panel mt-4 p-5">
                <h2 className="display text-sm tracking-[0.16em] text-white/45">
                  Ta collection
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  {quantity} exemplaire{quantity > 1 ? "s" : ""}
                  {holoQuantity > 0 && (
                    <>
                      {" · "}
                      <span className="font-mono text-white/85">✦ {holoQuantity} holo</span>
                    </>
                  )}
                  {variant !== "normal" && (
                    <>
                      {" · "}
                      <span className="font-mono text-white/85">
                        {VARIANT_LABELS[variant]}
                      </span>
                    </>
                  )}
                  {firstObtained && (
                    <>
                      {" · obtenu le "}
                      {new Date(firstObtained).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {recyclableNormals > 0 && (
                    <RecycleButton
                      cardId={card.id}
                      label={`Recycler un doublon · +${normalValue} ◆`}
                    />
                  )}
                  {recyclableHolo && (
                    <RecycleButton
                      cardId={card.id}
                      holo
                      label={`Recycler une holo · +${holoValue} ◆`}
                      confirmMessage={`Recycler une copie holo de ${card.name} pour ◆ ${holoValue} ? Une holo vaut 3 × la valeur de la carte.`}
                      className="btn btn-outline btn-sm"
                    />
                  )}
                </div>

                {recyclableNormals === 0 && !recyclableHolo && (
                  <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                    Il faut garder au moins un exemplaire : ouvre d&apos;autres boosters pour pouvoir
                    recycler un doublon.
                  </p>
                )}
              </section>

              {(normalQuote || holoQuote) && (
                <ListingForm
                  cardId={card.id}
                  normal={normalQuote}
                  holo={holoQuote}
                  canSellNormal={canSellNormal}
                  canSellHolo={canSellHolo}
                />
              )}
            </>
          ) : (
            <>
              <section className="panel panel-accent p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center bg-cyan/10 text-cyan"
                    style={{ clipPath: "var(--bevel-sm)" }}
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-5 w-5"
                    >
                      <rect x="4" y="10" width="16" height="10" rx="1.5" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="M12 14v2.5" />
                    </svg>
                  </span>

                  <div className="min-w-0">
                    <p className="eyebrow">Fiche verrouillée</p>
                    <h2 className="display mt-2 text-2xl sm:text-3xl">
                      Obtiens la carte {card.name}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                      Obtiens la carte {card.name} dans un booster pour débloquer sa fiche
                      complète : statistiques, rareté et détails de collection.
                    </p>

                    <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                      Chance par booster{" "}
                      <span className="font-mono text-cyan">
                        {bestChance ? formatChance(bestChance.chance) : "—"}
                      </span>
                      {bestChance && (
                        <span className="text-white/25"> · {bestChance.name}</span>
                      )}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={bestChance ? `/boosters?pack=${bestChance.slug}` : "/boosters"}
                        className="btn btn-primary"
                      >
                        Ouvrir un booster
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2" aria-hidden>
                  <div className="h-2.5 w-[92%] bg-white/[0.07]" />
                  <div className="h-2.5 w-[84%] bg-white/[0.06]" />
                  <div className="h-2.5 w-[62%] bg-white/[0.06]" />
                  <div className="mt-4 h-16 w-full border border-white/[0.05] bg-white/[0.03]" />
                  <div className="h-2.5 w-[76%] bg-white/[0.05]" />
                  <div className="h-2.5 w-[55%] bg-white/[0.05]" />
                </div>
              </section>

            </>
          )}
        </div>

        {/* ————— Colonne de droite ————— */}
        <aside className="space-y-4">
          <div className="panel p-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-white/35">
              <span>Aperçu</span>
              <span className="font-mono">#{number}</span>
            </div>

            <div className="relative mt-2">
              <div className={owned ? "" : "opacity-45 grayscale"}>
                <CardFace
                  card={card}
                  size="lg"
                  className="aspect-[3/4] w-full"
                  variant={owned ? variant : "normal"}
                />
              </div>
              {!owned && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span
                    className="display grid h-20 w-20 place-items-center bg-black/75 text-4xl text-white/75"
                    style={{ clipPath: "var(--bevel-sm)" }}
                  >
                    ?
                  </span>
                </div>
              )}
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-white/35">
              {owned
                ? "Inclinaison et holo actives au survol."
                : "Aperçu masqué : la carte n'est pas encore dans ta collection."}
            </p>

            {portrait && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-white/25">
                Visuel :{" "}
                {portrait.page ? (
                  <a
                    href={portrait.page}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-2 transition hover:text-white/50"
                  >
                    {attributionLabel(portrait)}
                  </a>
                ) : (
                  <span>{attributionLabel(portrait)}</span>
                )}{" "}
                via {sourceLabel(portrait)}
                {portrait.license ? ` · ${portrait.license}` : ""}
              </p>
            )}
          </div>

          <div className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip px-2.5 py-1 text-[11px] font-semibold ${rarity.badge}`}>
                {rarity.short}
              </span>
              <span className="text-xs text-white/50">{rarity.label}</span>
              <span
                className={`ml-auto text-[11px] ${owned ? "text-cyan" : "text-white/40"}`}
              >
                {owned ? `Possédée ×${quantity}` : "Non possédée"}
              </span>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-white/40">
              Chance par booster{" "}
              <span className="font-mono text-white/70">
                {bestChance ? formatChance(bestChance.chance) : "—"}
              </span>
            </p>
          </div>

          <div className="panel p-4">
            <p className="eyebrow">Cote</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-white">
              {market.median30 === null ? "—" : `◆ ${market.median30}`}
            </p>
            <p className="text-[11px] text-white/40">
              {market.median30 === null ? "Aucune vente récente" : "Médiane 30 jours"}
            </p>

            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px]">
              <div>
                <dt className="text-white/35">Offres</dt>
                <dd className="font-mono text-sm text-white/75">{market.offers}</dd>
              </div>
              <div>
                <dt className="text-white/35">Plus bas</dt>
                <dd className="font-mono text-sm text-white/75">
                  {market.lowest === null ? "—" : `◆ ${market.lowest}`}
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Ordres</dt>
                <dd className="font-mono text-sm text-white/75">
                  {orderBook.normal.count + orderBook.holo.count}
                </dd>
              </div>
              <div>
                <dt className="text-white/35">Meilleur ordre</dt>
                <dd className="font-mono text-sm text-white/75">
                  {orderBook.normal.best === null ? "—" : `◆ ${orderBook.normal.best}`}
                </dd>
              </div>
            </dl>
          </div>

          {/* Annonce dans L'Agora : doublon à proposer, ou carte à chercher. */}
          <CardAnnounce
            cardId={card.id}
            cardName={card.name}
            canOffer={quantity >= 2}
            canSeek={!owned || wishlisted}
          />

          <CardMarketActions
            cardId={card.id}
            cardName={card.name}
            wishlisted={wishlisted}
            cheapest={market.cheapest}
            pixels={profile.pixels}
            orderBook={orderBook}
          />

          <div className="panel p-4">
            <dl className="divide-y divide-white/5 text-xs">
              {wishlistCount !== null && (
                <InfoRow label="Envies">{wishlistCount} joueurs</InfoRow>
              )}
              <InfoRow label="Univers">{universe}</InfoRow>
              <InfoRow label="Numéro">
                #{number} / {catalogSize()}
              </InfoRow>
              <InfoRow label="POW">
                <span className="text-cyan">{stats.power}</span>
              </InfoRow>
              <InfoRow label="AURA">{stats.aura}</InfoRow>
              <InfoRow label="Rareté">{rarity.label}</InfoRow>
            </dl>
          </div>

          <div className="panel p-4">
            <h2 className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              Chance par booster
            </h2>
            {chances.length === 0 ? (
              <p className="mt-2 text-xs text-white/35">Chance indisponible pour le moment.</p>
            ) : (
              <ul className="mt-2 divide-y divide-white/5">
                {chances.map((chance) => (
                  <li
                    key={chance.slug}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-xs"
                    title={`${chance.cards} cartes par paquet`}
                  >
                    <span className="truncate text-white/55">{chance.name}</span>
                    <span className="shrink-0 font-mono text-cyan">
                      {formatChance(chance.chance)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/boosters"
              className="mt-3 inline-flex text-[11px] text-white/40 transition hover:text-cyan"
            >
              Voir la boutique →
            </Link>
          </div>
        </aside>
      </div>

      {/* ————— Cote de la carte ————— */}
      <section id="cote" className="mt-12 scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Marché</span>
            <h2 className="display mt-2 text-3xl">Cote de la carte</h2>
            <span className="title-rule" aria-hidden />
          </div>
          <Link href={`/marche?carte=${card.id}`} className="btn btn-outline btn-sm">
            Voir les annonces →
          </Link>
        </div>

        {market.recent.length === 0 ? (
          <div className="panel mt-5 px-6 py-10 text-center">
            <p className="display text-lg text-white/70">Aucune vente pour l&apos;instant</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/40">
              La cote de {card.name} apparaîtra dès la première vente entre joueurs. Les annonces
              actives restent visibles sur le marché.
            </p>
            <Link href={`/marche?carte=${card.id}`} className="btn btn-outline btn-sm mt-4">
              Voir les annonces
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Médiane 7 jours"
                value={market.median7 === null ? "—" : `◆ ${market.median7}`}
                hint="Copies normales"
              />
              <Metric
                label="Médiane 30 jours"
                value={market.median30 === null ? "—" : `◆ ${market.median30}`}
                hint="Copies normales"
              />
              <Metric label="Ventes 30 jours" value={market.sales30} hint="Annonces vendues" />
            </div>

            <CardPriceChart points={market.points} today={today} />

            <details className="panel mt-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <span className="display text-sm tracking-[0.16em] text-white/60">
                  Dernières ventes
                </span>
                <span className="font-mono text-[11px] text-white/35">
                  {salesHistory.total}
                </span>
              </summary>
              <div className="border-t border-white/10 px-4 py-2">
                <CardSalesHistory
                  cardId={card.id}
                  initial={salesHistory.sales}
                  total={salesHistory.total}
                />
              </div>
            </details>
          </>
        )}
      </section>

      {/* ————— Autres persos de la franchise ————— */}
      {sameUniverse.length > 0 && (
        <UniverseCards
          cardId={card.id}
          universe={universe}
          total={sameUniverse.length}
          initial={sameUniverse.slice(0, 6).map((other) => ({
            card: other,
            owned: ownedUniverse.has(other.id),
          }))}
        />
      )}
    </div>
  );
}

function StatBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cyan" | "white";
}) {
  return (
    <div className="bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          {label}
        </span>
        <span
          className={`font-mono text-2xl font-semibold ${tone === "cyan" ? "text-cyan" : "text-white/85"}`}
        >
          {value}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
        <div
          className={`h-full ${tone === "cyan" ? "bg-cyan" : "bg-white/60"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/** Lien d'ancre de la barre de sections. */
function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="chip px-2.5 py-1 text-[11px] text-white/55 transition hover:text-white"
    >
      {children}
    </a>
  );
}

/** Titre numéroté d'une section (« 02 — BIOGRAPHIE » + grand titre). */
function SectionHeading({
  index,
  label,
  title,
}: {
  index: number;
  label: string;
  title?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/70">
        {String(index).padStart(2, "0")} — {label}
      </p>
      <h2 className="display mt-1 text-[clamp(1.7rem,4vw,2.4rem)] text-white">
        {title ?? label}
      </h2>
      <span className="title-rule" aria-hidden />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-white/35">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right font-mono text-[11px] text-white/75">
        {children}
      </dd>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="panel p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-white/90">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-white/30">{hint}</p>}
    </div>
  );
}
