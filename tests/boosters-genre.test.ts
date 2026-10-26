import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { cardIdsOfGenre } from "../src/lib/card-genres";
import { CARDS } from "../src/lib/cards";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const MIGRATION = read("supabase/migrations/037_boosters_de_genre_stricts.sql");

test("boosters de genre : le pool est une frontière", () => {
  assert.match(MIGRATION, /v_strict := exists/);

  // Chaque repli vers le catalogue entier est réservé au pack Mix.
  const globalPicks = MIGRATION.match(/v_card := public\._pick_card\(v_global/g) ?? [];
  const guards = MIGRATION.match(/if v_card is null and not v_strict then/g) ?? [];
  assert.ok(globalPicks.length > 0, "aucun repli global : script inattendu");
  assert.equal(
    globalPicks.length,
    guards.length,
    "un repli global échappe au garde-fou `not v_strict`",
  );
});

test("boosters de genre : les chances sont calculées sur le pool", () => {
  assert.match(MIGRATION, /c\.id = any \(p_pool\) and c\.rarity = e\.key/);
  assert.match(MIGRATION, /cg\.genre_id = v_row\.genre_id/);
  assert.match(MIGRATION, /where e\.key = any \(v_rarities\)/);
});

test("pool MMO : assez de basses raretés pour un paquet de cinq cartes", () => {
  const mmo = cardIdsOfGenre("mmo")
    .map((id) => CARDS.find((card) => card.id === id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const count = (rarity: string) => mmo.filter((card) => card.rarity === rarity).length;

  assert.ok(mmo.length >= 90, `pool MMO trop petit : ${mmo.length}`);
  for (const rarity of ["C", "UC", "R"]) {
    assert.ok(count(rarity) >= 5, `${rarity} : ${count(rarity)} cartes seulement`);
  }

  // L'import MMO avait promu 82 % du pool en Légendaire ou Mythique, ce qui
  // vidait les Communes et déclenchait le repli hors genre.
  const high = (count("UR") + count("L")) / mmo.length;
  assert.ok(high <= 0.25, `hautes raretés : ${(high * 100).toFixed(0)} % du pool MMO`);
});
