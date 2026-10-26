import assert from "node:assert/strict";
import test from "node:test";

import portraits from "../src/data/portraits.json";
import { CARDS } from "../src/lib/cards";
import { PORTRAIT_FRAMING, getPortraitFraming } from "../src/lib/portraits";

test("cadrage : chaque réglage vise une carte du catalogue", () => {
  const ids = new Set(CARDS.map((card) => card.id));
  for (const id of Object.keys(PORTRAIT_FRAMING)) {
    assert.ok(ids.has(id), `cadrage orphelin : ${id}`);
  }
});

test("cadrage : haut-centre par défaut, réglage appliqué sinon", () => {
  assert.deepEqual(getPortraitFraming("kratos"), {
    objectFit: "cover",
    objectPosition: "50% 0%",
  });
  assert.deepEqual(getPortraitFraming(undefined), getPortraitFraming("inconnue"));
  assert.deepEqual(getPortraitFraming("ciri"), PORTRAIT_FRAMING.ciri);
});

test("portraits : chaque visuel est une URL absolue", () => {
  for (const [id, portrait] of Object.entries(portraits.items)) {
    assert.match((portrait as { url: string }).url, /^https:\/\//, id);
  }
});

test("portraits : aucun visuel ne vient d'une page d'acteur ou d'homonymie", () => {
  for (const [id, portrait] of Object.entries(portraits.items)) {
    const entry = portrait as { url: string; file?: string };
    assert.doesNotMatch(entry.url, /Jeff_Schine|_disambiguation/i, id);
  }
});
