import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CardFace } from "@/components/card-face";
import { getCard, getUniverseLabel } from "@/lib/cards";
import { requireSession } from "@/lib/auth";
import { CARDS, RARITY } from "@/lib/game";
import { filePageUrl, getPortrait } from "@/lib/portraits";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const card = getCard(id);
  return { title: card ? `${card.name} — TCVG` : "Carte introuvable — TCVG" };
}

const MAX_STAT = 9420;

export default async function CardPage({ params }: Params) {
  const { id } = await params;
  const card = getCard(id);
  if (!card) notFound();

  const { supabase, user } = await requireSession();
  const { data } = await supabase
    .from("collection")
    .select("quantity, first_obtained_at")
    .eq("user_id", user.id)
    .eq("card_id", card.id)
    .maybeSingle();

  const quantity = (data?.quantity as number | undefined) ?? 0;
  const firstObtained = data?.first_obtained_at as string | undefined;
  const rarity = RARITY[card.rarity];
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
                href={filePageUrl(portrait)}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 transition hover:text-white/60"
              >
                {portrait.file || portrait.wikiTitle}
              </a>{" "}
              via Wikipédia{portrait.credit ? ` — ${portrait.credit}` : ""}
              {portrait.license ? ` · ${portrait.license}` : ""}
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            {quantity > 0 ? (
              <>
                <p className="text-emerald-300">Dans ta collection</p>
                <p className="mt-1 text-white/60">
                  {quantity} exemplaire{quantity > 1 ? "s" : ""}
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
              </>
            ) : (
              <>
                <p className="text-amber-300">Pas encore obtenu</p>
                <p className="mt-1 text-white/60">
                  Cette carte peut sortir dans n&apos;importe quel booster ({(rarity.weight / 10).toFixed(1)} %
                  par carte tirée).
                </p>
                <Link href="/boosters" className="mt-3 inline-block text-violet-200 hover:underline">
                  Ouvrir un booster →
                </Link>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${rarity.badge}`}>
              {rarity.label}
            </span>
            <span className="text-sm text-white/50">{getUniverseLabel(card.universe)}</span>
          </div>

          <h1 className="mt-3 text-4xl font-black">{card.name}</h1>
          <p className="mt-1 text-white/55">{card.tagline}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Stat label="Attaque" value={card.atk} gradient="from-rose-400 to-orange-300" />
            <Stat label="Défense" value={card.def} gradient="from-sky-400 to-emerald-300" />
          </div>

          <blockquote className="mt-6 border-l-2 border-violet-400/50 pl-4 text-lg italic text-white/75">
            « {card.quote} »
          </blockquote>

          <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/[0.07] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-200/70">Pouvoir</p>
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

function Stat({ label, value, gradient }: { label: string; value: number; gradient: string }) {
  const percent = Math.min(100, Math.round((value / MAX_STAT) * 100));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-white/40">{label}</span>
        <span className="font-mono text-xl font-semibold">{value.toLocaleString("fr-FR")}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
