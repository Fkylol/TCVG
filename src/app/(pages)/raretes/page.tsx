import Link from "next/link";

import { CATALOG_SIZE } from "@/lib/cards";
import type { Rarity } from "@/lib/cards";
import { RARITY_META } from "@/lib/rarity";
import {
  FRANCHISE_CAPS,
  POPULARITY_WEIGHTS,
  RARITY_ORDER,
  RARITY_SHARES,
} from "@/lib/rarity-distribution.config";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Raretés — TCVG" };

type Counts = Record<string, number>;

/**
 * Page publique d'explication des raretés.
 *
 * Elle répond à la seule question qui compte pour un joueur : pourquoi telle
 * carte est-elle Mythique et pas celle d'à côté ? Les chiffres affichés sont
 * lus en base (effectifs réels), jamais recopiés à la main.
 */
export default async function RarityPage() {
  const supabase = await createClient();

  const [{ data: cards }, { data: config }] = await Promise.all([
    supabase.from("cards").select("rarity").eq("active", true),
    supabase.from("game_config").select("value").eq("key", "rarity_update").maybeSingle(),
  ]);

  const counts: Counts = {};
  for (const row of (cards ?? []) as { rarity: string }[]) {
    counts[row.rarity] = (counts[row.rarity] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const update = (config?.value ?? null) as { applied_at?: string; version?: number; changed?: number } | null;
  const appliedAt = update?.applied_at
    ? new Date(update.applied_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <article>
      <span className="eyebrow">Raretés</span>
      <h1 className="display mt-2 text-4xl">D&apos;où vient la rareté</h1>
      <span className="title-rule" aria-hidden />
      <p className="mt-3 text-sm leading-relaxed text-white/55">
        Une carte est d&apos;autant plus rare que son personnage est populaire sur
        Wikipédia. Ce n&apos;est pas un choix éditorial, ni un tirage au sort : c&apos;est un
        classement calculé, qu&apos;on peut vérifier ligne par ligne.
      </p>

      {!appliedAt && (
        <p className="mt-4 border-l-2 border-white/20 pl-3 text-xs leading-relaxed text-white/40">
          Ce classement n&apos;est pas encore appliqué : les paliers actuels sont ceux du
          catalogue d&apos;origine. La page décrit la méthode et les effectifs visés, pas un
          changement déjà en place.
        </p>
      )}

      <Section title="La popularité, mesurée et non devinée">
        Pour chaque personnage, on cherche son entité sur{" "}
        <Ext href="https://www.wikidata.org">Wikidata</Ext>, puis on lit sur{" "}
        <Ext href="https://www.mediawiki.org/wiki/API:Pageview_info">l&apos;API de pages vues de
        Wikimedia</Ext> les visites mensuelles de son article dans six langues (anglais, français,
        japonais, espagnol, allemand, portugais), sur les douze derniers mois complets. On ne garde
        que le trafic humain, jamais les robots.
      </Section>

      <Section title="Du chiffre au score">
        Deux mesures entrent en jeu : le total des visites médianes, et le nombre de langues où le
        personnage a un article. Chacune est transformée en rang (de 0 à 100 % du catalogue), puis
        combinée à {Math.round(POPULARITY_WEIGHTS.pageviews * 100)} % /{" "}
        {Math.round(POPULARITY_WEIGHTS.languages * 100)} %. Le résultat est un score de 0 à 100,
        propre au catalogue de TCVG.
      </Section>

      <Section title="Du score à la rareté">
        Les personnages sont classés par score, puis répartis en six paliers selon les parts
        ci-dessous. Aucune franchise ne peut concentrer les paliers hauts : au maximum{" "}
        {FRANCHISE_CAPS.L} Mythiques et {FRANCHISE_CAPS.UR} Légendaires par franchise. Une carte
        bloquée par ce plafond descend d&apos;un palier, et sa place revient au personnage suivant du
        classement.
        <div className="mt-4 overflow-hidden border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.16em] text-white/40">
              <tr>
                <th className="px-3 py-2 font-semibold">Rareté</th>
                <th className="px-3 py-2 text-right font-semibold">Part visée</th>
                <th className="px-3 py-2 text-right font-semibold">Cartes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {RARITY_ORDER.map((rarity) => (
                <tr key={rarity}>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center gap-2 font-semibold"
                      style={{ color: `var(--${RARITY_META[rarity as Rarity].token})` }}
                    >
                      {RARITY_META[rarity as Rarity].name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-white/60">
                    {Math.round(RARITY_SHARES[rarity as Rarity] * 100)} %
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-white/80">{counts[rarity] ?? 0}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-white/[0.02]">
              <tr>
                <td className="px-3 py-2 text-white/50">Total actif</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono text-white/80">{total || CATALOG_SIZE}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <Section title="Quand une donnée manque">
        Un personnage de jeu confidentiel n&apos;a souvent aucun article : il n&apos;y a alors rien à
        mesurer, et on ne l&apos;invente pas. Sa popularité vaut 30 % de celle de sa franchise ; si
        la franchise elle-même n&apos;a pas d&apos;article, le score est zéro et la carte rejoint les
        Communes. Aucun chiffre n&apos;est extrapolé à partir d&apos;autre chose.
      </Section>

      <Section title="Ce que ça change, ce que ça ne change pas">
        La rareté décide des chances de tirage et de la valeur de recyclage ; elle ne modifie pas la
        collection. Une carte déjà obtenue le reste, même si son palier change. L&apos;ancienne
        rareté de chaque carte est conservée en base, et la mise à jour complète peut être annulée
        d&apos;un bloc par l&apos;administrateur.
        {appliedAt && (
          <p className="mt-3">
            Dernière mise à jour : <strong className="text-white/80">{appliedAt}</strong>
            {typeof update?.changed === "number" && update.changed > 0 && (
              <> — {update.changed} cartes ont changé de palier.</>
            )}
          </p>
        )}
      </Section>

      <Section title="Sources">
        Les données brutes viennent de Wikidata (identifiants et liens entre entités) et de
        l&apos;API de pages vues de Wikimedia, publiées sous licence libre. Aucun texte d&apos;article
        n&apos;est copié : seuls des identifiants, des titres et des nombres sont stockés. Les
        derniers chiffres sont visibles sur la fiche de chaque carte.
      </Section>

      <p className="mt-9 text-[11px] text-white/30">
        Les raretés ne se recalculent jamais toutes seules : chaque mise à jour est un calcul
        manuel, vérifié avant application. Voir aussi{" "}
        <Link href="/regles" className="text-white/50 underline-offset-4 hover:text-acid hover:underline">
          les règles du jeu
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

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-acid underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}
