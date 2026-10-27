import Link from "next/link";
import { catalogCards } from "@/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  CARDS_PER_BOOSTER,
  RARITY,
  RARITY_ORDER,
  formatPercent,
} from "@/lib/game";
import { QUALITY_GRADES, STAT_BANDS } from "@/lib/stats";

export const metadata = { title: "Règles — TCVG" };

export default function RulesPage() {
  const cooldownMinutes = Math.round(BOOSTER_COOLDOWN_MS / 60000);
  // Catalogue tel qu'il est jouable : les cartes supprimées en ligne sortent
  // des totaux, sans attendre un déploiement.
  const cards = catalogCards();

  return (
    <article>
      <span className="eyebrow">Règles</span>
      <h1 className="display mt-2 text-4xl">Comment ça marche</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Tout se joue avec des boosters gratuits : pas d&apos;achat, pas de pub, pas de monnaie
        payante. Voici les mécaniques exactes du site, telles qu&apos;elles tournent aujourd&apos;hui.
      </p>

      <Section title="Le but">
        Réunir les {cards.length} personnages du catalogue dans une seule collection, du Commun au
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
            const count = cards.filter((card) => card.rarity === key).length;
            return (
              <li
                key={key}
                className="flex items-center justify-between gap-3 border border-white/10 bg-black/25 px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${info.badge}`}>
                    {info.short}
                  </span>
                  <span className={`text-sm ${info.text}`}>{info.label}</span>
                </span>
                <span className="font-mono text-[11px] text-white/40">
                  {count} cartes · {formatPercent(info.weight / 1000)}
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

      <Section title="Puissance, aura et qualité">
        <p>
          La rareté fixe les chances de tirage. À l&apos;intérieur de chaque rareté, deux
          statistiques de 0 à 100 situent la carte :
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1.5">
          <li>
            <strong className="text-cyan">Puissance</strong> — son poids au combat. C&apos;est la base
            du score de collection et du futur mode duel.
          </li>
          <li>
            <strong className="text-cyan">Aura</strong> — son prestige de collection. Elle pèse dans
            le score global et dans le déblocage des cadres de profil.
          </li>
        </ul>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white/40">
            <span>Rareté</span>
            <span className="text-right">Puissance</span>
            <span className="text-right">Aura</span>
          </div>
          {RARITY_ORDER.map((key) => {
            const bands = STAT_BANDS[key];
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-white/5 px-3 py-2 text-sm"
              >
                <span className={RARITY[key].text}>{RARITY[key].label}</span>
                <span className="text-right font-mono text-xs text-white/55">
                  {bands.power.min}–{bands.power.min + bands.power.spread}
                </span>
                <span className="text-right font-mono text-xs text-white/55">
                  {bands.aura.min}–{bands.aura.min + bands.aura.spread}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-4">
          La <strong className="text-white/75">qualité</strong> résume les deux : 60 % de la
          puissance et 40 % de l&apos;aura, arrondis. Elle donne une note de{" "}
          {QUALITY_GRADES[0].label} à {QUALITY_GRADES[QUALITY_GRADES.length - 1].label}.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {QUALITY_GRADES.map((grade) => (
            <li key={grade.key} className={`chip px-2.5 py-1 text-[11px] font-semibold ${grade.tone}`}>
              {grade.label}
              <span className="ml-1 font-mono font-normal opacity-70">{grade.min}+</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-white/35">
          Les fourchettes se chevauchent volontairement : une Rare au sommet peut dépasser une
          Épique en bas de la sienne. Deux cartes de même rareté n&apos;ont donc pas forcément la
          même valeur.
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
        <Link href="/avis-et-bugs" className="text-cyan underline-offset-4 hover:underline">
          Signale-le
        </Link>
        .
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <span className="section-rule section-rule-tight" aria-hidden />
      <h2 className="display text-xl">{title}</h2>
      <div className="mt-2.5 text-sm leading-relaxed text-white/55">{children}</div>
    </section>
  );
}
