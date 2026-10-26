import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Seuil d'alerte par envie (migration 028). Le seuil vit sur la ligne
 * `wishlist`, n'est jamais modifiable directement, et le trigger ne sonne
 * qu'à l'apparition sous le seuil ou au franchissement à la baisse.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/028_seuil_envies.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("seuil : colonne facultative, positive", () => {
  assert.match(MIGRATION, /add column if not exists max_price integer/);
  assert.match(MIGRATION, /check \(max_price is null or max_price > 0\)/);
});

test("seuil : réglable uniquement via la fonction dédiée", () => {
  const fn = block("set_wishlist_alert");
  assert.match(fn, /where user_id = v_uid and card_id = p_card_id/);
  assert.match(fn, /'reason', 'not_wishlisted'/);
  assert.match(fn, /'reason', 'invalid_price'/);
  assert.match(MIGRATION, /grant execute on function public\.set_wishlist_alert\(text, integer\) to authenticated/);
  assert.match(MIGRATION, /if has_column_privilege\('authenticated', 'public\.wishlist', 'max_price', 'update'\)/);
});

test("alerte : sous le seuil à l'apparition, franchissement à la baisse", () => {
  const trigger = block("notify_wishlist_listing");
  assert.match(trigger, /when w\.max_price is null then true/);
  assert.match(trigger, /when new\.price_pixels > w\.max_price then false/);
  assert.match(trigger, /else tg_op = 'INSERT' or old\.price_pixels > w\.max_price/);
  // Une baisse qui reste sous le seuil ne renotifie pas.
  assert.match(trigger, /tg_op = 'UPDATE' and not \(new\.price_pixels < old\.price_pixels\)/);
});

test("alerte : vendeur exclu, annonce échue muette", () => {
  const trigger = block("notify_wishlist_listing");
  assert.match(trigger, /w\.user_id <> new\.seller_id/);
  assert.match(trigger, /new\.expires_at is not null and new\.expires_at <= now\(\)/);
  assert.match(trigger, /on conflict do nothing/);
});

test("seuil : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop column if exists max_price/);
});
