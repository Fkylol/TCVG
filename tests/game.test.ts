import assert from "node:assert/strict";
import test from "node:test";

import { CARDS, findDuplicateCards, getCardNumber } from "../src/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  BOOSTER_STOCK_MAX,
  CARDS_PER_BOOSTER,
  RARITY,
  collectionCompletion,
  formatCountdown,
  projectedStock,
  rollBooster,
  rollRarity,
} from "../src/lib/game";

/** PRNG déterministe (mulberry32) pour des tests reproductibles. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("catalogue : identifiants uniques et données complètes", () => {
  const ids = new Set<string>();
  for (const card of CARDS) {
    assert.ok(!ids.has(card.id), `id dupliqué : ${card.id}`);
    ids.add(card.id);
    assert.ok(card.name.trim().length > 0, `${card.id} sans nom`);
    assert.ok(card.emoji.trim().length > 0, `${card.id} sans emoji`);
    assert.ok(RARITY[card.rarity], `${card.id} a une rareté inconnue`);
    assert.ok(card.bio.length > 20, `${card.id} bio trop courte`);
  }
  assert.ok(CARDS.length >= 50, "le catalogue doit proposer au moins 50 cartes");
});

test("catalogue : chaque rareté possède au moins une carte", () => {
  for (const key of Object.keys(RARITY) as (keyof typeof RARITY)[]) {
    const count = CARDS.filter((card) => card.rarity === key).length;
    assert.ok(count > 0, `aucune carte de rareté ${key}`);
  }
});

test("rollRarity respecte les poids annoncés", () => {
  const random = seeded(42);
  const draws = 120_000;
  const counts: Record<string, number> = { C: 0, R: 0, SR: 0, UR: 0, L: 0 };

  for (let i = 0; i < draws; i++) counts[rollRarity(random)] += 1;

  for (const [key, info] of Object.entries(RARITY)) {
    const expected = (info.weight / 1000) * 100;
    const actual = (counts[key] / draws) * 100;
    assert.ok(
      Math.abs(actual - expected) < 1.5,
      `rareté ${key} : attendu ~${expected}%, obtenu ${actual.toFixed(2)}%`,
    );
  }
});

test("rollBooster tire le bon nombre de cartes, sans doublon", () => {
  const random = seeded(7);
  for (let i = 0; i < 2000; i++) {
    const pack = rollBooster(random);
    assert.equal(pack.length, CARDS_PER_BOOSTER);
    const ids = new Set(pack.map((card) => card.id));
    assert.equal(ids.size, pack.length, "un booster contient deux fois la même carte");
    for (const card of pack) {
      assert.ok(CARDS.some((c) => c.id === card.id), `carte inconnue tirée : ${card.id}`);
    }
  }
});

test("rollBooster produit parfois des rares, mais rarement des mythiques", () => {
  const random = seeded(99);
  const packs = 5000;
  let mythic = 0;
  let epicOrBetter = 0;

  for (let i = 0; i < packs; i++) {
    const pack = rollBooster(random);
    if (pack.some((card) => card.rarity === "L")) mythic += 1;
    if (pack.some((card) => card.rarity === "SR" || card.rarity === "UR" || card.rarity === "L")) {
      epicOrBetter += 1;
    }
  }

  const mythicRate = mythic / packs;
  const epicRate = epicOrBetter / packs;

  assert.ok(mythicRate > 0, "aucun mythique sur 5000 boosters");
  assert.ok(mythicRate < 0.06, `trop de mythiques : ${(mythicRate * 100).toFixed(2)}%`);
  assert.ok(epicRate > 0.15, `trop peu d'épiques+ : ${(epicRate * 100).toFixed(2)}%`);
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
