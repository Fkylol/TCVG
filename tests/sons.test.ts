import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { CARDS } from "../src/lib/cards";
import { RARITY_ORDER } from "../src/lib/game";
import { haptic, raritySound, readSoundOn, semitone, setSoundOn, sfx } from "../src/lib/sfx";

/**
 * Les sons de la révélation sont synthétisés : rien à écouter dans un test,
 * mais le dosage qui porte l'ouverture (« plus la carte est rare, plus
 * l'arpège est long et aigu ») et le réglage coupé doivent tenir.
 */

test("chaque rareté du catalogue a un réglage sonore", () => {
  for (const rarity of RARITY_ORDER) {
    const sound = raritySound(rarity);
    assert.ok(sound.degrees.length > 0, `${rarity} sans note`);
    assert.ok(sound.root > 0, `${rarity} sans fondamentale`);
    assert.ok(sound.gain > 0, `${rarity} muet`);
  }
  for (const card of CARDS) raritySound(card.rarity);
});

test("l'arpège s'allonge avec la rareté, du Commun au Mythique", () => {
  const counts = ["C", "UC", "R", "SR", "UR", "L"].map((rarity) =>
    raritySound(rarity as Parameters<typeof raritySound>[0]).degrees.length,
  );

  for (let index = 1; index < counts.length; index += 1) {
    assert.ok(
      counts[index] > counts[index - 1],
      `autant de notes pour une rareté supérieure (${counts.join(" / ")})`,
    );
  }
});

test("la fondamentale ne redescend pas quand la rareté monte", () => {
  const roots = ["C", "UC", "R", "SR", "UR", "L"].map((rarity) =>
    raritySound(rarity as Parameters<typeof raritySound>[0]).root,
  );

  for (let index = 1; index < roots.length; index += 1) {
    assert.ok(roots[index] >= roots[index - 1], `fondamentale qui redescend : ${roots.join(" / ")}`);
  }
});

test("semitone : octave au-dessus, octave en dessous", () => {
  assert.equal(semitone(440, 0), 440);
  assert.equal(semitone(440, 12), 880);
  assert.equal(semitone(440, -12), 220);
});

test("son coupé : le réglage est relu par les deux composants", () => {
  assert.equal(readSoundOn(), true);
  setSoundOn(false);
  assert.equal(readSoundOn(), false);
  setSoundOn(true);
  assert.equal(readSoundOn(), true);
});

test("sans navigateur (rendu serveur, test), aucun son ne lève", () => {
  assert.doesNotThrow(() => {
    sfx.tear();
    sfx.aura("L");
    sfx.card("SR", { holo: true });
    sfx.recap();
    haptic("L");
  });
});

test("la révélation branche le son sur la déchirure, l'aura, chaque carte et le récap", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/booster-reveal.tsx"),
    "utf8",
  );

  for (const call of [
    /sfx\.tear\(\)/,
    /sfx\.aura\(best\)/,
    /sfx\.card\(entry\.card\.rarity/,
    /sfx\.recap\(\)/,
    /haptic\(entry\.card\.rarity\)/,
  ]) {
    assert.match(source, call, `appel manquant dans la révélation : ${call}`);
  }

  // Le réglage doit rester accessible pendant l'ouverture, pas seulement avant.
  assert.match(source, /setSoundOn\(!soundOn\)/);
  assert.match(source, /aria-pressed=\{soundOn\}/);
});

test("son coupé : jouer ne lève pas et ne crée pas de contexte", () => {
  setSoundOn(false);
  try {
    assert.doesNotThrow(() => {
      sfx.tear();
      sfx.card("C");
      haptic("C");
    });
  } finally {
    setSoundOn(true);
  }
});
