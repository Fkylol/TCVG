import assert from "node:assert/strict";
import test from "node:test";

import { CARDS, findDuplicateCards, getCardNumber } from "../src/lib/cards";
import { CARD_LORE } from "../src/lib/card-lore";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  CARDS_PER_BOOSTER,
  RARITY,
  TOTAL_WEIGHT,
  collectionCompletion,
  formatCountdown,
  formatPercent,
  projectedStock,
  rarestRarity,
} from "../src/lib/game";
import { PACKS } from "../src/lib/packs";

test("catalogue : identifiants uniques et données complètes", () => {
  const ids = new Set<string>();
  for (const card of CARDS) {
    assert.ok(!ids.has(card.id), `id dupliqué : ${card.id}`);
    ids.add(card.id);
    assert.ok(card.name.trim().length > 0, `${card.id} sans nom`);
    assert.ok(card.emoji.trim().length > 0, `${card.id} sans emoji`);
    assert.ok(RARITY[card.rarity], `${card.id} a une rareté inconnue`);
    // Les cartes importées n'ont pas encore de fiche : quand elle existe, elle
    // doit être complète.
    const lore = CARD_LORE[card.id];
    if (lore) {
      assert.ok(lore.bio.length > 20, `${card.id} bio trop courte`);
      assert.ok(lore.tagline.length > 0, `${card.id} sans accroche`);
      // Citation et pouvoir sont optionnels : les fiches récentes n'ont que
      // l'accroche et la biographie.
      if (lore.quote) assert.ok(lore.quote.length > 0, `${card.id} sans citation`);
      if (lore.power) assert.ok(lore.power.length > 0, `${card.id} sans pouvoir`);
    }
  }
  assert.ok(CARDS.length >= 50, "le catalogue doit proposer au moins 50 cartes");
});

test("catalogue : chaque carte a une fiche", () => {
  const missing = CARDS.filter((card) => !CARD_LORE[card.id]);
  assert.deepEqual(
    missing.map((card) => card.id),
    [],
    "chaque carte doit avoir au moins une accroche et une biographie",
  );
});

test("catalogue : chaque rareté possède au moins une carte", () => {
  for (const key of Object.keys(RARITY) as (keyof typeof RARITY)[]) {
    const count = CARDS.filter((card) => card.rarity === key).length;
    assert.ok(count > 0, `aucune carte de rareté ${key}`);
  }
});

test("rareté la plus haute d'un tirage", () => {
  assert.equal(rarestRarity([]), "C");
  assert.equal(rarestRarity(["C", "UC", "R"]), "R");
  assert.equal(rarestRarity(["C", "UC"]), "UC");
  assert.equal(rarestRarity(["C", "R", "SR"]), "SR");
  assert.equal(rarestRarity(["SR", "L", "R"]), "L");
  assert.equal(rarestRarity(["UR", "SR"]), "UR");
});

test("affichage des raretés : les six lettres C, U, R, E, L, M", () => {
  // Le badge suit l'ordre des paliers, pas l'initiale du libellé :
  // « Peu commune » s'affiche U et « Légendaire » L, comme sur les cartes.
  assert.deepEqual(
    (["C", "UC", "R", "SR", "UR", "L"] as const).map((key) => RARITY[key].short),
    ["C", "U", "R", "E", "L", "M"],
  );
});

test("raretés : les poids couvrent bien 1 000", () => {
  assert.equal(Math.round(TOTAL_WEIGHT), 1000);
  assert.deepEqual(
    Object.values(RARITY).map((info) => info.weight),
    [620.25, 250, 114, 14, 1.5, 0.25],
  );
});

test("raretés : chances par booster de 5 cartes", () => {
  // Mêmes valeurs que la base (`game_config.booster_drop_rates`) et que
  // l'affichage « Chance par booster » : 1 - (1 - p)^5.
  const chance = (weight: number) => 1 - Math.pow(1 - weight / TOTAL_WEIGHT, CARDS_PER_BOOSTER);

  // Taux de référence : C 62 % · U 25 % · R 11,4 % · E 1,4 % · L 0,15 % · M 0,025 %.
  assert.ok(Math.abs(chance(RARITY.UC.weight) - 0.7627) < 0.002);
  assert.ok(Math.abs(chance(RARITY.R.weight) - 0.4546) < 0.002);
  assert.ok(Math.abs(chance(RARITY.SR.weight) - 0.068) < 0.002);
  assert.ok(Math.abs(chance(RARITY.UR.weight) - 0.0075) < 0.001);
  assert.ok(Math.abs(chance(RARITY.L.weight) - 0.00125) < 0.0005);
});

test("packs : 10 packs, 5 cartes chacun, un seul de chaque genre", () => {
  assert.equal(CARDS_PER_BOOSTER, 5);
  assert.equal(PACKS.length, 10);
  assert.equal(new Set(PACKS.map((pack) => pack.id)).size, 10);

  // Le premier est le Mix (aucun genre), les neuf autres couvrent les genres.
  assert.equal(PACKS[0].genre, null);
  const genres = PACKS.slice(1).map((pack) => pack.genre);
  assert.equal(new Set(genres).size, 9);
  assert.ok(PACKS.some((pack) => pack.id === "mmo" && pack.genre === "mmo"));
  assert.ok(genres.every((genre) => genre !== null));

  // Chaque pack a une palette complète, une taille de titre et une inclinaison.
  for (const pack of PACKS) {
    assert.ok(pack.pricePixels > 0, `${pack.id} sans prix`);
    for (const key of ["t1", "t2", "ink", "gl", "glow"] as const) {
      assert.match(
        pack.colors[key],
        /^#[0-9a-f]{6}([0-9a-f]{2})?$/i,
        `${pack.id} : couleur ${key} invalide`,
      );
    }
    assert.match(pack.colors.tx, /^rgba\(/, `${pack.id} : trait de texture manquant`);
    if (pack.colors.tx2) {
      assert.match(pack.colors.tx2, /^rgba\(/, `${pack.id} : second trait invalide`);
    }
    assert.ok(
      pack.titleSize >= 11 && pack.titleSize <= 16,
      `${pack.id} : taille de titre hors bornes`,
    );
    assert.ok(Math.abs(pack.tilt.bx) <= 5, `${pack.id} : inclinaison X hors bornes`);
    assert.ok(Math.abs(pack.tilt.by) <= 15, `${pack.id} : inclinaison Y hors bornes`);
  }
});

test("stock : +1 par tranche de 10 minutes, plafonné à 10", () => {
  const anchorMs = Date.UTC(2026, 0, 1, 12, 0, 0);
  const anchor = new Date(anchorMs).toISOString();

  const nothing = projectedStock(3, anchor, anchorMs);
  assert.equal(nothing.stock, 3);
  assert.equal(nothing.nextAt, anchorMs + BOOSTER_COOLDOWN_MS);

  const twoTicks = projectedStock(3, anchor, anchorMs + 2 * BOOSTER_COOLDOWN_MS + 1000);
  assert.equal(twoTicks.stock, 5);
  assert.equal(twoTicks.nextAt, anchorMs + 3 * BOOSTER_COOLDOWN_MS);

  const capped = projectedStock(BOOSTER_STOCK_MAX - 1, anchor, anchorMs + 5 * BOOSTER_COOLDOWN_MS);
  assert.equal(capped.stock, BOOSTER_STOCK_MAX);
  assert.equal(capped.nextAt, null, "stock plein : plus de compte à rebours");

  const empty = projectedStock(0, anchor, anchorMs + 60 * BOOSTER_COOLDOWN_MS);
  assert.equal(empty.stock, BOOSTER_STOCK_MAX, "une longue absence remplit le stock sans le dépasser");

  const noAnchor = projectedStock(1, null, anchorMs);
  assert.equal(noAnchor.stock, 1);
  assert.equal(noAnchor.nextAt, null);
});

test("numérotation d'album : chaque carte a un numéro unique de 1 à N", () => {
  const numbers = CARDS.map((card) => getCardNumber(card.id));
  assert.ok(
    numbers.every((value) => typeof value === "number"),
    "une carte n'a pas de numéro",
  );
  assert.equal(new Set(numbers).size, CARDS.length, "numéros dupliqués");

  const expected = Array.from({ length: CARDS.length }, (_, index) => index + 1);
  assert.deepEqual([...numbers].sort((a, b) => (a as number) - (b as number)), expected);
});

test("formatCountdown et completion", () => {
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(9_000), "0:09");
  assert.equal(formatCountdown(600_000), "10:00");
  assert.equal(formatCountdown(-500), "0:00");

  assert.equal(collectionCompletion(0), 0);
  assert.equal(collectionCompletion(CARDS.length), 100);
});

test("pourcentages : français, sans décimale inutile", () => {
  assert.equal(formatPercent(0.62025), "62 %");
  assert.equal(formatPercent(0.25), "25 %");
  assert.equal(formatPercent(0.114), "11,4 %");
  assert.equal(formatPercent(0.014), "1,4 %");
  assert.equal(formatPercent(0.0015), "0,15 %");
  assert.equal(formatPercent(0.00025), "0,025 %");
});

test("le catalogue refuse les doublons d'identifiant et de personnage", () => {
  const cards = CARDS;
  assert.deepEqual(findDuplicateCards(cards), [], "le catalogue contient un doublon");

  // Même identifiant, même personnage écrit autrement : les deux doivent ressortir.
  const broken = [
    { ...cards[0], id: "doublon" },
    { ...cards[1], id: "doublon" },
    { ...cards[2], id: "meme-personnage", name: `  ${cards[0].name.toUpperCase()} `, universe: cards[0].universe },
  ];
  const problems = findDuplicateCards(broken as typeof cards);
  assert.equal(problems.length, 2, `problèmes détectés : ${problems.join(" | ")}`);
  assert.match(problems[0], /identifiant/);
  assert.match(problems[1], /personnage/);
});
