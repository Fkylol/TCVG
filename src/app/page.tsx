import Link from "next/link";
import { cookies } from "next/headers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CardFace } from "@/components/card-face";
import { getSession } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { REFERRAL_COOKIE } from "@/lib/referral/config";
import { previewReferralCode } from "@/lib/referral/service";
import { createClient } from "@/lib/supabase/server";
import { CARDS, CATALOG_SIZE } from "@/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  CARDS_PER_BOOSTER,
  RARITY,
  RARITY_ORDER,
  formatPercent,
} from "@/lib/game";

const SHOWCASE = ["kratos", "mario", "sonic", "link", "samus", "kirby"]
  .map((id) => CARDS.find((card) => card.id === id))
  .filter((card): card is NonNullable<typeof card> => Boolean(card));

export default async function Home() {
  // La landing est publique, mais elle doit refléter la session : sinon le header
  // affiche « Connexion » à un joueur connecté venu cliquer sur le logo.
  const session = await getSession();
  const profile = session ? await getProfile(session.supabase, session.user) : null;

  // Bandeau d'invitation : le cookie a été déposé par /invite/<code>. Il ne
  // s'affiche que pour un visiteur pas encore inscrit (un compte existant ne
  // peut plus être parrainé).
  const inviteCode = (await cookies()).get(REFERRAL_COOKIE)?.value;
  const invite =
    !profile && inviteCode
      ? await previewReferralCode(session?.supabase ?? (await createClient()), inviteCode)
      : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        username={profile?.username}
        avatarCardId={profile?.avatarCardId}
        frame={profile?.frame}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:py-16">
        {invite && (
          <div
            role="status"
            className="panel panel-accent mb-8 flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <p className="text-sm text-white/70">
              <span className="mr-2" aria-hidden>
                🎟️
              </span>
              <strong className="text-white">{invite.username}</strong> t&apos;invite sur TCVG —
              crée ton compte avec Discord pour rejoindre son parrainage.
            </p>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Rejoindre
            </Link>
          </div>
        )}

        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="eyebrow">
              Projet de fan · {CATALOG_SIZE} cartes
            </span>

            <h1 className="display mt-4 text-5xl sm:text-7xl">
              Le TCG des
              <span className="text-acid"> héros de jeux vidéo</span>.
            </h1>
            <span className="title-rule" aria-hidden />

            <p className="mt-5 max-w-xl text-lg text-white/65">
              Ouvre des boosters toutes les {Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes,
              collectionne Kratos, Mario, Spyro et tout le reste, et complète un album de{" "}
              {CATALOG_SIZE} personnages — du Commun au Mythique.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {profile ? (
                <>
                  <Link href="/boosters" className="btn btn-primary btn-lg">
                    Continuer ma collection
                  </Link>
                  <Link href="/collection" className="btn btn-outline btn-lg">
                    Voir mes cartes
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup" className="btn btn-primary btn-lg">
                    Créer mon compte — gratuit
                  </Link>
                  <Link href="/login" className="btn btn-outline btn-lg">
                    Se connecter
                  </Link>
                </>
              )}
            </div>

            <p className="mt-6 text-xs text-white/35">
              Pas de paiement, pas de pub, pas de hasard monétisé : uniquement des boosters gratuits.
            </p>
          </div>

          <div className="pack-glow grid grid-cols-3 gap-3">
            {SHOWCASE.map((card) => (
              <div key={card.id} className="transition hover:-translate-y-1">
                <CardFace card={card} size="sm" className="aspect-[3/4]" />
              </div>
            ))}
          </div>
        </section>

        <div className="section-rule" aria-hidden />

        <section className="grid gap-4 sm:grid-cols-3">
          <Step
            n="1"
            title={`Ouvre un booster (×${CARDS_PER_BOOSTER} cartes)`}
            text={`Un pack gratuit toutes les ${Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes. Chaque carte a sa propre rareté tirée au sort.`}
          />
          <Step
            n="2"
            title="Complète ta collection"
            text="Chaque personnage existe en un seul exemplaire unique dans l'album ; les doublons renforcent ton total."
          />
          <Step
            n="3"
            title="Explore les fiches"
            text="Stats, pouvoir, citation et bio pour chaque personnage : la carte est aussi une page wiki."
          />
        </section>

        <div className="section-rule" aria-hidden />

        <section id="raretes" className="panel panel-accent scroll-mt-20 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <div>
              <span className="eyebrow">Raretés</span>
              <h2 className="display mt-2 text-2xl sm:text-3xl">De commune à mythique</h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/45">
              Chances d&apos;apparition par carte, dans un booster.
            </p>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {RARITY_ORDER.map((key) => {
              const info = RARITY[key];
              const count = CARDS.filter(
                (card) => card.rarity === key && card.retired !== true,
              ).length;
              return (
                <li key={key} className="panel panel-deep relative overflow-hidden p-4">
                  {/* Filet de rareté : rappelle le liseré des cartes. */}
                  <span className={`absolute inset-x-0 top-0 h-0.5 ${info.bar}`} aria-hidden />
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                      {info.short}
                    </span>
                    <span className="font-mono text-[11px] whitespace-nowrap text-white/35">
                      {count} cartes
                    </span>
                  </div>
                  <p className={`display mt-3 text-base ${info.text}`}>{info.label}</p>
                  <p className="mt-1 font-mono text-xs text-white/45">
                    {formatPercent(info.weight / 1000)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="panel p-5">
      <span className="grid h-8 w-8 place-items-center bg-acid/15 font-mono text-sm font-semibold text-acid">
        {n}
      </span>
      <h3 className="display mt-3 text-base">{title}</h3>
      <p className="mt-1.5 text-sm text-white/55">{text}</p>
    </div>
  );
}
