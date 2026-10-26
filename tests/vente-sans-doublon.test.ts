import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Une carte doit pouvoir se vendre même quand c'est la seule copie du joueur.
 * La règle vit en SQL (`create_listing`) et se reflète dans trois écrans : la
 * fiche carte, la modale de vente de la collection et le formulaire du marché.
 * Ces tests verrouillent les quatre, sinon la vente de la dernière copie
 * redevient impossible sans qu'aucun test ne bronche.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/038_vente_sans_doublon.sql"),
  "utf8",
);

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("vente : la garde d'un exemplaire a disparu de create_listing", () => {
  const body = block("create_listing");
  assert.doesNotMatch(body, /keep_one/);
  // La variante annoncée doit en revanche être réellement possédée.
  assert.match(body, /if v_holo_qty < 1 then/);
  assert.match(body, /if v_qty - v_holo_qty < 1 then/);
});

test("vente : vendre la dernière copie retire la ligne de collection", () => {
  const body = block("create_listing");
  assert.match(body, /if v_qty <= 1 then\s+delete from public\.collection/);
  assert.match(body, /update public\.collection\s+set quantity = quantity - 1/);
  // L'annulation réinsère la carte : la fonction de restitution fait un upsert.
  const market = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/011_marche.sql"),
    "utf8",
  );
  assert.match(market, /insert into public\.collection as col[\s\S]*?on conflict \(user_id, card_id\) do update/);
});

test("vente : la fiche carte autorise la dernière copie", () => {
  const page = source("src/app/(game)/card/[id]/page.tsx");
  assert.match(page, /const canSellNormal = quantity - holoQuantity >= 1;/);
  assert.match(page, /const canSellHolo = holoQuantity > 0;/);
  assert.doesNotMatch(page, /const canSellNormal = quantity - holoQuantity >= 2;/);
});

test("vente : la collection propose « Vendre » sur chaque carte", () => {
  const browser = source("src/components/collection-browser.tsx");
  assert.match(browser, /const sellable = entry\.quantity >= 1;/);
  assert.doesNotMatch(browser, /entry\.quantity - entry\.holoQuantity >= 2/);
});

test("vente : la modale de collection compte toutes les copies", () => {
  const button = source("src/components/sell-card-button.tsx");
  assert.match(button, /const canSellNormal = quantity - holoQuantity >= 1;/);
  assert.match(button, /const canSellHolo = holoQuantity > 0;/);
  assert.match(button, /const normalSellable = Math\.max\(0, quantity - holoQuantity\);/);
  assert.match(button, /const holoSellable = holoQuantity;/);
});

test("vente : plus aucun écran n'attend le refus « garder un exemplaire »", () => {
  for (const file of [
    "src/components/sell-card-button.tsx",
    "src/components/listing-form.tsx",
    "src/app/actions.ts",
  ]) {
    const body = source(file);
    const listingPart = body.slice(body.indexOf("createListing"));
    assert.doesNotMatch(listingPart, /keep_one/, `${file} gère encore keep_one`);
  }
});
