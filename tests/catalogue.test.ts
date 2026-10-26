import assert from "node:assert/strict";
import test from "node:test";

import { CARD_GENRES, GENRES, cardIdsOfGenre, genresOf } from "../src/lib/card-genres";
import { CARDS, type Rarity } from "../src/lib/cards";
import { RARITY } from "../src/lib/game";
import { RARITY_META } from "../src/lib/rarity";

const EXPECTED_BY_RARITY: Record<Rarity, number> = { C: 126, UC: 131, R: 109, SR: 111, UR: 71, L: 26 };

test("catalogue : 574 cartes, répartition de rareté attendue", () => {
  assert.equal(CARDS.length, 574);

  const counts: Record<string, number> = {};
  for (const card of CARDS) counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;

  assert.deepEqual(counts, EXPECTED_BY_RARITY);
});

test("catalogue : les 9 genres existent et sont uniques", () => {
  assert.equal(GENRES.length, 9);
  assert.equal(new Set(GENRES.map((genre) => genre.slug)).size, 9);
  assert.deepEqual(
    GENRES.map((genre) => genre.slug),
    [
      "action-aventure",
      "plateforme",
      "rpg",
      "fps",
      "inde",
      "combat",
      "horreur",
      "strategie",
      "mmo",
    ],
  );
});

test("catalogue : chaque carte a au moins un genre valide", () => {
  const known = new Set(GENRES.map((genre) => genre.slug));

  for (const card of CARDS) {
    const genres = genresOf(card.id);
    assert.ok(genres.length > 0, `${card.id} n'a aucun genre`);
    for (const genre of genres) {
      assert.ok(known.has(genre), `${card.id} pointe un genre inconnu : ${genre}`);
    }
  }
});

test("catalogue : aucun genre rattaché à une carte inconnue", () => {
  const ids = new Set(CARDS.map((card) => card.id));
  for (const id of Object.keys(CARD_GENRES)) {
    assert.ok(ids.has(id), `${id} n'existe pas dans le catalogue`);
  }
});

test("catalogue : le pack Mix couvre toutes les cartes", () => {
  assert.equal(cardIdsOfGenre(null).length, CARDS.length);
});

test("raretés : la correspondance est unique et reprise par RARITY", () => {
  assert.deepEqual(Object.keys(RARITY_META).sort(), ["C", "L", "R", "SR", "UC", "UR"]);

  for (const [key, meta] of Object.entries(RARITY_META)) {
    const info = RARITY[key as Rarity];
    assert.equal(info.label, meta.name, `${key} : nom divergent`);
    assert.equal(info.short, meta.letter, `${key} : lettre divergente`);
    assert.equal(info.token, meta.token, `${key} : token divergent`);
  }

  // Les lettres affichées sont C, U, R, E, L, M — dans cet ordre de puissance.
  assert.deepEqual(
    ["C", "UC", "R", "SR", "UR", "L"].map((key) => RARITY_META[key as Rarity].letter),
    ["C", "U", "R", "E", "L", "M"],
  );
});
