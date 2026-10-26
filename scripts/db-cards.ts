/**
 * Synchronise src/lib/cards.ts → public.cards (+ public.franchises).
 *
 * Le catalogue reste la source de vérité dans le code ; la table en base sert
 * aux règles qui doivent s'appliquer côté serveur (rareté d'une carte possédée,
 * unicité des personnages, intégrité des annonces du marché).
 *
 * Une carte absente de `CARDS` est supprimée de la base, avec tout ce qui la
 * cite (collections comprises) : le jeu est en développement, aucune donnée
 * n'est conservée pour une carte retirée du catalogue.
 *
 * Prérequis : la migration 005 (franchises + franchise_id) doit être appliquée.
 *
 * Usage : npm run db:cards
 */

import { CARDS, UNIVERSES } from "../src/lib/cards";
import { cardStats } from "../src/lib/stats";
import { openRunner } from "./lib/db-runner";

/** Échappe une valeur pour l'inclure dans un littéral SQL. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  // Doublons côté code : on refuse de synchroniser un catalogue incohérent.
  const seen = new Map<string, string>();
  for (const card of CARDS) {
    const key = `${card.universe}::${card.name.trim().toLowerCase()}`;
    if (seen.has(key)) {
      throw new Error(`Personnage en double dans le catalogue : ${card.name} (${card.universe})`);
    }
    seen.set(key, card.id);
  }

  const franchises = Object.entries(UNIVERSES)
    .map(([slug, universe]) => `(${quote(slug)}, ${quote(universe.label)})`)
    .join(",\n  ");

  // Garde-fou : un catalogue anormalement court (import cassé, fichier tronqué)
  // effacerait des centaines de cartes. On refuse la synchronisation.
  if (CARDS.length < 100) {
    throw new Error(`catalogue suspicieusement court (${CARDS.length} cartes) : synchronisation refusée`);
  }

  const values = CARDS.map((card, index) => {
    const number = index + 1;
    const franchise = `(select id from public.franchises where slug = ${quote(card.universe)})`;
    // La qualité est dérivée des stats du code : la base ne fait que la
    // recopier, pour que `leaderboard()` puisse additionner sans importer
    // le barème en SQL.
    const quality = cardStats(card).quality;
    return `(${quote(card.id)}, ${quote(card.name)}, ${quote(card.universe)}, ${quote(card.rarity)}, ${number}, ${quality}, ${franchise}, true, null)`;
  }).join(",\n  ");

  const ids = CARDS.map((card) => quote(card.id)).join(", ");

  const sql = `
insert into public.franchises (slug, name)
values
  ${franchises}
on conflict (slug) do update set name = excluded.name;

insert into public.cards (id, name, universe, rarity, number, quality, franchise_id, active, retired_reason)
values
  ${values}
on conflict (id) do update
  set name = excluded.name,
      universe = excluded.universe,
      rarity = excluded.rarity,
      number = excluded.number,
      quality = excluded.quality,
      franchise_id = excluded.franchise_id,
      active = true,
      retired_at = null,
      retired_reason = null,
      updated_at = now();

-- Une carte sortie du catalogue est supprimée pour de bon : ni fiche, ni copie,
-- ni annonce. collection et market_audit n'ont pas de clé étrangère vers cards
-- (la migration 040 en ajoute une pour la collection) : on nettoie donc les
-- deux à la main, le reste tombe en cascade.
delete from public.collection
 where card_id not in (${ids});

delete from public.market_audit
 where card_id is not null and card_id not in (${ids});

delete from public.cards
 where id not in (${ids});
`;

  console.log(`→ ${CARDS.length} cartes et ${Object.keys(UNIVERSES).length} franchises à synchroniser`);
  const runner = await openRunner();
  console.log(`→ connecté via ${runner.label}`);

  try {
    await runner.query(sql);

    const [{ total }] = (await runner.query(`select count(*)::int as total from public.cards`)) as {
      total: number;
    }[];
    console.log(`✓ public.cards : ${total} lignes`);

    const duplicates = await runner.query(
      `select universe, lower(btrim(name)) as character, count(*)::int as total
         from public.cards
        group by 1, 2 having count(*) > 1`,
    );
    if (duplicates.length > 0) {
      throw new Error(`Personnages en double en base : ${JSON.stringify(duplicates)}`);
    }
    console.log("✓ aucun personnage en double");

    const withoutFranchise = await runner.query(
      `select count(*)::int as total from public.cards where franchise_id is null`,
    );
    console.log(`  cartes sans franchise : ${withoutFranchise[0]?.total ?? "?"}`);

    const byRarity = await runner.query(
      `select rarity, count(*)::int as total from public.cards group by 1 order by 1`,
    );
    console.log(`  par rareté : ${byRarity.map((row) => `${row.rarity}=${row.total}`).join(" · ")}`);

    // Une carte active sans qualité (valeur par défaut) casserait le
    // classement sans bruit : on refuse la synchronisation incomplète.
    const [missingQuality] = (await runner.query(
      `select count(*)::int as total from public.cards where active and quality = 0`,
    )) as { total: number }[];
    if (missingQuality.total > 0) {
      throw new Error(`${missingQuality.total} carte(s) active(s) sans qualité en base`);
    }
    console.log("✓ qualité renseignée pour toutes les cartes actives");
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
