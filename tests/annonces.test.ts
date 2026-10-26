import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Annonces expirantes et prix modifiable (migration 023). Les invariants sont
 * verrouillés sur le SQL : ce sont eux qui protègent l'économie, pas l'UI.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/023_annonces_expirantes.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("échéance : colonne, réglage et trigger présents", () => {
  assert.match(MIGRATION, /add column if not exists expires_at timestamptz/);
  assert.match(MIGRATION, /add column if not exists cancel_reason text/);
  assert.match(MIGRATION, /\('market_listing_days', '7'::jsonb\)/);
  assert.match(MIGRATION, /create trigger market_listing_expiry[\s\S]*?before insert on public\.market_listings/);
  // Une valeur nulle ou négative n'expire pas instantanément une annonce.
  assert.match(MIGRATION, /make_interval\(days => greatest\(v_days, 1\)\)/);
});

test("échéance : les annonces existantes sont reprises depuis leur création", () => {
  const backfill = MIGRATION.slice(
    MIGRATION.indexOf("update public.market_listings"),
    MIGRATION.indexOf("create or replace function public.market_listing_expiry"),
  );
  assert.match(backfill, /set expires_at = created_at \+ make_interval/);
  assert.match(backfill, /where expires_at is null/);
});

test("balayage : carte rendue, raison écrite, concurrence sûre", () => {
  const sweep = block("market_expire_listings");
  assert.match(sweep, /where l\.status = 'active'[\s\S]*?l\.expires_at <= now\(\)/);
  assert.match(sweep, /for update skip locked/);
  assert.match(sweep, /set status = 'cancelled',[\s\S]*?cancel_reason = 'expired'/);
  assert.match(sweep, /insert into public\.collection as col/);
  assert.match(sweep, /case when v_listing\.holo then 1 else 0 end/);
  // Deux appels simultanés ne se bloquent pas.
  assert.match(MIGRATION, /grant execute on function public\.market_expire_listings\(\) to authenticated/);
});

test("annonces publiques : une annonce échue disparaît avant le balayage", () => {
  const view = MIGRATION.slice(
    MIGRATION.indexOf("create function public.market_listings()"),
    MIGRATION.indexOf("revoke all on function public.market_listings()"),
  );
  assert.match(view, /l\.expires_at is null or l\.expires_at > now\(\)/);
  assert.match(view, /or l\.seller_id = auth\.uid\(\)/);
  assert.match(view, /expires_at timestamptz,/);
  assert.match(view, /cancel_reason text/);
  // Le type de retour change : la fonction doit être recréée, pas remplacée.
  assert.match(MIGRATION, /drop function if exists public\.market_listings\(\)/);
});

test("achat : une annonce échue est refusée", () => {
  const buy = block("buy_listing");
  assert.match(buy, /v_listing\.expires_at <= now\(\)/);
  assert.match(buy, /'reason', 'expired'/);
  // Le refus tombe avant tout débit ou transfert.
  assert.ok(buy.indexOf("'expired'") < buy.indexOf("update public.profiles"), "débit après le contrôle");
});

test("appariement : jamais une annonce échue", () => {
  const match = block("match_card_orders");
  assert.match(match, /and \(expires_at is null or expires_at > now\(\)\)/);
});

test("prix : propriétaire, annonce active, jamais expirée", () => {
  const update = block("update_listing_price");
  assert.match(update, /v_listing\.seller_id <> v_uid/);
  assert.match(update, /v_listing\.status <> 'active'/);
  assert.match(update, /v_listing\.expires_at <= now\(\)/);
  assert.match(update, /'reason', 'price_out_of_bounds'/);
  // Le prix suit les mêmes bornes que la mise en vente.
  assert.match(update, /public\.market_quote\(v_listing\.card_id, v_listing\.holo\)/);
  // Un ordre en attente est servi si le nouveau prix y entre.
  assert.match(update, /perform public\.match_card_orders\(v_listing\.card_id, v_listing\.holo\)/);
  assert.match(MIGRATION, /grant execute on function public\.update_listing_price\(bigint, integer\) to authenticated/);
});

test("prix : le journal garde l'ancien montant", () => {
  assert.match(MIGRATION, /'listing_price'/);
  assert.match(MIGRATION, /'previous_price', old\.price_pixels/);
});

test("expiration : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop function if exists public\.market_expire_listings\(\)/);
  assert.match(MIGRATION, /delete from public\.game_config where key = 'market_listing_days'/);
});
