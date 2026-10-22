import assert from "node:assert/strict";
import test from "node:test";

import { CARDS } from "../src/lib/cards";
import {
  BOOSTER_COOLDOWN_MS,
  CARDS_PER_BOOSTER,
  RARITY,
  canOpenBooster,
  collectionCompletion,
  formatCountdown,
  nextBoosterAt,
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
    assert.ok(card.atk >= 1000 && card.atk <= 9999, `${card.id} atk hors bornes`);
    assert.ok(card.def >= 1000 && card.def <= 9999, `${card.id} def hors bornes`);
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

test("cooldown : un booster est disponible après 10 minutes", () => {
  const now = Date.now();
  assert.equal(canOpenBooster(null, now), true);

  const justOpened = new Date(now - 1000).toISOString();
  assert.equal(canOpenBooster(justOpened, now), false);
  assert.ok(nextBoosterAt(justOpened)!.getTime() > now);

  const old = new Date(now - BOOSTER_COOLDOWN_MS - 1).toISOString();
  assert.equal(canOpenBooster(old, now), true);
});

test("formatCountdown et completion", () => {
  assert.equal(formatCountdown(0), "0:00");
  assert.equal(formatCountdown(9_000), "0:09");
  assert.equal(formatCountdown(600_000), "10:00");
  assert.equal(formatCountdown(-500), "0:00");

  assert.equal(collectionCompletion(0), 0);
  assert.equal(collectionCompletion(CARDS.length), 100);
});
