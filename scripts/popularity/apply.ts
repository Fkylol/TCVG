/**
 * Étape 7 — application des raretés, en une seule transaction.
 *
 * Le script rejoue l'aperçu, relance les contrôles bloquants, exécute les
 * tests, puis envoie un unique bloc `do $$ … $$` : soit tout passe, soit rien
 * n'est modifié.
 *
 * Contenu de la transaction :
 *   • `rarity_v1` = rareté d'avant (première application uniquement) ;
 *   • `rarity` = nouvelle rareté, `rarity_version` incrémentée,
 *     `rarity_locked` = vrai ;
 *   • annonces et ordres d'achat dont le prix sort de la fourchette de la
 *     nouvelle rareté : annulés, cartes rendues, Pixels restitués, propriétaire
 *     notifié (l'historique des ventes n'est pas touché) ;
 *   • journal `rarity_runs` + bandeau de 7 jours dans `game_config`.
 *
 *   npm run rarity:apply -- --yes [--skip-tests]
 */

import { execSync } from "node:child_process";

import type { Rarity } from "../../src/lib/cards";
import {
  FRANCHISE_CAPS,
  POPULARITY_WEIGHTS,
  RARITY_ORDER,
  RARITY_SHARES,
} from "../../src/lib/rarity-distribution.config";
import { loadDataset, saveDataset } from "./lib/dataset";
import { allBlockingPass, rarityName } from "./lib/controls";
import { buildPreview } from "./preview";
import { openRunner } from "../lib/db-runner";

const YES = process.argv.includes("--yes");
const SKIP_TESTS = process.argv.includes("--skip-tests");

function textLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function runTests(): { ok: boolean; detail: string } {
  try {
    execSync("npm test", { stdio: "pipe", timeout: 600_000, encoding: "utf8" });
    return { ok: true, detail: "npm test au vert" };
  } catch (error) {
    const output = (error as { stdout?: string }).stdout ?? "";
    const tail = output.split("\n").filter(Boolean).slice(-6).join(" · ");
    return { ok: false, detail: tail || "npm test a échoué" };
  }
}

/**
 * Le SQL complet de l'application, en un seul bloc `do $$ … $$` : c'est ce qui
 * garantit l'atomicité côté base — une erreur n'importe où annule tout.
 */
export const buildApplySql = (rows: { id: string; rarity: Rarity }[], total: number) => `
do $$
declare
  v_version integer;
  v_before jsonb;
  v_changed integer;
  v_cancelled_listings integer := 0;
  v_cancelled_orders integer := 0;
  v_refunded integer := 0;
  v_run_id bigint;
begin
  -- Verrou global : deux applications simultanées ne peuvent pas se chevaucher.
  lock table public.cards in share row exclusive mode;

  select coalesce(max(rarity_version), 0) + 1 into v_version from public.cards;

  create temp table _rarity_target (id text primary key, new_rarity text not null) on commit drop;
  insert into _rarity_target (id, new_rarity) values
    ${rows.map((row) => `(${textLiteral(row.id)}, ${textLiteral(row.rarity)})`).join(",\n    ")};

  select jsonb_object_agg(c.id, c.rarity) into v_before
    from public.cards c join _rarity_target t on t.id = c.id;

  -- Rareté d'avant conservée, nouvelle rareté, verrou et version.
  update public.cards c
     set rarity_v1 = coalesce(c.rarity_v1, c.rarity),
         rarity = t.new_rarity,
         rarity_version = v_version,
         rarity_locked = true
    from _rarity_target t
   where c.id = t.id;

  -- Cartes dont la rareté a effectivement changé.
  select count(*)::int into v_changed
    from public.cards c
   where c.rarity_version = v_version
     and c.rarity_v1 is not null
     and c.rarity_v1 <> c.rarity;

  -- ————— Annonces hors fourchette —————
  create temp table _cancelled_listings on commit drop as
    select l.id, l.seller_id, l.card_id, l.holo, l.price_pixels
      from public.market_listings l
      join public.cards c on c.id = l.card_id
     where l.status = 'active'
       and c.rarity_version = v_version
       and c.rarity_v1 is not null
       and c.rarity_v1 <> c.rarity
       and l.price_pixels not between
           (public._market_quote(l.card_id, l.holo) ->> 'min')::int
           and (public._market_quote(l.card_id, l.holo) ->> 'max')::int;

  update public.market_listings l
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = 'rareté mise à jour'
    from _cancelled_listings x
   where x.id = l.id;

  insert into public.collection as col (user_id, card_id, quantity, holo_quantity)
  select x.seller_id, x.card_id, 1, case when x.holo then 1 else 0 end
    from _cancelled_listings x
  on conflict (user_id, card_id) do update
    set quantity = col.quantity + 1,
        holo_quantity = col.holo_quantity + case when excluded.holo_quantity > 0 then 1 else 0 end;

  insert into public.notifications (user_id, kind, card_id, listing_id, amount)
  select x.seller_id, 'listing_cancelled', x.card_id, x.id, x.price_pixels
    from _cancelled_listings x;

  select count(*)::int into v_cancelled_listings from _cancelled_listings;

  -- ————— Ordres d'achat hors fourchette —————
  create temp table _cancelled_orders on commit drop as
    select o.id, o.buyer_id, o.card_id, o.holo, o.max_price, o.reserved_pixels
      from public.buy_orders o
      join public.cards c on c.id = o.card_id
     where o.status = 'active'
       and c.rarity_version = v_version
       and c.rarity_v1 is not null
       and c.rarity_v1 <> c.rarity
       and o.max_price not between
           (public._market_quote(o.card_id, o.holo) ->> 'min')::int
           and (public._market_quote(o.card_id, o.holo) ->> 'max')::int;

  update public.buy_orders o
     set status = 'cancelled',
         cancelled_at = now(),
         reserved_pixels = 0
    from _cancelled_orders x
   where x.id = o.id;

  update public.profiles p
     set pixels = p.pixels + x.reserved_pixels
    from (select buyer_id, sum(reserved_pixels)::int as reserved_pixels
            from _cancelled_orders
           group by buyer_id) x
   where p.id = x.buyer_id
     and x.reserved_pixels > 0;

  insert into public.pixel_transactions (user_id, amount, reason, ref_kind, ref_id)
  select x.buyer_id, x.reserved_pixels, 'annulation_ordre', 'buy_order', x.id
    from _cancelled_orders x
   where x.reserved_pixels > 0;

  insert into public.notifications (user_id, kind, card_id, order_id, amount)
  select x.buyer_id, 'order_cancelled', x.card_id, x.id, x.max_price
    from _cancelled_orders x;

  select count(*)::int, coalesce(sum(reserved_pixels), 0)::int
    into v_cancelled_orders, v_refunded
    from _cancelled_orders;

  -- ————— Journal —————
  insert into public.rarity_runs (card_count, distribution, config, previous_rarities, applied_by, summary)
  values (
    ${total},
    jsonb_build_object(
      ${RARITY_ORDER.map(
        (rarity) => `${textLiteral(rarity)}, (select count(*) from public.cards where rarity = ${textLiteral(rarity)})`,
      ).join(",\n      ")}
    ),
    ${textLiteral(
      JSON.stringify({
        shares: RARITY_SHARES,
        caps: FRANCHISE_CAPS,
        weights: POPULARITY_WEIGHTS,
        version: "rarity:apply --yes",
      }),
    )}::jsonb,
    v_before,
    'script rarity:apply',
    jsonb_build_object(
      'version', v_version,
      'changed', v_changed,
      'cancelled_listings', v_cancelled_listings,
      'cancelled_orders', v_cancelled_orders,
      'refunded_pixels', v_refunded
    )
  )
  returning id into v_run_id;

  -- ————— Bandeau de 7 jours —————
  insert into public.game_config (key, value)
  values ('rarity_update', jsonb_build_object(
    'applied_at', now(),
    'version', v_version,
    'href', '/raretes',
    'run', v_run_id,
    'changed', v_changed
  ))
  on conflict (key) do update set value = excluded.value;
end;
$$;
`;

async function main() {
  if (!YES) {
    console.error("✗ rien n'est appliqué sans --yes.\n  npm run rarity:apply -- --yes");
    process.exit(1);
  }

  const tests = SKIP_TESTS
    ? { ok: true, detail: "tests ignorés (--skip-tests)" }
    : runTests();
  console.log(`→ tests : ${tests.ok ? "✓" : "✗"} ${tests.detail}`);
  if (!tests.ok) {
    console.error("✗ tests en échec : rien n'est appliqué.");
    process.exit(1);
  }

  const dataset = await loadDataset();
  const { preview, verdicts } = await buildPreview(dataset, { testsPassed: true });
  await saveDataset(dataset);

  for (const verdict of verdicts) {
    console.log(`  ${verdict.ok ? "✓" : verdict.blocking ? "✗" : "!"} ${verdict.label} — ${verdict.detail}`);
  }
  if (!allBlockingPass(verdicts)) {
    console.error("\n✗ un contrôle bloquant échoue : rien n'est appliqué.");
    process.exit(1);
  }

  const rows = preview.cards.map((card) => ({ id: card.id, rarity: card.to }));
  const runner = await openRunner();
  try {
    console.log("\n→ transaction unique (raretés, marché, journal, bandeau)…");
    await runner.query(buildApplySql(rows, preview.total));

    const journal = await runner.query(
      "select id, applied_at, card_count, summary from public.rarity_runs order by id desc limit 1",
    );
    const run = journal[0] ?? {};
    const summary = (run.summary ?? {}) as Record<string, number>;

    console.log(`✓ appliqué — exécution #${run.id} le ${run.applied_at}`);
    console.log(`  version ${summary.version} · ${summary.changed} cartes changées`);
    console.log(`  annonces annulées : ${summary.cancelled_listings} · ordres annulés : ${summary.cancelled_orders}`);
    console.log(`  Pixels restitués : ${summary.refunded_pixels}`);
    for (const rarity of RARITY_ORDER) {
      console.log(`  ${rarityName(rarity).padEnd(12)} ${String(preview.after[rarity]).padStart(3)}`);
    }

    const check = await runner.query(`
      select rarity, count(*)::int as n from public.cards group by rarity order by rarity
    `);
    console.log(`  contrôle en base : ${check.map((row) => `${row.rarity}=${row.n}`).join(" ")}`);
    console.log("  retour arrière : npm run rarity:rollback");
  } finally {
    await runner.close();
  }
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/popularity/apply.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
