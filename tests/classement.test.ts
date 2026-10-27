import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { frameProgress, getFrame, type FrameStats } from "../src/lib/frames.config";

function progress(id: string, value: FrameStats) {
  const frame = getFrame(id);
  assert.ok(frame);
  return frameProgress(frame, value);
}

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const MIGRATION = read("supabase/migrations/030_classement_score.sql");
const SYNC = read("scripts/db-cards.ts");
const PAGE = read("src/app/(wide)/classement/page.tsx");
const BOARD = read("src/components/leaderboard-board.tsx");
const RANKS = read("src/lib/leaderboard-ranks.ts");
const HEADER = read("src/components/site-header.tsx");
const FOOTER = read("src/components/site-footer.tsx");

test("classement : le score de collection remplace le simple compteur", () => {
  assert.match(MIGRATION, /collection_score bigint/);
  assert.match(MIGRATION, /sum\(k\.quality\)/);
  assert.match(
    MIGRATION,
    /order by collection_score desc, unique_cards desc, total_cards desc/,
  );
  // La page annonce que les comptes sans booster ouvert sont exclus.
  assert.match(MIGRATION, /where coalesce\(p\.boosters_opened, 0\) > 0/);
  assert.match(BOARD, /collection_score\.toLocaleString/);
});

test("classement : page large, podium et barre épinglée", () => {
  // La page est servie par la colonne large, pas par les pages de texte.
  assert.match(PAGE, /<LeaderboardBoard /);
  assert.match(PAGE, /Le classement est momentanément indisponible/);
  // La barre du joueur reste en bas de l'écran pendant le défilement.
  assert.match(BOARD, /fixed inset-x-0 bottom-0/);
  assert.match(BOARD, /export function LeaderboardBoard/);
  // La recherche filtre sur le pseudo, sans tenir compte des accents.
  assert.match(BOARD, /normalize\(row\.username\)\.includes\(needle\)/);
});

test("classement : les rangs du podium se règlent dans un seul fichier", () => {
  // Les libellés vivent dans `leaderboard-ranks.ts`, pas dans le composant.
  assert.match(RANKS, /label: "Souverain"/);
  assert.match(RANKS, /label: "Régent"/);
  assert.match(RANKS, /label: "Vizir"/);
  for (const old of ["Champion", "Dauphin", "Podium"]) {
    assert.doesNotMatch(RANKS, new RegExp(`label: "${old}"`), `ancien rang ${old}`);
  }
  assert.match(BOARD, /from "@\/lib\/leaderboard-ranks"/);
  assert.match(BOARD, /podiumRank\(row\.rank\)/);
  // Le composant ne redéfinit plus ses propres libellés de rang.
  assert.doesNotMatch(BOARD, /label: "Souverain"/);
});

test("classement : la couverture de l'album se dit en pourcentage, sans titre inventé", () => {
  // Le jeu n'a qu'un système de rang, celui du podium : aucun titre de niveau
  // ne doit revenir dans la page de classement.
  for (const invented of ["Légende", "Virtuose", "Collectionneur", "Initié", "Apprenti"]) {
    assert.doesNotMatch(BOARD, new RegExp(invented), `titre de couverture ${invented}`);
  }
  assert.doesNotMatch(BOARD, /function tier/);

  // La couverture se lit en clair, aux trois endroits où elle est affichée.
  assert.match(BOARD, /function albumShare\(ratio: number\)/);
  assert.match(BOARD, /\$\{Math\.round\(ratio \* 100\)\} % de l'album/);
  assert.equal((BOARD.match(/albumShare\(/g) ?? []).length, 4, "trois appels et sa définition");
});

test("classement : l'onglet vit dans l'en-tête, plus dans le pied de page", () => {
  assert.match(HEADER, /<NavLink href="\/classement">Classement<\/NavLink>/);
  assert.doesNotMatch(FOOTER, /FooterLink href="\/classement"/);
});

test("classement : la qualité des cartes est synchronisée en base", () => {
  assert.match(MIGRATION, /add column if not exists quality smallint/);
  assert.match(SYNC, /cardStats\(card\)\.quality/);
  assert.match(SYNC, /quality = excluded\.quality/);
});

function stats(owned: number): FrameStats {
  return {
    totalActive: 100,
    ownedDistinct: owned,
    rarities: { UR: { total: 10, owned: 0 }, L: { total: 4, owned: 0 } },
    genres: {},
    franchises: [],
    sales: 0,
    referralsPaid: 0,
    boostersOpened: 0,
    streakDays: 0,
    createdAt: "2027-01-01T00:00:00Z",
    lastSeenAt: null,
  };
}

test("cadres : la progression suit les pourcentages de l'album", () => {
  const early = progress("jade", stats(8));
  assert.equal(early.current, 8);
  assert.equal(early.target, 15);
  assert.equal(early.percent, 53);
  assert.equal(early.reached, false);

  const gold = progress("gold", stats(60));
  assert.equal(gold.target, 60);
  assert.equal(gold.reached, true);

  const prism = progress("prism", stats(89));
  assert.equal(prism.reached, false);

  const steel = progress("steel", stats(0));
  assert.equal(steel.reached, true);
});
