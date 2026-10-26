import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptFandomPage,
  acceptWikidataCharacter,
  hostMatchesFranchise,
  nameMatches,
  type CharacterFacts,
  type FranchiseScope,
} from "../scripts/images/lib/strict";

/** Entité minimale : un personnage fictif par défaut, à surcharger au besoin. */
function character(overrides: Partial<CharacterFacts> & { id: string }): CharacterFacts {
  return {
    labels: [],
    isFictionalCharacter: true,
    isDisambiguation: false,
    isList: false,
    works: [],
    ...overrides,
  };
}

function scope(overrides: Partial<FranchiseScope> & { name: string }): FranchiseScope {
  return {
    anchors: [],
    works: [],
    characters: [],
    ...overrides,
  };
}

// Les faux positifs de la chasse précédente, retrouvés dans l'audit visuel.
const darkestDungeon = scope({
  name: "Darkest Dungeon",
  anchors: ["Q22672119"],
  works: ["Q22672119"],
});

test("Wikidata : « Croisé » refuse une église (lieu, pas un personnage)", () => {
  const church = character({
    id: "Q1234",
    labels: ["Croisé", "Vitry-le-Croisé"],
    isFictionalCharacter: false,
    works: ["Q22672119"],
  });
  const verdict = acceptWikidataCharacter(church, darkestDungeon, "Croisé");
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.reason, /personnage fictif/);
});

test("Wikidata : « Kirby » ne doit pas renvoyer Jack Kirby", () => {
  const jack = character({
    id: "Q311432",
    labels: ["Jack Kirby"],
    isFictionalCharacter: false,
  });
  const verdict = acceptWikidataCharacter(jack, scope({ name: "Kirby" }), "Kirby");
  assert.equal(verdict.ok, false);
});

test("Wikidata : « Kirby » accepte le personnage de la franchise", () => {
  const kirby = character({
    id: "Q752204",
    labels: ["Kirby"],
    works: ["Q1063326"],
  });
  const verdict = acceptWikidataCharacter(
    kirby,
    scope({ name: "Kirby", anchors: ["Q1063326"], works: ["Q1063326"] }),
    "Kirby",
  );
  assert.equal(verdict.ok, true);
  if (verdict.ok) assert.equal(verdict.confidence, "high");
});

test("Wikidata : « Luigi » ne doit pas renvoyer une rue allemande", () => {
  const street = character({
    id: "Q5678",
    labels: ["Obere Lichtenplatzer Straße"],
    isFictionalCharacter: false,
  });
  const verdict = acceptWikidataCharacter(street, scope({ name: "Super Mario" }), "Luigi");
  assert.equal(verdict.ok, false);
});

test("Wikidata : un homonyme sans lien avec la franchise est refusé", () => {
  // « Link » (personnage) existe, mais l'entité proposée vient d'une autre œuvre.
  const otherLink = character({ id: "Q999", labels: ["Link"], works: ["Q000"] });
  const verdict = acceptWikidataCharacter(
    otherLink,
    scope({ name: "The Legend of Zelda", anchors: ["Q12393"], works: ["Q12393"] }),
    "Link",
  );
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.reason, /aucun lien avec The Legend of Zelda/);
});

test("Wikidata : une page d'homonymie ou une liste est toujours refusée", () => {
  const disambiguation = character({ id: "Q1", labels: ["Sans"], isDisambiguation: true });
  assert.equal(acceptWikidataCharacter(disambiguation, scope({ name: "Undertale" }), "Sans").ok, false);

  const list = character({ id: "Q2", labels: ["Mario"], isList: true });
  assert.equal(acceptWikidataCharacter(list, scope({ name: "Super Mario" }), "Mario").ok, false);
});

test("Wikidata : « Samus » accepte « Samus Aran » (nom complet de la fiche)", () => {
  const samus = character({ id: "Q12345", labels: ["Samus Aran"], works: ["Q3781"] });
  const verdict = acceptWikidataCharacter(
    samus,
    scope({ name: "Metroid", anchors: ["Q3781"], works: ["Q3781"] }),
    "Samus",
  );
  assert.equal(verdict.ok, true);
  if (verdict.ok) assert.equal(verdict.confidence, "medium");
});

test("Wikidata : « Cloud » accepte « Cloud Strife » de Final Fantasy VII", () => {
  const cloud = character({ id: "Q1990", labels: ["Cloud Strife"], works: ["Q47436"] });
  const verdict = acceptWikidataCharacter(
    cloud,
    scope({ name: "Final Fantasy VII", anchors: ["Q47436"], works: ["Q47436"] }),
    "Cloud",
  );
  assert.equal(verdict.ok, true);
});

test("Wikidata : « Mario » accepte le personnage, pas le jeu homonyme", () => {
  const mario = character({ id: "Q12379", labels: ["Mario"], works: ["Q1063225"] });
  const verdict = acceptWikidataCharacter(
    mario,
    scope({ name: "Super Mario", anchors: ["Q1063225"], works: ["Q1063225"] }),
    "Mario",
  );
  assert.equal(verdict.ok, true);

  const game = character({
    id: "Q1063225",
    labels: ["Super Mario Bros."],
    isFictionalCharacter: false,
  });
  assert.equal(acceptWikidataCharacter(game, scope({ name: "Super Mario" }), "Mario").ok, false);
});

test("Wikidata : le rattachement par personnage cité (P674) suffit", () => {
  const zelda = character({ id: "Q42000", labels: ["Zelda"], works: [] });
  const verdict = acceptWikidataCharacter(
    zelda,
    scope({ name: "The Legend of Zelda", anchors: ["Q12393"], characters: ["Q42000"] }),
    "Zelda",
  );
  assert.equal(verdict.ok, true);
});

test("noms : comparaison stricte, jamais une simple sous-chaîne", () => {
  assert.equal(nameMatches("Kirby", ["Jack Kirby"]), false);
  assert.equal(nameMatches("Luigi", ["Luigi's Mansion"]), false);
  assert.equal(nameMatches("Terra", ["Terra Branford"]), true);
  assert.equal(nameMatches("Terra Branford", ["Terra"]), true);
  assert.equal(nameMatches("Kirby", ["Kirby (character)"]), true);
  assert.equal(nameMatches("Croisé", ["Vitry-le-Croisé"]), false);
});

test("Fandom : la page doit porter exactement le nom du personnage", () => {
  const refused = acceptFandomPage({
    title: "Croisé (église)",
    cardName: "Croisé",
    host: "darkestdungeon.fandom.com",
    franchiseName: "Darkest Dungeon",
    disambiguation: false,
    hasLeadImage: true,
  });
  assert.equal(refused.ok, false);

  const accepted = acceptFandomPage({
    title: "Croisé",
    cardName: "Croisé",
    host: "darkestdungeon.fandom.com",
    franchiseName: "Darkest Dungeon",
    disambiguation: false,
    hasLeadImage: true,
  });
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(accepted.confidence, "medium");
});

test("Fandom : une page d'homonymie ou sans image est refusée", () => {
  const base = {
    title: "Link",
    cardName: "Link",
    host: "zelda.fandom.com",
    franchiseName: "The Legend of Zelda",
    hasLeadImage: true,
  };
  assert.equal(acceptFandomPage({ ...base, disambiguation: true }).ok, false);
  assert.equal(acceptFandomPage({ ...base, disambiguation: false, hasLeadImage: false }).ok, false);
});

test("Fandom : le wiki doit correspondre à la franchise", () => {
  assert.equal(hostMatchesFranchise("zelda.fandom.com", "The Legend of Zelda"), true);
  assert.equal(hostMatchesFranchise("finalfantasy.fandom.com", "Final Fantasy IX"), true);
  assert.equal(hostMatchesFranchise("godofwar.fandom.com", "God of War"), true);
  assert.equal(hostMatchesFranchise("harrypotter.fandom.com", "Mass Effect"), false);

  const verdict = acceptFandomPage({
    title: "Liara",
    cardName: "Liara",
    host: "harrypotter.fandom.com",
    franchiseName: "Mass Effect",
    disambiguation: false,
    hasLeadImage: true,
  });
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.reason, /hors franchise/);
});

test("Fandom : les pages de catégorie, de fichier ou de liste sont refusées", () => {
  for (const title of ["Category:Characters", "File:Link.png", "List of Zelda characters"]) {
    const verdict = acceptFandomPage({
      title,
      cardName: "Link",
      host: "zelda.fandom.com",
      franchiseName: "The Legend of Zelda",
      disambiguation: false,
      hasLeadImage: true,
    });
    assert.equal(verdict.ok, false, title);
  }
});
