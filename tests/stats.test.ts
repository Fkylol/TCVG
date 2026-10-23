import assert from "node:assert/strict";
import test from "node:test";

import { CARDS, type Card } from "../src/lib/cards";
import {
  CARD_COEFFICIENTS,
  QUALITY_GRADES,
  STAT_BANDS,
  cardStats,
  coefficientOf,
  collectionScore,
  duelScore,
  qualityGrade,
  statValue,
} from "../src/lib/stats";

test("stats : chaque carte a un coefficient entre 0 et 1", () => {
  for (const card of CARDS) {
    assert.ok(
      Object.hasOwn(CARD_COEFFICIENTS, card.id),
      `coefficient manquant pour ${card.id}`,
    );
    const coefficient = CARD_COEFFICIENTS[card.id];
    assert.ok(
      coefficient >= 0 && coefficient <= 1,
      `${card.id} : coefficient hors bornes (${coefficient})`,
    );
  }
});

test("stats : aucun coefficient orphelin", () => {
  const ids = new Set(CARDS.map((card) => card.id));
  for (const id of Object.keys(CARD_COEFFICIENTS)) {
    assert.ok(ids.has(id), `coefficient pour une carte inconnue : ${id}`);
  }
});

test("stats : barème complet et fourchettes dans 0–100", () => {
  for (const rarity of ["C", "R", "SR", "UR", "L"] as const) {
    const bands = STAT_BANDS[rarity];
    for (const band of [bands.power, bands.aura]) {
      assert.ok(band.min >= 0 && band.min <= 100, `${rarity} : minimum hors bornes`);
      assert.ok(band.spread >= 0, `${rarity} : écart négatif`);
      assert.ok(band.min + band.spread <= 100, `${rarity} : plafond au-delà de 100`);
    }
  }
});

test("stats : puissance et aura restent dans la fourchette de la rareté", () => {
  for (const card of CARDS) {
    const stats = cardStats(card);
    const bands = STAT_BANDS[card.rarity];
    assert.ok(stats.power >= bands.power.min && stats.power <= bands.power.min + bands.power.spread);
    assert.ok(stats.aura >= bands.aura.min && stats.aura <= bands.aura.min + bands.aura.spread);
    assert.ok(stats.quality >= 0 && stats.quality <= 100);
  }
});

test("stats : coefficients 0 et 1 donnent les bornes exactes", () => {
  for (const rarity of ["C", "R", "SR", "UR", "L"] as const) {
    const bands = STAT_BANDS[rarity];
    assert.equal(statValue(bands.power, 0), bands.power.min);
    assert.equal(statValue(bands.power, 1), bands.power.min + bands.power.spread);
    assert.equal(statValue(bands.aura, -3), bands.aura.min, "coefficient borné en bas");
    assert.equal(statValue(bands.aura, 4), bands.aura.min + bands.aura.spread, "coefficient borné en haut");
  }
});

test("stats : coefficient absent ramené au milieu de la fourchette", () => {
  const card: Card = { ...CARDS[0], id: "carte-inconnue-stat" };
  assert.equal(coefficientOf(card), 0.5);
});

test("stats : la qualité suit 60 % puissance + 40 % aura", () => {
  for (const card of CARDS) {
    const stats = cardStats(card);
    assert.equal(stats.quality, Math.round(stats.power * 0.6 + stats.aura * 0.4));
    assert.equal(stats.grade.key, qualityGrade(stats.quality).key);
  }
});

test("stats : les notes de qualité sont ordonnées et couvrent 0–100", () => {
  assert.equal(QUALITY_GRADES[0].min, 0);
  for (let index = 1; index < QUALITY_GRADES.length; index++) {
    assert.ok(QUALITY_GRADES[index].min > QUALITY_GRADES[index - 1].min);
  }
  assert.equal(qualityGrade(0).key, "standard");
  assert.equal(qualityGrade(34).key, "standard");
  assert.equal(qualityGrade(35).key, "solide");
  assert.equal(qualityGrade(79).key, "prestige");
  assert.equal(qualityGrade(80).key, "relique");
  assert.equal(qualityGrade(100).key, "relique");
});

test("stats : score de collection et score de duel", () => {
  const cards = CARDS.slice(0, 5);
  const score = collectionScore(cards);
  const expected = cards.reduce(
    (total, card) => {
      const stats = cardStats(card);
      total.power += stats.power;
      total.aura += stats.aura;
      total.quality += stats.quality;
      total.duel += duelScore(stats);
      return total;
    },
    { unique: cards.length, power: 0, aura: 0, quality: 0, duel: 0 },
  );

  assert.deepEqual(score, expected);
  assert.equal(collectionScore([]).quality, 0);

  const sample = { ...cardStats(cards[0]), power: 80, aura: 50 };
  assert.equal(duelScore(sample), 71);
});
