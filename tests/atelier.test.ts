import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import {
  capRarity,
  rarityFromRank,
  slugify,
  uniqueCardId,
  validateDraft,
  type CardDraft,
} from "../src/lib/atelier-core";
import { ATELIER_CARDS, ATELIER_ENTRIES, ATELIER_GENRES } from "../src/lib/atelier-data";
import { GENRES } from "../src/lib/card-genres";
import { CARDS, UNIVERSES, findDuplicateCards } from "../src/lib/cards";
import { saveDraft } from "../src/lib/atelier-store";

const CONTEXT = {
  universes: Object.keys(UNIVERSES),
  cards: CARDS,
  genres: GENRES.map((genre) => genre.slug),
};

function draft(overrides: Partial<CardDraft> = {}): CardDraft {
  return {
    id: "sylvanas-coursevent",
    name: "Sylvanas Coursevent",
    universe: "wow",
    emoji: "🏹",
    rarity: "UR",
    genres: ["mmo"],
    lore: { tagline: "La reine banshee", bio: "Ranger générale morte au champ de bataille." },
    portrait: {
      url: "https://static.wikia.nocookie.net/wow/images/a/ab/Sylvanas.png",
      source: "fandom",
      width: 600,
      height: 900,
    },
    ...overrides,
  };
}

test("atelier : identifiant lisible, sans accents ni doublons", () => {
  assert.equal(slugify("Le Duc de Paille"), "le-duc-de-paille");
  assert.equal(slugify("César"), "cesar");
  assert.equal(slugify("  Kratos  "), "kratos");
  assert.equal(slugify("!!!"), "");

  assert.equal(uniqueCardId("Kratos", ["kratos"]), "kratos-2");
  assert.equal(uniqueCardId("Kratos", ["kratos", "kratos-2"]), "kratos-3");
  assert.equal(uniqueCardId("Coursevent", []), "coursevent");
});

test("atelier : la rareté suit les parts cibles du catalogue", () => {
  assert.equal(rarityFromRank(0), "L");
  assert.equal(rarityFromRank(0.01), "L");
  assert.equal(rarityFromRank(0.02), "UR");
  assert.equal(rarityFromRank(0.06), "UR");
  assert.equal(rarityFromRank(0.07), "SR");
  assert.equal(rarityFromRank(0.17), "SR");
  assert.equal(rarityFromRank(0.18), "R");
  assert.equal(rarityFromRank(0.37), "R");
  assert.equal(rarityFromRank(0.38), "UC");
  assert.equal(rarityFromRank(0.63), "UC");
  assert.equal(rarityFromRank(0.64), "C");
  assert.equal(rarityFromRank(1), "C");
});

test("atelier : les plafonds de franchise font descendre d'un palier", () => {
  assert.equal(capRarity("L", {}, { L: 3, UR: 8 }), "L");
  assert.equal(capRarity("L", { L: 3 }, { L: 3, UR: 8 }), "UR");
  assert.equal(capRarity("UR", { UR: 8 }, { L: 3, UR: 8 }), "SR");
  assert.equal(capRarity("C", { C: 99 }, { L: 3, UR: 8 }), "C");
});

test("atelier : un brouillon complet passe la validation", () => {
  assert.deepEqual(validateDraft(draft(), CONTEXT), { ok: true });
});

test("atelier : les refus sont explicites", () => {
  const cases: [Partial<CardDraft>, RegExp][] = [
    [{ id: "Sylvanas!" }, /identifiant invalide/],
    [{ name: "" }, /nom du personnage manquant/],
    [{ universe: "nintendo64" }, /franchise inconnue/],
    [{ rarity: "XX" as CardDraft["rarity"] }, /rareté inconnue/],
    [{ emoji: "  " }, /emoji manquant/],
    [{ genres: ["sport" as never] }, /genre inconnu/],
    [{ lore: { tagline: "", bio: "x" } }, /accroche manquante/],
    [{ lore: { tagline: "x", bio: "" } }, /biographie manquante/],
    [
      {
        portrait: {
          url: "javascript:alert(1)",
          source: "fandom",
          width: 500,
          height: 700,
        },
      },
      /URL de visuel invalide/,
    ],
  ];

  for (const [override, expected] of cases) {
    const result = validateDraft(draft(override), CONTEXT);
    assert.equal(result.ok, false, `aurait dû refuser : ${JSON.stringify(override)}`);
    if (!result.ok) assert.match(result.errors.join(" | "), expected);
  }
});

test("atelier : ni identifiant ni personnage en double", () => {
  const sameId = validateDraft(draft({ id: "kratos", name: "Autre" }), CONTEXT);
  assert.equal(sameId.ok, false);
  if (!sameId.ok) assert.match(sameId.errors.join(" | "), /identifiant déjà utilisé/);

  const existing = CARDS.find((card) => card.universe === "godofwar");
  assert.ok(existing);
  const sameName = validateDraft(draft({ id: "kratos-bis", universe: "godofwar", name: existing.name }), CONTEXT);
  assert.equal(sameName.ok, false);
  if (!sameName.ok) assert.match(sameName.errors.join(" | "), /déjà dans cette franchise/);
});

test("atelier : un brouillon invalide n'écrit rien sur le disque", async () => {
  const file = "src/data/atelier-cards.json";
  const before = await fs.readFile(file, "utf8");

  const result = await saveDraft(draft({ universe: "franchise-inconnue" }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.errors.join(" | "), /franchise inconnue/);

  assert.equal(await fs.readFile(file, "utf8"), before);
});

test("atelier : les ajouts rejoignent le catalogue sans le casser", () => {
  assert.equal(ATELIER_CARDS.length, ATELIER_ENTRIES.length);
  assert.equal(Object.keys(ATELIER_GENRES).length, ATELIER_ENTRIES.length);
  assert.ok(CARDS.length >= 557);
  for (const card of ATELIER_CARDS) {
    assert.ok(CARDS.some((entry) => entry.id === card.id), `${card.id} absent du catalogue`);
  }
  assert.deepEqual(findDuplicateCards(CARDS), []);
});
