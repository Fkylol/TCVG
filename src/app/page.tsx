import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CardFace } from "@/components/card-face";
import { getSession } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { CARDS } from "@/lib/cards";
import { BOOSTER_COOLDOWN_MS, CARDS_PER_BOOSTER, RARITY, RARITY_ORDER } from "@/lib/game";

const SHOWCASE = ["kratos", "mario", "sonic", "link", "samus", "kirby"]
  .map((id) => CARDS.find((card) => card.id === id))
  .filter((card): card is NonNullable<typeof card> => Boolean(card));

export default async function Home() {
  // La landing est publique, mais elle doit refléter la session : sinon le header
  // affiche « Connexion » à un joueur connecté venu cliquer sur le logo.
  const session = await getSession();
  const profile = session ? await getProfile(session.supabase, session.user) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        username={profile?.username}
        avatarCardId={profile?.avatarCardId}
        frame={profile?.frame}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="eyebrow">
              Projet de fan · {CARDS.length} cartes
            </span>

            <h1 className="display mt-4 text-5xl sm:text-7xl">
              Le TCG des
              <span className="text-acid"> héros de jeux vidéo</span>.
            </h1>

            <p className="mt-5 max-w-xl text-lg text-white/65">
              Ouvre des boosters toutes les {Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes,
              collectionne Kratos, Mario, Spyro et tout le reste, et complète un album de{" "}
              {CARDS.length} personnages — du Commun au Mythique.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {profile ? (
                <>
                  <Link
                    href="/boosters"
                    className="rounded-full bg-acid px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110"
                  >
                    Continuer ma collection
                  </Link>
                  <Link
                    href="/collection"
                    className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Voir mes cartes
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-full bg-acid px-6 py-3 text-sm font-semibold text-ink transition hover:brightness-110"
                  >
                    Créer mon compte — gratuit
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
                  >
                    Se connecter
                  </Link>
                </>
              )}
            </div>

            <p className="mt-6 text-xs text-white/35">
              Pas de paiement, pas de pub, pas de hasard monétisé : uniquement des boosters gratuits.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {SHOWCASE.map((card, index) => (
              <div
                key={card.id}
                className="transition hover:-translate-y-1"
                style={{ transform: `rotate(${(index % 3 - 1) * 2}deg)` }}
              >
                <CardFace card={card} size="sm" className="aspect-[3/4]" />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
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

        <section
          id="raretes"
          className="mt-16 scroll-mt-20 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
            <div>
              <span className="eyebrow">Raretés</span>
              <h2 className="display mt-2 text-2xl sm:text-3xl">De commune à mythique</h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/45">
              Chances d&apos;apparition par carte, dans un booster.
            </p>
          </div>

          <ul className="mt-6 grid gap-3 sm:grid-cols-5">
            {RARITY_ORDER.map((key) => {
              const info = RARITY[key];
              const count = CARDS.filter((card) => card.rarity === key).length;
              return (
                <li
                  key={key}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4"
                >
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
                    {(info.weight / 10).toFixed(1)} %
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-acid/15 text-sm font-bold text-acid">
        {n}
      </span>
      <h3 className="display mt-3 text-base">{title}</h3>
      <p className="mt-1.5 text-sm text-white/55">{text}</p>
    </div>
  );
}
