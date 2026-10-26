import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import type { Rarity } from "../src/lib/cards";
import {
  adjustTargets,
  chooseMatch,
  distributeRarities,
  log10p1,
  nameVariants,
  normalizeName,
  percentileRanks,
  popularityScores,
  scoreMatch,
  targetCounts,
  tierGap,
  type DistributionCard,
  type MatchFacts,
} from "../src/lib/popularity";
import {
  FRANCHISE_CAPS,
  RARITY_ORDER,
  RARITY_SHARES,
} from "../src/lib/rarity-distribution.config";
import { allBlockingPass, runControls, type ControlCard } from "../scripts/popularity/lib/controls";
import { buildApplySql } from "../scripts/popularity/apply";
import { ROLLBACK_SQL } from "../scripts/popularity/rollback";

const ROOT = path.resolve(import.meta.dirname, "..");

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

function facts(overrides: Partial<MatchFacts> = {}): MatchFacts {
  return {
    id: "Q1",
    labels: ["Arthas Menethil"],
    descriptions: ["personnage de Warcraft"],
    isFictionalCharacter: true,
    hasWikipediaArticle: true,
    inFranchiseWork: true,
    listedByFranchise: false,
    mentionsFranchise: true,
    rejected: false,
    sitelinks: 15,
    ...overrides,
  };
}

// ————————————————————————————————————————————————————————————
//  Noms et correspondance
// ————————————————————————————————————————————————————————————

test("noms : accents, casse et ponctuation ne changent pas l'identité", () => {
  assert.equal(normalizeName("Arthás  Menethil"), "arthas menethil");
  assert.equal(normalizeName("L'Ombre — Jaina"), "l ombre jaina");
  assert.ok(nameVariants("Jean-Luc Picard").includes("jean luc picard"));
  assert.ok(nameVariants("Le Chevalier").includes("chevalier"));
});

test("correspondance : barème complet et refus des pages d'homonymie", () => {
  const complete = scoreMatch(facts(), "Arthas Menethil");
  assert.equal(complete.score, 1);
  assert.deepEqual(complete.reasons, [
    "nom exact",
    "personnage fictif",
    "présent dans une œuvre de la franchise",
    "article Wikipédia",
  ]);

  // Nom + personnage + article, sans lien de franchise : 0,70, sous le seuil.
  const partial = scoreMatch(
    facts({ inFranchiseWork: false, listedByFranchise: false, mentionsFranchise: false }),
    "Arthas Menethil",
  );
  assert.equal(partial.score, 0.7);
  assert.equal(partial.franchiseLink, false);

  // Tout est faux : aucun indice, aucun crédit.
  const absent = scoreMatch(
    {
      ...facts(),
      labels: ["Catherwood"],
      isFictionalCharacter: false,
      hasWikipediaArticle: false,
      inFranchiseWork: false,
      listedByFranchise: false,
      mentionsFranchise: false,
      sitelinks: 0,
    },
    "Arthas Menethil",
  );
  assert.equal(absent.score, 0);

  // Page d'homonymie : rejetée d'office, quelle que soit la suite.
  const disambiguation = scoreMatch(facts({ rejected: true }), "Arthas Menethil");
  assert.equal(disambiguation.score, 0);
  assert.match(disambiguation.reasons[0], /homonymie|liste|œuvre/);
});

test("correspondance : seuil et écart avec le deuxième candidat", () => {
  const best = scoreMatch(facts(), "Arthas Menethil");
  const equal = { ...best, id: "Q2" };
  const far = { ...best, id: "Q3", score: 0.7 };

  // Deux candidats à égalité : aucun choix possible.
  assert.equal(chooseMatch([best, equal]).accepted, false);
  // Un seul candidat au-dessus du seuil : accepté.
  assert.equal(chooseMatch([best, far]).accepted, true);
  // Sous le seuil, même seul : refusé.
  assert.equal(chooseMatch([far]).accepted, false);
});

// ————————————————————————————————————————————————————————————
//  Score de popularité
// ————————————————————————————————————————————————————————————

test("percentiles : départage déterministe des égalités par identifiant", () => {
  const ranks = percentileRanks([
    { id: "b", pageviews: 10, languages: 1 },
    { id: "a", pageviews: 10, languages: 1 },
    { id: "c", pageviews: 100, languages: 3 },
  ]);
  assert.equal(ranks.get("a")!.pageviews, 0);
  assert.equal(ranks.get("b")!.pageviews, 0.5);
  assert.equal(ranks.get("c")!.pageviews, 1);
  // Les égalités sont départagées : aucun rang identique.
  assert.notEqual(ranks.get("a")!.pageviews, ranks.get("b")!.pageviews);
});

test("score : données complètes, partielles et absentes restent dans 0–100", () => {
  const scores = popularityScores([
    { id: "fort", pageviews: log10p1(900_000), languages: log10p1(40) },
    { id: "moyen", pageviews: log10p1(20_000), languages: log10p1(8) },
    { id: "faible", pageviews: 0, languages: 0 },
  ]);

  assert.equal(scores.get("fort"), 100);
  assert.equal(scores.get("faible"), 0);
  const middle = scores.get("moyen")!;
  assert.ok(middle > 0 && middle < 100, `score intermédiaire attendu, obtenu ${middle}`);
  // 70 / 30 : le milieu tombe exactement sur 50.
  assert.equal(middle, 50);
});

// ————————————————————————————————————————————————————————————
//  Répartition par rang
// ————————————————————————————————————————————————————————————

function cards(count: number, franchises = 10): DistributionCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${String(index).padStart(3, "0")}`,
    franchiseId: `f-${index % franchises}`,
    rarity: "C" as Rarity,
    popularityScore: count - index,
  }));
}

test("parts cibles : 594 cartes donnent exactement 12/30/65/119/154/214", () => {
  const counts = targetCounts(594, RARITY_SHARES);
  assert.deepEqual(counts, { L: 12, UR: 30, SR: 65, R: 119, UC: 154, C: 214 });
  assert.equal(
    RARITY_ORDER.reduce((sum, rarity) => sum + counts[rarity], 0),
    594,
  );
});

test("répartition : les effectifs respectent les parts quand les plafonds le permettent", () => {
  const population = cards(594, 40);
  const result = distributeRarities(population, { shares: RARITY_SHARES, caps: FRANCHISE_CAPS });
  assert.deepEqual(result.counts, targetCounts(594, RARITY_SHARES));
  assert.equal(result.capped.length, 0);
});

test("répartition : quand les plafonds rendent la cible inatteignable, le contrôle bloque", () => {
  // Deux franchises ne peuvent fournir que 6 Mythiques au lieu de 12 : le
  // calcul descend les cartes d'un palier et le contrôle b le signale.
  const population = cards(594, 2);
  const result = distributeRarities(population, { shares: RARITY_SHARES, caps: FRANCHISE_CAPS });
  const targets = targetCounts(594, RARITY_SHARES);

  assert.ok(result.counts.L < targets.L);
  assert.ok(result.capped.length > 0);
  assert.equal(result.capped.every((entry) => entry.from === "L" || entry.from === "UR"), true);
});

test("répartition : aucun plafond de franchise dépassé", () => {
  const population = cards(594, 4);
  const result = distributeRarities(population, { shares: RARITY_SHARES, caps: FRANCHISE_CAPS });

  const perFranchise = new Map<string, Record<string, number>>();
  for (const card of population) {
    const rarity = result.rarities.get(card.id)!;
    const slots = perFranchise.get(card.franchiseId) ?? {};
    slots[rarity] = (slots[rarity] ?? 0) + 1;
    perFranchise.set(card.franchiseId, slots);
  }
  for (const slots of perFranchise.values()) {
    assert.ok((slots.L ?? 0) <= FRANCHISE_CAPS.L!, `Mythiques : ${slots.L}`);
    assert.ok((slots.UR ?? 0) <= FRANCHISE_CAPS.UR!, `Légendaires : ${slots.UR}`);
  }
});

test("répartition : un palier peut être interdit aux cartes non vérifiées", () => {
  const population = cards(594, 40);
  const result = distributeRarities(population, {
    shares: RARITY_SHARES,
    caps: FRANCHISE_CAPS,
    eligible: { L: (card) => card.id !== "card-000" },
  });
  assert.notEqual(result.rarities.get("card-000"), "L");
  assert.equal(result.counts.L, targetCounts(594).L);
});

test("parts réduites : le manque d'Épiques est reporté vers les paliers plus communs", () => {
  const base = targetCounts(594, RARITY_SHARES);
  const adjusted = adjustTargets(base, { L: 5, UR: base.UR, SR: base.SR });
  assert.equal(adjusted.targets.L, 5);
  assert.equal(adjusted.reduced.L, base.L - 5);
  assert.equal(adjusted.targets.UR, base.UR);
  assert.equal(adjusted.targets.SR, base.SR);
  assert.equal(RARITY_ORDER.reduce((sum, rarity) => sum + adjusted.targets[rarity], 0), 594);
  assert.deepEqual(
    { R: adjusted.targets.R, UC: adjusted.targets.UC, C: adjusted.targets.C },
    { R: base.R + 2, UC: base.UC + 2, C: base.C + 3 },
  );
});

test("répartition : override et verrou passent avant le rang", () => {
  const population = cards(100, 5);
  population[99].rarityOverride = "L"; // la carte la moins populaire
  population[0].rarityLocked = true; // la plus populaire, verrouillée en Commune
  population[0].rarity = "C";

  const result = distributeRarities(population, { shares: RARITY_SHARES, caps: FRANCHISE_CAPS });
  assert.equal(result.rarities.get("card-099"), "L");
  assert.equal(result.rarities.get("card-000"), "C");
  assert.equal(result.fixed.get("card-099"), "override");
  assert.equal(result.fixed.get("card-000"), "locked");
  // La carte forcée en Mythique consomme une place du palier.
  assert.equal(result.counts.L, targetCounts(100).L);
});

test("répartition : écart de paliers compté pour le rapport", () => {
  assert.equal(tierGap("C", "L"), 5);
  assert.equal(tierGap("SR", "SR"), 0);
});

// ————————————————————————————————————————————————————————————
//  Contrôles automatiques
// ————————————————————————————————————————————————————————————

function controlCards(count: number): ControlCard[] {
  const targets = targetCounts(count);
  const list: ControlCard[] = [];
  let index = 0;
  for (const rarity of RARITY_ORDER) {
    for (let taken = 0; taken < targets[rarity]; taken += 1) {
      list.push({
        id: `c-${index++}`,
        name: `Carte ${index}`,
        rarity: "C",
        newRarity: rarity,
        franchiseId: `f-${index % 40}`,
        franchiseName: `Franchise ${index % 40}`,
        confidence: 0.95,
        status: "auto",
      });
    }
  }
  return list;
}

test("contrôles : tout passe quand les données sont saines", () => {
  const list = controlCards(594);
  const counts = targetCounts(594);
  const verdicts = runControls({
    cards: list,
    counts,
    genres: [
      { slug: "rpg", name: "RPG", counts: { C: 10, UC: 8, R: 5, SR: 3, UR: 1, L: 1 } },
    ],
    snapshotVerified: true,
    testsPassed: true,
  });
  assert.equal(allBlockingPass(verdicts), true, verdicts.map((v) => `${v.id}:${v.detail}`).join(" · "));
});

test("contrôles : un effectif faux bloque l'application", () => {
  const list = controlCards(594);
  const counts = { ...targetCounts(594), L: 15 };
  const verdicts = runControls({
    cards: list,
    counts,
    genres: [{ slug: "rpg", name: "RPG", counts: { C: 10, UC: 8, R: 5, SR: 3, UR: 1, L: 1 } }],
    snapshotVerified: true,
    testsPassed: true,
  });
  assert.equal(allBlockingPass(verdicts), false);
  assert.equal(verdicts.find((verdict) => verdict.id === "b")!.ok, false);
});

test("contrôles : un repli au-dessus de Rare bloque, la part rattachée reste informative", () => {
  const list = controlCards(594).map((card, index) =>
    index < 300 ? { ...card, status: "repli", confidence: 0 } : card,
  );
  const verdicts = runControls({
    cards: list,
    counts: targetCounts(594),
    genres: [{ slug: "rpg", name: "RPG", counts: { C: 10, UC: 8, R: 5, SR: 3, UR: 1, L: 1 } }],
    snapshotVerified: true,
    testsPassed: true,
  });
  assert.equal(verdicts.find((verdict) => verdict.id === "a1")!.ok, false);
  assert.equal(verdicts.find((verdict) => verdict.id === "a2")!.ok, false);
  const a3 = verdicts.find((verdict) => verdict.id === "a3")!;
  assert.equal(a3.ok, true);
  assert.equal(a3.blocking, false);
  assert.match(a3.detail, /49\.5 %/);
  assert.match(a3.detail, /majorité de repli/);
});

test("contrôles : une confiance trop basse bloque, une vérification explicite débloque", () => {
  const list = controlCards(594);
  const target = list.findIndex((card) => card.newRarity === "L");
  list[target] = { ...list[target], confidence: 0.85 };
  const blocked = runControls({
    cards: list,
    counts: targetCounts(594),
    genres: [{ slug: "rpg", name: "RPG", counts: { C: 10, UC: 8, R: 5, SR: 3, UR: 1, L: 1 } }],
    snapshotVerified: true,
    testsPassed: true,
  });
  assert.equal(blocked.find((verdict) => verdict.id === "a1")!.ok, false);

  list[target] = { ...list[target], verified: true };
  const verified = runControls({
    cards: list,
    counts: targetCounts(594),
    genres: [{ slug: "rpg", name: "RPG", counts: { C: 10, UC: 8, R: 5, SR: 3, UR: 1, L: 1 } }],
    snapshotVerified: true,
    testsPassed: true,
  });
  assert.equal(verified.find((verdict) => verdict.id === "a1")!.ok, true);
});

test("contrôles : un genre sans carte Rare est signalé sans bloquer", () => {
  const verdicts = runControls({
    cards: controlCards(594),
    counts: targetCounts(594),
    genres: [
      { slug: "rpg", name: "RPG", counts: { C: 10, UC: 8, R: 5, SR: 3, UR: 1, L: 1 } },
      { slug: "sport", name: "Sport", counts: { C: 1, UC: 0, R: 0 } },
    ],
    snapshotVerified: true,
    testsPassed: true,
  });
  assert.equal(verdicts.find((verdict) => verdict.id === "f")!.ok, false);
  assert.equal(verdicts.find((verdict) => verdict.id === "f2")!.blocking, false);
});

// ————————————————————————————————————————————————————————————
//  Application et retour arrière
// ————————————————————————————————————————————————————————————

test("application : un seul bloc atomique, garde-fous compris", () => {
  const sql = buildApplySql([{ id: "arthas", rarity: "L" }], 1);

  // Un unique `do $$ … $$` : toute erreur annule l'ensemble.
  assert.match(sql.trim(), /^do \$\$/);
  assert.equal((sql.match(/\bdo \$\$/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /\bcommit\s*;/i);

  // Rareté d'origine conservée, version incrémentée, verrou posé.
  assert.match(sql, /rarity_v1 = coalesce\(c\.rarity_v1, c\.rarity\)/);
  assert.match(sql, /rarity_locked = true/);
  assert.match(sql, /rarity_version = v_version/);

  // Marché : annulations avec restitution, jamais l'historique des ventes.
  assert.match(sql, /cancel_reason = 'rareté mise à jour'/);
  assert.match(sql, /'listing_cancelled'/);
  assert.match(sql, /'order_cancelled'/);
  assert.match(sql, /annulation_ordre/);
  assert.doesNotMatch(sql, /delete from public\.trades/);

  // Journal et bandeau.
  assert.match(sql, /insert into public\.rarity_runs/);
  assert.match(sql, /'rarity_update'/);
});

test("retour arrière : restaure exactement la rareté d'avant", () => {
  assert.match(ROLLBACK_SQL, /set rarity = rarity_v1/);
  assert.match(ROLLBACK_SQL, /rarity_v1 = null/);
  assert.match(ROLLBACK_SQL, /rarity_version = 0/);
  assert.match(ROLLBACK_SQL, /rarity_locked = false/);
  assert.match(ROLLBACK_SQL, /where rarity_v1 is not null/);
  assert.match(ROLLBACK_SQL, /delete from public\.game_config where key = 'rarity_update'/);
  assert.match(ROLLBACK_SQL.trim(), /^do \$\$/);
});

test("scripts : l'application refuse de tourner sans --yes", () => {
  const apply = read("scripts/popularity/apply.ts");
  assert.match(apply, /if \(!YES\)/);
  assert.match(apply, /allBlockingPass\(verdicts\)/);
  // Les tests font partie des contrôles bloquants.
  assert.match(apply, /runTests\(\)/);
  assert.match(apply, /if \(!tests\.ok\)/);
});

test("pipeline : les quatre commandes du cahier des charges existent", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  for (const name of [
    "popularity:match",
    "popularity:fetch",
    "popularity:score",
    "rarity:preview",
    "rarity:apply",
    "rarity:rollback",
  ]) {
    assert.ok(pkg.scripts[name], `script ${name} manquant`);
  }
});

test("pipeline : aucune requête aux API Wikimedia pendant une requête joueur", () => {
  // Les seuls appels réseau autorisés côté app sont Supabase ; Wikidata et
  // l'API de pages vues ne sont interrogées que par les scripts.
  for (const file of [
    "src/app/(pages)/raretes/page.tsx",
    "src/components/rarity-update-banner.tsx",
    "src/lib/popularity.ts",
    "src/lib/data.ts",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /query\.wikidata\.org|wikimedia\.org\/api|wikipedia\.org\/w\/api/, file);
  }

  // La page d'explication cite les sources : ce sont des liens, pas des appels.
  const page = read("src/app/(pages)/raretes/page.tsx");
  assert.doesNotMatch(page, /\bfetch\(/);
});
