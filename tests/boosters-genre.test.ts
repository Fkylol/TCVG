import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { cardIdsOfGenre } from "../src/lib/card-genres";
import { CARDS } from "../src/lib/cards";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const MIGRATION = read("supabase/migrations/037_boosters_de_genre_stricts.sql");
const DRAW_MIGRATION = read("supabase/migrations/055_holos_reverse_bleue.sql");
const FIX_MIGRATION = read("supabase/migrations/059_repli_raretes_booster.sql");

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

test("boosters : le repli inclut les six raretés sans remplacer les autres règles", () => {
  const order = (sql: string, key: string) => {
    const match = sql.match(new RegExp(`${key}[^\\n]*array\\[([^\\]]+)\\]`));
    assert.ok(match, `ordre ${key} introuvable`);
    return [...match[1].matchAll(/'([A-Z]+)'/g)].map((item) => item[1]);
  };
  const old = order(DRAW_MIGRATION, "v_order");
  // Les littéraux SQL de la migration corrective doublent les apostrophes.
  const fix = FIX_MIGRATION.replace(/''/g, "'");
  const previous = order(fix, "v_old");
  const corrected = order(fix, "v_new");
  assert.deepEqual(previous, old);
  assert.deepEqual(corrected, ["L", "UR", "SR", "R", "UC", "C"]);
  assert.deepEqual(corrected.slice(corrected.indexOf("R") + 1), ["UC", "C"]);
  assert.deepEqual(corrected.slice(corrected.indexOf("UC") + 1), ["C"]);
  assert.match(FIX_MIGRATION, /pg_get_functiondef/);
  assert.match(FIX_MIGRATION, /raise exception 'Ordre de repli/);
  assert.match(FIX_MIGRATION, /execute replace\(v_definition, v_old, v_new\)/);
});

test("pool MMO : assez de basses raretés pour un paquet de cinq cartes", () => {
  const mmo = cardIdsOfGenre("mmo")
    .map((id) => CARDS.find((card) => card.id === id))
    .filter((card): card is NonNullable<typeof card> => Boolean(card));

  const count = (rarity: string) => mmo.filter((card) => card.rarity === rarity).length;

  // Le pool a perdu dix personnages sans visuel ; le seuil garde une marge
  // au-dessus des cinq cartes d'un paquet, et les planchers par rareté
  // ci-dessous restent la vraie garantie.
  assert.ok(mmo.length >= 80, `pool MMO trop petit : ${mmo.length}`);
  for (const rarity of ["C", "UC", "R"]) {
    assert.ok(count(rarity) >= 5, `${rarity} : ${count(rarity)} cartes seulement`);
  }

  // L'import MMO avait promu 82 % du pool en Légendaire ou Mythique, ce qui
  // vidait les Communes et déclenchait le repli hors genre.
  const high = (count("UR") + count("L")) / mmo.length;
  assert.ok(high <= 0.25, `hautes raretés : ${(high * 100).toFixed(0)} % du pool MMO`);
});
