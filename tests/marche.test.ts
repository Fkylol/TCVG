import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Le carnet d'ordres vit en SQL : ces tests ne simulent pas Postgres, ils
 * verrouillent les invariants de la migration. Si quelqu'un retire la
 * réservation, le verrou de ligne ou la restitution du surplus, ils cassent
 * avant la mise en ligne.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/021_carnet_ordres.sql"),
  "utf8",
);

/** Corps de la fonction SQL, pour ne pas confondre deux blocs voisins. */
function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("carnet : les tables d'ordres et d'historique existent", () => {
  assert.match(MIGRATION, /create table if not exists public\.buy_orders/);
  assert.match(MIGRATION, /create table if not exists public\.trades/);
  assert.match(MIGRATION, /reserved_pixels integer not null default 0/);
  // L'historique ne peut pas être incohérent : prix = commission + net.
  assert.match(MIGRATION, /constraint trades_split_check check \(price = fee \+ seller_payout\)/);
});

test("carnet : les ordres ne sont lisibles que par leur acheteur", () => {
  assert.match(
    MIGRATION,
    /create policy "buy_orders: lecture de ses ordres"[\s\S]*?using \(buyer_id = auth\.uid\(\)\)/,
  );
  assert.match(
    MIGRATION,
    /create policy "trades: lecture de ses ventes et achats"[\s\S]*?using \(buyer_id = auth\.uid\(\) or seller_id = auth\.uid\(\)\)/,
  );
});

test("carnet : le carnet public ne renvoie aucun identifiant", () => {
  const orders = block("market_orders");
  assert.ok(!/buyer_id/.test(orders.replace(/buyer_id = v_uid/g, "")), "le carnet expose un acheteur");
  assert.match(orders, /'count', v_normal\.count/);
  assert.match(orders, /'best', v_normal\.best/);
});

test("appariement : meilleur prix d'abord, annonce la moins chère, jamais soi-même", () => {
  const match = block("match_card_orders");

  // Ordre prioritaire : prix max le plus haut, puis le plus ancien.
  assert.match(match, /order by max_price desc, created_at asc/);
  // Annonce retenue : la moins chère payable par cet ordre, la plus ancienne.
  assert.match(match, /and price_pixels <= v_order\.max_price/);
  assert.match(match, /and seller_id <> v_order\.buyer_id/);
  assert.match(match, /order by price_pixels asc, created_at asc/);
  // Deux exécutions concurrentes ne peuvent pas se bloquer ni vendre deux fois.
  assert.equal(match.match(/for update skip locked/g)?.length, 2);
});

test("appariement : le surplus réservé revient à l'acheteur", () => {
  const match = block("match_card_orders");
  assert.match(match, /v_surplus := v_order\.reserved_pixels - v_listing\.price_pixels/);
  assert.match(match, /set pixels = pixels \+ v_surplus/);
  assert.match(match, /'remboursement_ordre'/);
  // Le prix payé est celui de l'annonce, pas le maximum de l'ordre.
  assert.match(match, /v_listing\.price_pixels, v_fee, v_payout/);
});

test("appariement : la commission est détruite, pas créditée", () => {
  const match = block("match_card_orders");
  assert.match(match, /v_payout := v_listing\.price_pixels - v_fee/);
  // Un seul crédit vendeur, et aucun mouvement au nom de la commission.
  assert.equal(match.match(/set pixels = pixels \+/g)?.length, 2);
  assert.ok(!/pixels \+ v_fee/.test(match), "la commission est versée à quelqu'un");
});

test("ordre : prix réservé, bornes de la cote et plafond d'ordres", () => {
  const create = block("create_buy_order");
  assert.match(create, /for update/);
  assert.match(create, /key = 'market_max_orders'/);
  assert.match(create, /reason', 'too_many_orders'/);
  assert.match(create, /v_quote := public\.market_quote/);
  assert.match(create, /reason', 'price_out_of_bounds'/);
  assert.match(create, /set pixels = pixels - p_max_price/);
  assert.match(create, /'reservation_ordre'/);
  // Une carte retirée du catalogue ne peut pas être achetée.
  assert.match(create, /where id = p_card_id and active/);
});

test("ordre : annulation = restitution exacte de la réservation", () => {
  const cancel = block("cancel_buy_order");
  assert.match(cancel, /v_refund := v_order\.reserved_pixels/);
  assert.match(cancel, /set pixels = pixels \+ v_refund/);
  assert.match(cancel, /'annulation_ordre'/);
  assert.match(cancel, /reserved_pixels = 0/);
});

test("annonce : une nouvelle annonce sert les ordres en attente", () => {
  assert.match(MIGRATION, /create trigger market_listings_match/);
  assert.match(MIGRATION, /after insert on public\.market_listings/);
  assert.match(MIGRATION, /perform public\.match_card_orders\(new\.card_id, new\.holo\)/);
});

test("réglages et rollback sont documentés", () => {
  assert.match(MIGRATION, /\('market_max_orders', '20'::jsonb\)/);
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop table if exists public\.trades/);
});
