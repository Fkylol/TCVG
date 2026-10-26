import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Nouveautés boostées (migration 036). À 571 cartes, les dix dernières ajoutées
 * ne sortaient que dans ~12 % des boosters Mix : on verrouille ici la pondération
 * qui les met en avant pendant sept jours, et surtout la stabilité de `added_at`
 * (une réécriture par `db:cards` remettrait tout le catalogue en « nouveau »).
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/036_nouveautes_boostees.sql"),
  "utf8",
);
const SYNC = fs.readFileSync(path.join(process.cwd(), "scripts/db-cards.ts"), "utf8");

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("nouveautés : une date d'entrée stable, jamais réécrite par db:cards", () => {
  assert.match(MIGRATION, /alter table public\.cards\s+add column if not exists added_at timestamptz/);
  assert.match(MIGRATION, /alter column added_at set default now\(\)/);
  assert.match(MIGRATION, /alter column added_at set not null/);
  // Le script de synchronisation ne doit pas toucher à la colonne, sinon toutes
  // les cartes redeviennent « récentes » à chaque déploiement.
  assert.doesNotMatch(SYNC, /added_at/);
});

test("nouveautés : la vue de tirage expose added_at", () => {
  const view = MIGRATION.slice(
    MIGRATION.indexOf("create or replace view public.playable_cards"),
    MIGRATION.indexOf("-- ————— 4."),
  );
  assert.match(view, /c\.added_at/);
  assert.match(view, /where c\.active/);
});

test("nouveautés : poids multiplié pour les cartes récentes, 1 sinon", () => {
  const pick = block("_pick_card");
  assert.match(pick, /p_boost numeric default 1/);
  assert.match(pick, /p_window interval default '0 days'/);
  assert.match(pick, /c\.added_at > now\(\) - p_window/);
  assert.match(pick, /then p_boost\s+else 1::numeric/);
  // Le tirage reste aléatoire : pas de tri qui favoriserait un identifiant.
  assert.doesNotMatch(pick, /order by (?!id)/);
});

test("nouveautés : les réglages sont lus une fois par paquet", () => {
  const draw = block("_draw_cards");
  assert.match(draw, /key = 'new_card_boost'/);
  assert.match(draw, /key = 'new_card_window_days'/);
  assert.match(draw, /public\._pick_card\(p_pool, v_rarity, v_exclude, v_boost, v_window\)/);
  assert.match(draw, /jsonb_build_object\(\s*'id', v_card/);
});

test("nouveautés : les réglages existent avec les valeurs voulues", () => {
  assert.match(MIGRATION, /\('new_card_boost', '5'::jsonb\)/);
  assert.match(MIGRATION, /\('new_card_window_days', '7'::jsonb\)/);
});
