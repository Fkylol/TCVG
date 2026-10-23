import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardFace } from "@/components/card-face";
import { getCard, getCardNumber, getUniverseLabel } from "@/lib/cards";
import { ListingForm } from "@/components/listing-form";
import { RecycleButton } from "@/components/recycle-button";
import { requireSession } from "@/lib/auth";
import { getMarketQuote, getRecycleValues } from "@/lib/data";
import { CARDS, RARITY } from "@/lib/game";
import { getPortrait, sourceLabel } from "@/lib/portraits";
import { cardStats } from "@/lib/stats";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const card = getCard(id);
  return { title: card ? `${card.name} — TCVG` : "Carte introuvable — TCVG" };
}

export default async function CardPage({ params }: Params) {
  const { id } = await params;
  const card = getCard(id);
  if (!card) notFound();

  const { supabase, user } = await requireSession();
  const [{ data }, recycleValues, normalQuote, holoQuote] = await Promise.all([
    supabase
      .from("collection")
      .select("quantity, holo_quantity, first_obtained_at")
      .eq("user_id", user.id)
      .eq("card_id", card.id)
      .maybeSingle(),
    getRecycleValues(supabase),
    getMarketQuote(supabase, card.id, false),
    getMarketQuote(supabase, card.id, true),
  ]);

  const quantity = (data?.quantity as number | undefined) ?? 0;
  const holoQuantity = (data?.holo_quantity as number | null | undefined) ?? 0;
  const firstObtained = data?.first_obtained_at as string | undefined;
  const normalValue = recycleValues[card.rarity] ?? 0;
  const holoValue = normalValue * 3;
  const recyclableNormals = Math.max(0, quantity - holoQuantity - 1);
  const recyclableHolo = holoQuantity > 0 && quantity > 1;
  const canSellNormal = quantity - holoQuantity >= 2;
  const canSellHolo = holoQuantity > 0 && quantity > 1;
  const rarity = RARITY[card.rarity];
  const stats = cardStats(card);
  const portrait = getPortrait(card.id);
  const sameUniverse = CARDS.filter((c) => c.universe === card.universe && c.id !== card.id);

  return (
    <div>
      <Link href="/collection" className="text-sm text-white/45 transition hover:text-white">
        ← Retour à la collection
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          <CardFace card={card} size="lg" className="aspect-[3/4] w-full" />

          {portrait && (
            <p className="mt-3 text-[11px] leading-relaxed text-white/35">
              Visuel{" : "}
              <a
                href={portrait.page}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 transition hover:text-white/60"
              >
                {portrait.source === "fandom" ? portrait.wikiTitle : portrait.file || portrait.wikiTitle}
              </a>{" "}
              via {sourceLabel(portrait)}
              {portrait.credit ? ` — ${portrait.credit}` : ""}
              {portrait.license ? ` · ${portrait.license}` : ""}
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            {quantity > 0 ? (
              <>
                <p className="text-emerald-300">Dans ta collection</p>
                <p className="mt-1 text-white/60">
                  {quantity} exemplaire{quantity > 1 ? "s" : ""}
                  {holoQuantity > 0 && (
                    <>
                      {" · "}
                      <span className="font-semibold text-amber-300" title="Exemplaires holo">
                        ✦ {holoQuantity} holo
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
                      className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  )}
                </div>

                {recyclableNormals === 0 && !recyclableHolo && (
                  <p className="mt-2 text-[11px] text-white/35">
                    Il faut garder au moins un exemplaire : ouvre d&apos;autres boosters pour pouvoir
                    recycler un doublon.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-amber-300">Pas encore obtenu</p>
                <p className="mt-1 text-white/60">
                  Cette carte peut sortir dans n&apos;importe quel booster ({(rarity.weight / 10).toFixed(1)} %
                  par carte tirée).
                </p>
                <Link href="/boosters" className="mt-3 inline-block text-acid hover:underline">
                  Ouvrir un booster →
                </Link>
              </>
            )}
          </div>

          {quantity > 0 && (normalQuote || holoQuote) && (
            <ListingForm
              cardId={card.id}
              normal={normalQuote}
              holo={holoQuote}
              canSellNormal={canSellNormal}
              canSellHolo={canSellHolo}
            />
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rarity.badge}`}>
              {rarity.label}
            </span>
            <span className="text-sm text-white/50">{getUniverseLabel(card.universe)}</span>
            <span className="ml-auto font-mono text-xs text-white/35">
              N° {String(getCardNumber(card.id) ?? 0).padStart(2, "0")} / {CARDS.length}
            </span>
          </div>

          <h1 className="display mt-3 text-4xl">{card.name}</h1>
          <p className="mt-1 text-white/55">{card.tagline}</p>

          <blockquote className="mt-6 border-l-2 border-acid/50 pl-4 text-lg italic text-white/75">
            « {card.quote} »
          </blockquote>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatBar label="Puissance" value={stats.power} color="text-acid" bar="bg-acid" />
            <StatBar label="Aura" value={stats.aura} color="text-cyan" bar="bg-cyan" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Qualité</p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-2xl font-semibold">{stats.quality}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stats.grade.tone}`}>
                  {stats.grade.label}
                </span>
              </p>
            </div>
          </div>

          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            La rareté fixe les chances de tirage ({rarity.label}). La puissance, l&apos;aura et la
            qualité situent la carte dans cette rareté : elles comptent pour le score de collection,
            les cadres de profil et le futur mode duel.
          </p>

          <div className="mt-6 rounded-2xl border border-acid/20 bg-acid/[0.06] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-acid/70">Pouvoir</p>
            <p className="mt-1.5 font-medium">{card.power}</p>
          </div>

          <p className="mt-6 leading-relaxed text-white/65">{card.bio}</p>

          {sameUniverse.length > 0 && (
            <div className="mt-8">
              <h2 className="text-sm uppercase tracking-[0.18em] text-white/40">
                Autres cartes — {getUniverseLabel(card.universe)}
              </h2>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {sameUniverse.map((other) => (
                  <Link key={other.id} href={`/card/${other.id}`} className="transition hover:-translate-y-1">
                    <CardFace card={other} size="sm" className="aspect-[3/4]" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBar({
  label,
  value,
  color,
  bar,
}: {
  label: string;
  value: number;
  color: string;
  bar: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-white/40">{label}</span>
        <span className={`font-mono text-2xl font-semibold ${color}`}>{value}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
