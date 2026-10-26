import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Une carte retirée du catalogue doit disparaître pour de bon : plus de ligne
 * dans `cards`, plus de copie, plus d'annonce. C'est la migration 040 qui pose
 * la clé étrangère manquante de `collection`, et `npm run db:cards` qui purge
 * les cartes absentes du code.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/040_suppression_definitive_des_cartes.sql"),
  "utf8",
);

test("suppression : la collection suit la carte en cascade", () => {
  assert.match(MIGRATION, /add constraint collection_card_id_fkey/);
  assert.match(MIGRATION, /references public\.cards \(id\) on delete cascade/);
});

test("suppression : les copies orphelines sont nettoyées avant la clé étrangère", () => {
  const orphanCleanup = MIGRATION.indexOf("delete from public.collection c");
  const foreignKey = MIGRATION.indexOf("add constraint collection_card_id_fkey");
  assert.ok(orphanCleanup > -1 && foreignKey > orphanCleanup, "nettoyage après la contrainte");
  assert.match(MIGRATION, /from public\.market_audit a/);
});

test("suppression : les cartes désactivées quittent la base", () => {
  assert.match(MIGRATION, /delete from public\.cards where active = false;/);
});

test("suppression : les cartes retirées du code ne sont plus dans le catalogue", () => {
  const cards = fs.readFileSync(path.join(process.cwd(), "src/lib/cards.ts"), "utf8");
  assert.doesNotMatch(cards, /id: "pda"/);
  assert.doesNotMatch(cards, /retired: true/);
});
