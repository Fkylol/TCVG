import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Alertes d'envies (migration 027) : une carte suivie arrive en vente, ou son
 * prix baisse. Le vendeur n'est jamais notifié de sa propre annonce.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/027_alertes_envies.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("alerte : quatrième type d'événement", () => {
  assert.match(MIGRATION, /drop constraint if exists notifications_kind_check/);
  assert.match(
    MIGRATION,
    /check \(kind in \('listing_sold', 'order_filled', 'listing_expired', 'wishlist_listing'\)\)/,
  );
});

test("alerte : un doublon par joueur, annonce et montant", () => {
  assert.match(
    MIGRATION,
    /create unique index if not exists notifications_wishlist_once_idx[\s\S]*?\(user_id, listing_id, amount\)/,
  );
  assert.match(MIGRATION, /where kind = 'wishlist_listing'/);
});

test("alerte : jamais le vendeur, seulement les annonces achetables", () => {
  const trigger = block("notify_wishlist_listing");
  assert.match(trigger, /w\.user_id <> new\.seller_id/);
  assert.match(trigger, /new\.status <> 'active'/);
  assert.match(trigger, /new\.expires_at is not null and new\.expires_at <= now\(\)/);
  assert.match(trigger, /on conflict do nothing/);
});

test("alerte : nouvelle annonce et baisse de prix seulement", () => {
  const trigger = block("notify_wishlist_listing");
  assert.match(trigger, /tg_op = 'UPDATE' and not \(new\.price_pixels < old\.price_pixels\)/);
  assert.match(MIGRATION, /after insert or update of price_pixels on public\.market_listings/);
});

test("alerte : aucune écriture possible côté joueur", () => {
  assert.match(MIGRATION, /revoke all on function public\.notify_wishlist_listing\(\) from authenticated/);
});

test("alerte : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /delete from public\.notifications where kind = 'wishlist_listing'/);
});
