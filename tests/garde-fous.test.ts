import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Garde-fous du marché (migration 022). Comme pour le carnet d'ordres, on
 * verrouille les invariants SQL : journal d'audit fermé aux joueurs, limite de
 * débit qui compte annonces *et* ordres, purge qui rend cartes et Pixels.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/022_garde_fous_marche.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("audit : le journal existe et reste fermé aux joueurs", () => {
  assert.match(MIGRATION, /create table if not exists public\.market_audit/);
  assert.match(MIGRATION, /alter table public\.market_audit enable row level security/);
  assert.match(MIGRATION, /revoke all on public\.market_audit from anon, authenticated/);
  // Aucune policy créée : rien n'est lisible via l'API publique.
  assert.ok(
    !/create policy[^;]*market_audit/.test(MIGRATION),
    "une policy rendrait le journal lisible",
  );
});

test("audit : chaque table du marché est branchée", () => {
  assert.match(MIGRATION, /after insert or update on public\.market_listings/);
  assert.match(MIGRATION, /after insert or update on public\.buy_orders/);
  assert.match(MIGRATION, /after insert on public\.trades/);
  assert.match(MIGRATION, /'listing_' \|\| new\.status/);
  assert.match(MIGRATION, /'order_' \|\| new\.status/);
  assert.match(MIGRATION, /'trade', new\.card_id/);
});

test("débit : annonces et ordres partagent le même compteur", () => {
  const limit = block("market_rate_limit");
  assert.match(limit, /from public\.market_listings[\s\S]*?seller_id = v_actor/);
  assert.match(limit, /from public\.buy_orders[\s\S]*?buyer_id = v_actor/);
  assert.match(limit, /make_interval\(mins => v_minutes\)/);
  assert.match(limit, /raise exception 'rate_limited'/);
  // Le trigger est partagé par deux tables : PL/pgSQL refuse de compiler un
  // champ absent du record, d'où la lecture générique via to_jsonb.
  assert.match(limit, /to_jsonb\(new\) ->> 'buyer_id'/);
  assert.match(limit, /to_jsonb\(new\) ->> 'seller_id'/);
  assert.doesNotMatch(limit, /new\.(seller|buyer)_id/);
  // Le refus intervient avant l'écriture : rien de partiel.
  assert.match(MIGRATION, /before insert on public\.market_listings/);
  assert.match(MIGRATION, /before insert on public\.buy_orders/);
});

test("débit : les réglages existent", () => {
  assert.match(MIGRATION, /\('market_rate_window_minutes', '10'::jsonb\)/);
  assert.match(MIGRATION, /\('market_rate_max_actions', '15'::jsonb\)/);
});

test("carte retirée : aucune annonce possible", () => {
  const guard = block("market_listing_guard");
  assert.match(guard, /from public\.cards where id = new\.card_id and active/);
  assert.match(guard, /raise exception 'card_retired'/);
  assert.match(MIGRATION, /before insert on public\.market_listings/);
});

test("purge : cartes rendues, Pixels remboursés, traces écrites", () => {
  const purge = block("market_purge_retired");
  // Annonces des cartes inactives uniquement.
  assert.match(purge, /where l\.status = 'active' and c\.active = false/);
  // La copie revient au vendeur, holo comprise.
  assert.match(purge, /insert into public\.collection as col/);
  assert.match(purge, /case when v_listing\.holo then 1 else 0 end/);
  // L'ordre est annulé et la réservation rendue.
  assert.match(purge, /set status = 'cancelled', cancelled_at = now\(\), reserved_pixels = 0/);
  assert.match(purge, /set pixels = pixels \+ v_order\.reserved_pixels/);
  assert.match(purge, /'annulation_ordre'/);
  // Fonction réservée à l'administration.
  assert.match(MIGRATION, /revoke all on function public\.market_purge_retired\(\) from authenticated/);
});

test("garde-fous : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop table if exists public\.market_audit/);
});
