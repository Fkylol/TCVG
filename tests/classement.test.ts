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
const PAGE = read("src/app/(pages)/classement/page.tsx");

test("classement : le score de collection remplace le simple compteur", () => {
  assert.match(MIGRATION, /collection_score bigint/);
  assert.match(MIGRATION, /sum\(k\.quality\)/);
  assert.match(
    MIGRATION,
    /order by collection_score desc, unique_cards desc, total_cards desc/,
  );
  // La page annonce que les comptes sans booster ouvert sont exclus.
  assert.match(MIGRATION, /where coalesce\(p\.boosters_opened, 0\) > 0/);
  assert.match(PAGE, /collection_score\.toLocaleString/);
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
