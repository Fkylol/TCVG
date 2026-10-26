/**
 * Retour arrière du calcul de rareté.
 *
 *   npm run rarity:rollback            (affiche ce qui serait restauré)
 *   npm run rarity:rollback -- --yes   (applique)
 *
 * Une seule transaction : `rarity` reprend `rarity_v1`, `rarity_v1` est effacé,
 * `rarity_version` revient à 0 et `rarity_locked` à faux. Le bandeau disparaît
 * et l'exécution est marquée annulée dans `rarity_runs`.
 *
 * Les annonces et ordres annulés par l'application ne sont pas réouverts : les
 * cartes et les Pixels ont déjà été rendus aux joueurs (voir DECISIONS.md).
 * L'historique des ventes n'a jamais été touché.
 */

import { openRunner } from "../lib/db-runner";

const YES = process.argv.includes("--yes");

const PREVIEW_SQL = `
  select
    (select count(*)::int from public.cards where rarity_v1 is not null) as cards,
    (select count(*)::int from public.cards where rarity_v1 is not null and rarity_v1 <> rarity) as changed,
    (select max(rarity_version) from public.cards) as version,
    (select max(rarity_version) from public.cards where rarity_v1 is not null) as applied_version
`;

export const ROLLBACK_SQL = `
do $$
declare
  v_version integer;
  v_cards integer;
  v_run bigint;
begin
  lock table public.cards in share row exclusive mode;

  select max(rarity_version) into v_version
    from public.cards
   where rarity_v1 is not null;

  update public.cards
     set rarity = rarity_v1,
         rarity_v1 = null,
         rarity_version = 0,
         rarity_locked = false
   where rarity_v1 is not null;

  get diagnostics v_cards = row_count;

  update public.rarity_runs
     set rolled_back_at = now()
   where rolled_back_at is null;

  delete from public.game_config where key = 'rarity_update';

  select max(id) into v_run from public.rarity_runs;

  raise notice 'rollback : % carte(s), version % , exécution %', v_cards, v_version, v_run;
end;
$$;
`;

async function main() {
  const runner = await openRunner();
  try {
    const [state] = await runner.query(PREVIEW_SQL);
    const cards = Number(state?.cards ?? 0);
    const changed = Number(state?.changed ?? 0);

    if (cards === 0) {
      console.log("• aucune rareté calculée en base : rien à annuler.");
      return;
    }
    console.log(
      `→ ${cards} carte(s) ont une rareté d'origine conservée, dont ${changed} différente(s) de la rareté calculée (version ${state?.applied_version}).`,
    );

    if (!YES) {
      console.log("  relance avec --yes pour restaurer : npm run rarity:rollback -- --yes");
      return;
    }

    await runner.query(ROLLBACK_SQL);

    const after = await runner.query(`
      select count(*)::int as with_v1,
             count(*) filter (where rarity_version <> 0)::int as versioned,
             count(*) filter (where rarity_locked)::int as locked
        from public.cards
    `);
    const distribution = await runner.query(
      "select rarity, count(*)::int as n from public.cards group by rarity order by rarity",
    );

    console.log("✓ raretés restaurées");
    console.log(`  rarity_v1 renseigné : ${after[0]?.with_v1} · version ≠ 0 : ${after[0]?.versioned} · verrouillées : ${after[0]?.locked}`);
    console.log(`  effectifs : ${distribution.map((row) => `${row.rarity}=${row.n}`).join(" ")}`);
    console.log("  bandeau retiré, exécution marquée annulée dans rarity_runs");
  } finally {
    await runner.close();
  }
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/popularity/rollback.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
