"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buyBooster } from "@/app/actions";
import { BoosterReveal, type RevealItem } from "@/components/booster-reveal";
import { getCard } from "@/lib/cards";
import type { BoosterOffer } from "@/lib/data";
import { RARITY, RARITY_ORDER } from "@/lib/game";

function offerImage(offer: BoosterOffer): string {
  if (offer.slug === "mix") return "/booster/mix.jpg";
  return `/booster/${offer.slug.replace(/^genre-/, "")}.jpg`;
}

export function BoosterShop({
  offers,
  initialPixels,
}: {
  offers: BoosterOffer[];
  initialPixels: number;
}) {
  const router = useRouter();
  const [pixels, setPixels] = useState(initialPixels);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ name: string; items: RevealItem[] } | null>(null);

  async function buy(offer: BoosterOffer) {
    if (buying || !offer.available || pixels < offer.pricePixels) return;

    setBuying(offer.slug);
    setError(null);

    const [result] = await Promise.all([
      buyBooster(offer.slug),
      new Promise((resolve) => setTimeout(resolve, 450)),
    ]);

    if (result.status === "ok") {
      const items: RevealItem[] = [];
      for (const card of result.cards) {
        const found = getCard(card.id);
        if (found) items.push({ card: found, holo: card.holo, isNew: card.isNew });
      }
      setPixels(result.pixels);
      setReveal({ name: offer.name, items });
      router.refresh();
    } else if (result.status === "insufficient") {
      setPixels(result.pixels);
      setError(
        `Solde insuffisant : il te manque ${result.price - result.pixels} Pixels. Ouvre des boosters gratuits et reviens demain pour le bonus.`,
      );
    } else {
      setError(result.message);
    }

    setBuying(null);
  }

  const mix = offers.find((offer) => offer.slug === "mix" && offer.available) ?? null;
  const others = offers.filter((offer) => offer !== mix);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Boutique</span>
          <h2 className="display mt-2 text-2xl">Boosters en Pixels</h2>
          <p className="mt-1 text-sm text-white/50">
            Paiement à l&apos;ouverture, tirage côté serveur. Solde :{" "}
            <span className="font-semibold text-acid tabular-nums">◆ {pixels}</span>
          </p>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-white/35">
          Les Pixels ne s&apos;achètent pas : bonus quotidien et recyclage des doublons uniquement.
        </p>
      </div>

      {reveal && (
        <div className="mt-5">
          <BoosterReveal
            title={reveal.name}
            subtitle={`${reveal.items.length} carte${reveal.items.length > 1 ? "s" : ""}`}
            items={reveal.items}
            onClose={() => setReveal(null)}
            closeLabel="Fermer"
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      {offers.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/45">
          La boutique n&apos;est pas encore disponible.
        </p>
      ) : (
        <>
          {mix && (
            <article className="mt-5 overflow-hidden rounded-3xl border border-acid/30 bg-gradient-to-br from-acid/[0.08] via-white/[0.03] to-transparent p-4 sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative mx-auto flex w-28 shrink-0 justify-center sm:mx-0 sm:w-36">
                  <Image
                    src={offerImage(mix)}
                    alt={`Visuel du ${mix.name}`}
                    width={520}
                    height={760}
                    unoptimized
                    className="h-48 w-auto rounded-xl object-contain sm:h-56"
                  />
                  <span className="absolute -top-2 left-0 rounded-full bg-acid px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink shadow-lg">
                    Pack vitrine
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="display text-2xl">{mix.name}</h3>
                    <span className="rounded-full border border-acid/30 bg-acid/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-acid">
                      Toutes raretés
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/50">
                    {mix.cardsCount} cartes · tout le catalogue · le pack d&apos;entrée pour
                    découvrir toutes les franchises.
                  </p>

                  <Rates rates={mix.rates} />
                </div>

                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:w-48">
                  <span className="rounded-full border border-acid/30 bg-acid/10 px-3 py-1 text-center font-mono text-sm font-semibold text-acid">
                    ◆ {mix.pricePixels}
                  </span>
                  <button
                    type="button"
                    onClick={() => buy(mix)}
                    disabled={buying === mix.slug || pixels < mix.pricePixels}
                    className="w-full rounded-full bg-acid px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                  >
                    {buying === mix.slug
                      ? "Ouverture…"
                      : pixels < mix.pricePixels
                        ? `Il manque ${mix.pricePixels - pixels} Pixels`
                        : "Ouvrir le pack vitrine"}
                  </button>
                  <p className="text-center text-[10px] text-white/30">
                    Le Mix reste le booster à ouvrir en premier.
                  </p>
                </div>
              </div>
            </article>
          )}

          {others.length > 0 && (
            <>
              <div className="mt-8 flex items-end justify-between gap-2">
                <h3 className="display text-lg">Boosters par thème</h3>
                <p className="text-[11px] text-white/35">5 cartes · un genre à la fois</p>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((offer) => (
                  <OfferCard
                    key={offer.slug}
                    offer={offer}
                    pixels={pixels}
                    buying={buying === offer.slug}
                    onBuy={() => buy(offer)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

function OfferCard({
  offer,
  pixels,
  buying,
  onBuy,
}: {
  offer: BoosterOffer;
  pixels: number;
  buying: boolean;
  onBuy: () => void;
}) {
  const short = pixels < offer.pricePixels;

  return (
    <article
      className={`flex flex-col rounded-2xl border p-3 ${
        offer.available
          ? "border-white/10 bg-white/[0.03]"
          : "border-white/5 bg-white/[0.01] opacity-60"
      }`}
    >
      <div className="relative mb-3 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-black/25">
        <Image
          src={offerImage(offer)}
          alt={`Visuel du ${offer.name}`}
          width={520}
          height={760}
          unoptimized
          className={`h-full w-auto object-contain ${offer.available ? "" : "grayscale opacity-60"}`}
        />
        <span className="absolute bottom-2 left-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur">
          {offer.genre ?? "Tout le catalogue"}
        </span>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-white/90">{offer.name}</h4>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/35">
            {offer.cardsCount} cartes · {offer.genre ? `${offer.poolSize} personnages` : "tout le catalogue"}
          </p>
        </div>
        {offer.available && (
          <span className="shrink-0 rounded-full border border-acid/30 bg-acid/10 px-2 py-0.5 font-mono text-xs font-semibold text-acid">
            ◆ {offer.pricePixels}
          </span>
        )}
      </div>

      {offer.available ? (
        <>
          <Rates rates={offer.rates} compact />
          <button
            type="button"
            onClick={onBuy}
            disabled={buying || short}
            className="mt-3 w-full rounded-full bg-acid px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
          >
            {buying
              ? "Ouverture…"
              : short
                ? `Il manque ${offer.pricePixels - pixels} Pixels`
                : "Acheter et ouvrir"}
          </button>
        </>
      ) : (
        <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[11px] text-white/40">
          Bientôt — {offer.unavailableReason}
        </p>
      )}
    </article>
  );
}

function Rates({ rates, compact = false }: { rates: Record<string, number>; compact?: boolean }) {
  const total = Object.values(rates).reduce((sum, weight) => sum + weight, 0);

  return (
    <ul className={`grid grid-cols-5 gap-1 text-center ${compact ? "mt-3" : "mt-4 max-w-md"}`}>
      {RARITY_ORDER.map((key) => {
        const weight = rates[key] ?? 0;
        const info = RARITY[key];
        return (
          <li key={key} className="rounded-lg bg-black/25 px-1 py-1">
            <span className={`block text-[9px] font-bold ${info.text}`}>{info.short}</span>
            <span className="block font-mono text-[10px] text-white/45">
              {total > 0 ? ((weight / total) * 100).toFixed(1) : "0"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
