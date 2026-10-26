import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import manifest from "../src/data/card-images.json";
import { CARDS } from "../src/lib/cards";
import { resolveCardArt } from "../src/lib/card-art";
import { PORTRAIT_FRAMING } from "../src/lib/portraits";

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/029_images_locales.sql"),
  "utf8",
);

const ids = new Set(CARDS.map((card) => card.id));
const items = (manifest as { items: Record<string, string> }).items;

test("manifeste : chaque visuel désigne une carte du catalogue", () => {
  for (const [cardId, file] of Object.entries(items)) {
    assert.ok(ids.has(cardId), `visuel orphelin : ${cardId}`);
    assert.match(file, /^\/cards\/[a-z0-9-]+\.(webp|avif|png|jpg|jpeg)$/);
    // Le nom du fichier doit être l'identifiant de la carte.
    assert.equal(file.split("/").pop()?.split(".")[0], cardId);
  }
  assert.equal(manifest.count, Object.keys(items).length);
});

test("migration : colonne et garde-fous de chemin", () => {
  assert.match(MIGRATION, /add column if not exists image_path text/);
  assert.match(MIGRATION, /image_path like '\/cards\/%'/);
  assert.match(MIGRATION, /image_path not like '%\.\.%'/);
  assert.match(MIGRATION, /image_path not like '%:\/\/%'/);
  assert.match(MIGRATION, /rollback/i);
});

test("résolution : le fichier local passe avant le visuel externe", () => {
  assert.equal(items.kratos, undefined, "le manifeste de test doit rester vide");

  const external = resolveCardArt("kratos", undefined);
  assert.ok(external, "kratos doit avoir un visuel hotlinké de repli");
  assert.equal(external.local, false);
  assert.match(external.src, /^https?:\/\//);
  assert.ok(external.sourceLabel);

  const local = resolveCardArt("kratos", "/cards/kratos.webp");
  assert.ok(local);
  assert.equal(local.local, true);
  assert.equal(local.src, "/cards/kratos.webp");
  // Pas d'attribution externe pour un fichier servi par le site.
  assert.equal(local.credit, undefined);
  assert.equal(local.sourceLabel, undefined);
});

test("résolution : cadrage conservé, carte inconnue sans visuel", () => {
  const ciri = resolveCardArt("ciri", "/cards/ciri.webp");
  assert.deepEqual(ciri?.framing, PORTRAIT_FRAMING.ciri);

  assert.equal(resolveCardArt("carte-inconnue", undefined), null);
});
