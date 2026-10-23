import Link from "next/link";
import { CARDS } from "@/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  CARDS_PER_BOOSTER,
  RARITY,
  RARITY_ORDER,
} from "@/lib/game";

export const metadata = { title: "Règles — TCVG" };

export default function RulesPage() {
  const cooldownMinutes = Math.round(BOOSTER_COOLDOWN_MS / 60000);

  return (
    <article>
      <span className="eyebrow">Règles</span>
      <h1 className="display mt-2 text-4xl">Comment ça marche</h1>
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Tout se joue avec des boosters gratuits : pas d&apos;achat, pas de pub, pas de monnaie
        payante. Voici les mécaniques exactes du site, telles qu&apos;elles tournent aujourd&apos;hui.
      </p>

      <Section title="Le but">
        Réunir les {CARDS.length} personnages du catalogue dans une seule collection, du Commun au
        Mythique. Chaque carte est unique dans l&apos;album : la première fois qu&apos;elle tombe,
        elle rejoint ta collection pour de bon.
      </Section>

      <Section title="Ouvrir un booster">
        <ul className="list-inside list-disc space-y-1.5">
          <li>Un booster toutes les {cooldownMinutes} minutes, et {CARDS_PER_BOOSTER} cartes par booster.</li>
          <li>
            Les boosters s&apos;accumulent jusqu&apos;à {BOOSTER_STOCK_MAX}. Au-delà, le temps
            s&apos;arrête : ouvre avant de quitter le site pour ne pas perdre de stock.
          </li>
          <li>
            Le tirage et le décompte sont calculés côté serveur : recharger la page ou changer
            d&apos;appareil ne donne pas de booster supplémentaire.
          </li>
        </ul>
      </Section>

      <Section title="Les raretés">
        <p>
          Chaque carte a une rareté fixe. Dans un booster, la rareté est tirée au sort avec les
          poids suivants :
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {RARITY_ORDER.map((key) => {
            const info = RARITY[key];
            const count = CARDS.filter((card) => card.rarity === key).length;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                    {info.short}
                  </span>
                  <span className={`text-sm ${info.text}`}>{info.label}</span>
                </span>
                <span className="font-mono text-[11px] text-white/40">
                  {count} cartes · {(info.weight / 10).toFixed(1)} %
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-white/35">
          Le pourcentage est la chance qu&apos;une carte tirée soit de cette rareté, pas la chance
          d&apos;obtenir un personnage précis.
        </p>
      </Section>

      <Section title="Les doublons">
        Un booster peut redonner une carte déjà possédée. Le doublon ne crée pas de seconde entrée
        dans l&apos;album : il augmente la quantité de cette carte dans ta collection et compte dans
        ton total. Il reste visible dans ta collection, avec le nombre d&apos;exemplaires.
      </Section>

      <Section title="Profil, avatar et cadres">
        Tu peux choisir n&apos;importe quelle carte possédée comme avatar, et débloquer des cadres
        en progressant (nombre de cartes, légendaires, mythiques). Le pseudo se change depuis la page
        Profil.
      </Section>

      <Section title="Pixels et marché">
        Une monnaie interne, les <strong className="text-white/80">Pixels</strong>, est en
        préparation : elle se gagnera uniquement en jouant (bonus de connexion quotidien, recyclage
        des doublons) et servira aux boosters thématiques et aux échanges entre joueurs. Aucun achat
        avec de l&apos;argent réel n&apos;est prévu, ni aujourd&apos;hui ni ensuite.
      </Section>

      <p className="mt-8 text-xs text-white/35">
        Une règle te paraît floue ou injuste ?{" "}
        <Link href="/avis-et-bugs" className="text-acid underline-offset-4 hover:underline">
          Signale-le
        </Link>
        .
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-white/10 pt-6">
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-white/55">{children}</div>
    </section>
  );
}
