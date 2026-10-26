import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Statistiques du marché (migration 025). Les agrégats sont publics pour les
 * joueurs connectés, mais aucune identité ne doit filtrer dans la réponse.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/025_stats_marche.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("vue d'ensemble : fenêtres 24 h et 7 jours", () => {
  const overview = block("market_overview");
  assert.match(overview, /from public\.trades where created_at >= now\(\) - interval '24 hours'/);
  assert.match(overview, /from public\.trades where created_at >= now\(\) - interval '7 days'/);
  assert.match(overview, /sum\(price\)/);
  assert.match(overview, /sum\(fee\)/);
});

test("vue d'ensemble : annonces échues exclues du carnet", () => {
  const overview = block("market_overview");
  assert.match(overview, /status = 'active'/);
  assert.match(overview, /expires_at is null or expires_at > now\(\)/);
  assert.match(overview, /from public\.buy_orders where status = 'active'/);
});

test("vue d'ensemble : top 5, sans identité", () => {
  const overview = block("market_overview");
  assert.match(overview, /limit 5/);
  assert.match(overview, /'card_id', card_id/);
  assert.doesNotMatch(overview, /seller_id|buyer_id|username/);
});

test("historique : total répété et pagination bornée", () => {
  const history = block("card_sales_history");
  assert.match(history, /\(select count\(\*\) from scoped\) as total/);
  assert.match(history, /order by s\.created_at desc/);
  assert.match(history, /least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/);
  assert.match(history, /offset greatest\(coalesce\(p_offset, 0\), 0\)/);
  // Aucun identifiant d'acheteur ou de vendeur dans le résultat.
  assert.doesNotMatch(history, /seller_id|buyer_id/);
});

test("statistiques : réservées aux joueurs connectés", () => {
  for (const fn of ["market_overview()", "card_sales_history(text, integer, integer)"]) {
    assert.match(MIGRATION, new RegExp(`revoke all on function public\\.${fn.replace(/[().]/g, "\\$&")} from anon`));
    assert.match(MIGRATION, new RegExp(`grant execute on function public\\.${fn.replace(/[().]/g, "\\$&")} to authenticated`));
  }
});

test("vente directe : l'historique `trades` est complété", () => {
  const trigger = block("record_direct_sale");
  assert.match(trigger, /new\.status = 'sold'/);
  assert.match(trigger, /insert into public\.trades/);
  assert.match(trigger, /where not exists \(\s*select 1 from public\.trades t where t\.listing_id = new\.id/);
  // Trigger différé : l'appariement a déjà écrit sa ligne au moment du contrôle.
  assert.match(MIGRATION, /create constraint trigger record_direct_sale/);
  assert.match(MIGRATION, /deferrable initially deferred/);
});

test("vente directe : reprise des ventes passées, sans faux événements", () => {
  assert.match(MIGRATION, /alter table public\.trades disable trigger market_audit_trades/);
  assert.match(MIGRATION, /alter table public\.trades disable trigger notify_trade_orders/);
  assert.match(MIGRATION, /alter table public\.trades enable trigger market_audit_trades/);
  assert.match(MIGRATION, /coalesce\(l\.sold_at, l\.created_at\)/);
  assert.match(MIGRATION, /des ventes vendues restent absentes de trades/);
});

test("statistiques : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop function if exists public\.market_overview\(\)/);
  assert.match(MIGRATION, /drop function if exists public\.card_sales_history\(text, integer, integer\)/);
});
