import assert from "node:assert/strict";
import test from "node:test";

import { CARD_GENRES, GENRES, cardIdsOfGenre, genresOf } from "../src/lib/card-genres";
import { CARDS, catalogCards, catalogSize, getCard, type Rarity } from "../src/lib/cards";
import { getCardLore } from "../src/lib/card-lore";
import { getPortrait } from "../src/lib/portraits";
import { setCardEdits } from "../src/lib/card-edits";
import { RARITY } from "../src/lib/game";
import { RARITY_META } from "../src/lib/rarity";

// 579 cartes : dix-sept personnages sans visuel public ont quitté l'album, puis
// vingt versions spectrales sont entrées pour Halloween (octobre 2026).
const EXPECTED_BY_RARITY: Record<Rarity, number> = { C: 130, UC: 129, R: 108, SR: 112, UR: 73, L: 27 };

test("catalogue : 579 cartes, répartition de rareté attendue", () => {
  assert.equal(CARDS.length, 579);

  const counts: Record<string, number> = {};
  for (const card of CARDS) counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;

  assert.deepEqual(counts, EXPECTED_BY_RARITY);
});

test("catalogue : une suppression en ligne sort des totaux", () => {
  const [removed, corrected] = CARDS;
  const row = {
    name: null,
    rarity: null,
    universe: null,
    emoji: null,
    imageUrl: null,
    framing: null,
    hidden: false,
  };

  setCardEdits([
    { ...row, cardId: removed.id, hidden: true },
    { ...row, cardId: corrected.id, name: "Nom corrigé" },
  ]);

  // Le catalogue affiché, le « sur N » et la fiche de la carte suivent la
  // suppression sans redéploiement.
  assert.equal(catalogSize(), CARDS.length - 1);
  const visible = catalogCards();
  assert.equal(visible.length, CARDS.length - 1);
  assert.equal(visible.find((card) => card.id === corrected.id)?.name, "Nom corrigé");
  assert.equal(getCard(removed.id), undefined);

  setCardEdits([]);
  assert.equal(catalogSize(), CARDS.length);
});

test("catalogue : Comte Harebourg rejoint Dofus et le booster MMO avec sa fiche et son portrait", () => {
  const harebourg = CARDS.find((card) => card.id === "comte-harebourg");
  assert.deepEqual(harebourg, {
    id: "comte-harebourg",
    name: "Comte Harebourg",
    universe: "dofus",
    emoji: "⏳",
    rarity: "UR",
  });
  assert.deepEqual(genresOf("comte-harebourg"), ["mmo"]);
  assert.ok(cardIdsOfGenre("mmo").includes("comte-harebourg"));
  assert.match(getCardLore("comte-harebourg")?.bio ?? "", /Xélor.*Frigost/i);
  assert.equal(getPortrait("comte-harebourg")?.wikiHost, "dofuswiki.fandom.com");
  assert.equal(getPortrait("comte-harebourg")?.file, "Count Harebourg.png");
});

test("catalogue : Murloc rejoint World of Warcraft et le booster MMO", () => {
  const murloc = CARDS.find((card) => card.id === "murloc");
  assert.deepEqual(murloc, {
    id: "murloc",
    name: "Murloc",
    universe: "wow",
    emoji: "🐟",
    rarity: "C",
  });
  assert.deepEqual(genresOf("murloc"), ["mmo"]);
  assert.ok(cardIdsOfGenre("mmo").includes("murloc"));
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
    // Les cartes saisonnières vivent hors des packs de genre : elles ne sortent
    // que du booster d'événement, jamais du tirage permanent.
    if (card.season) continue;

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
  // Les cartes saisonnières sont exclues du Mix : elles ne sortent que du
  // booster d'événement.
  assert.equal(
    cardIdsOfGenre(null).length,
    CARDS.filter((card) => !card.season).length,
  );
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
