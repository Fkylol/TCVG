import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { CardFace } from "@/components/card-face";
import { CARDS } from "@/lib/cards";
import { BOOSTER_COOLDOWN_MS, CARDS_PER_BOOSTER, RARITY, RARITY_ORDER } from "@/lib/game";

const SHOWCASE = ["kratos", "mario", "sonic", "link", "samus", "kirby"]
  .map((id) => CARDS.find((card) => card.id === id))
  .filter((card): card is NonNullable<typeof card> => Boolean(card));

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:py-16">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-violet-200">
              Projet de fan · {CARDS.length} cartes
            </span>

            <h1 className="mt-5 text-4xl font-black leading-[1.05] sm:text-6xl">
              Le TCG des
              <span className="rarity-shine"> héros de jeux vidéo</span>.
            </h1>

            <p className="mt-5 max-w-xl text-lg text-white/65">
              Ouvre des boosters toutes les {Math.round(BOOSTER_COOLDOWN_MS / 60000)} minutes,
              collectionne Kratos, Mario, Spyro et tout le reste, et complète un album de{" "}
              {CARDS.length} personnages — du Commun au Mythique.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-violet-950 transition hover:bg-violet-100"
              >
                Créer mon compte — gratuit
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/80 transition hover:border-white/40 hover:text-white"
              >
                Se connecter
              </Link>
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

        <section className="mt-16 rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Les raretés</h2>
          <p className="mt-1 text-sm text-white/50">
            Chances d&apos;apparition par carte, dans un booster.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-5">
            {RARITY_ORDER.map((key) => {
              const info = RARITY[key];
              const count = CARDS.filter((card) => card.rarity === key).length;
              return (
                <li key={key} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                    {info.short}
                  </span>
                  <p className={`mt-2 text-sm font-semibold ${info.text}`}>{info.label}</p>
                  <p className="text-xs text-white/40">
                    {count} cartes · {(info.weight / 10).toFixed(1)} %
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="border-t border-white/10 px-4 py-8 text-center text-xs leading-relaxed text-white/35">
        <p>
          TCVG est un projet de fan, non officiel et non affilié à Nintendo, Sony, Microsoft, Sega,
          Square Enix, Capcom, Bandai Namco, Activision ou à leurs ayants droit.
        </p>
        <p className="mt-2">
          Tous les personnages et marques cités appartiennent à leurs propriétaires respectifs.
          Aucune illustration officielle n&apos;est utilisée ni hébergée.
        </p>
      </footer>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-200">
        {n}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-white/55">{text}</p>
    </div>
  );
}
