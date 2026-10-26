import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Notifications in-app (migration 024). Trois événements seulement, écrits par
 * des triggers : le joueur ne peut pas s'en fabriquer, seulement les lire.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/024_notifications.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("notifications : trois événements, pas plus", () => {
  assert.match(MIGRATION, /create table if not exists public\.notifications/);
  assert.match(
    MIGRATION,
    /check \(kind in \('listing_sold', 'order_filled', 'listing_expired'\)\)/,
  );
});

test("notifications : lecture seule, et seulement des siennes", () => {
  assert.match(MIGRATION, /alter table public\.notifications enable row level security/);
  assert.match(MIGRATION, /using \(user_id = auth\.uid\(\)\)/);
  // Aucun privilège d'écriture : les triggers sont les seuls auteurs.
  assert.match(MIGRATION, /revoke all on public\.notifications from anon, authenticated/);
  assert.match(MIGRATION, /grant select on public\.notifications to authenticated/);
  assert.ok(
    !/grant (insert|update|delete)/i.test(MIGRATION),
    "un privilège d'écriture ouvrirait la fabrication de notifications",
  );
});

test("vente : le vendeur reçoit le net, pas le prix brut", () => {
  const trigger = block("notify_listing_events");
  assert.match(trigger, /new\.status = 'sold'/);
  assert.match(trigger, /'listing_sold', new\.card_id, new\.id, new\.seller_payout/);
  assert.match(MIGRATION, /after update on public\.market_listings/);
});

test("expiration : notifiée, contrairement à un retrait volontaire", () => {
  const trigger = block("notify_listing_events");
  assert.match(trigger, /new\.cancel_reason = 'expired'/);
  assert.match(trigger, /'listing_expired'/);
  // La branche « expired » exige `old.status = 'active'` et la raison.
  assert.match(trigger, /old\.status = 'active'/);
});

test("ordre servi : prix réellement payé, écrit depuis `trades`", () => {
  const trigger = block("notify_trade_orders");
  assert.match(trigger, /'order_filled', new\.card_id, new\.listing_id, new\.order_id, new\.price/);
  // Hors ordre (vente directe), l'acheteur n'a pas de notification d'ordre.
  assert.match(trigger, /if new\.order_id is null then/);
  assert.match(MIGRATION, /after insert on public\.trades/);
  // L'ancien trigger sur `buy_orders` ne doit plus exister : le prix n'y est
  // pas encore connu quand l'appariement marque l'ordre « filled ».
  assert.match(MIGRATION, /drop trigger if exists notify_order_filled on public\.buy_orders/);
  assert.ok(!/create trigger notify_order_filled/.test(MIGRATION));
});

test("marquage : seulement ses notifications, seulement les non lues", () => {
  const mark = block("mark_notifications_read");
  assert.match(mark, /where user_id = v_uid/);
  assert.match(mark, /read_at is null/);
  assert.match(mark, /p_ids is null or id = any \(p_ids\)/);
  assert.match(mark, /raise exception 'not_authenticated'/);
  assert.match(MIGRATION, /grant execute on function public\.mark_notifications_read\(bigint\[\]\) to authenticated/);
});

test("notifications : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop table if exists public\.notifications/);
});
