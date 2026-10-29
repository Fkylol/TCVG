import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const MIGRATION = read("supabase/migrations/067_boosters_kyara.sql");
const DATA = read("src/lib/data.ts");
const BOOSTERS_PAGE = read("src/app/(game)/boosters/page.tsx");
const PICKER = read("src/components/booster-picker.tsx");
const ACTIONS = read("src/app/actions.ts");
const REVEAL = read("src/components/booster-reveal.tsx");

test("planchers : quatrième UC+, cinquième Rare+, sans sortir du pool", () => {
  assert.match(MIGRATION, /array\['C', 'C', 'C', 'UC', 'R'\]/);
  assert.match(MIGRATION, /v_index = 4[\s\S]*?'uncommon'/);
  assert.match(MIGRATION, /v_index >= 5[\s\S]*?'rare'/);
  assert.match(MIGRATION, /_pick_card\(p_pool, v_order\[v_step\]/);
  assert.match(MIGRATION, /if v_card is null and not v_strict then/);
  assert.match(MIGRATION, /pg_get_functiondef\('public\._draw_cards\(text\[\],integer,jsonb\)'::regprocedure\)/);
  assert.match(MIGRATION, /v_new_roll text := \$new_roll\$/);
  assert.match(MIGRATION, /v_new_loop text := \$new_loop\$/);
});

test("compteurs : pity et rythme doré ne changent que sur les packs permanents", () => {
  assert.match(MIGRATION, /standard_boosters_opened integer not null default 0/);
  assert.match(MIGRATION, /pity_mythic integer not null default 0/);
  assert.match(MIGRATION, /join public\.booster_types bt on bt\.slug = o\.pack_slug[\s\S]*?bt\.season is null/);
  assert.match(MIGRATION, /if v_pack\.season is not null then\s+return public\._draw_cards/);
  assert.match(MIGRATION, /standard_boosters_opened = standard_boosters_opened \+ 1/);
  assert.match(MIGRATION, /when v_mythic_pool is null then pity_mythic/);
  assert.match(MIGRATION, /else pity_mythic \+ 1/);
  assert.match(MIGRATION, /when exists \([\s\S]*?entry ->> 'rarity' = 'L'[\s\S]*?\) then 0/);
  assert.match(MIGRATION, /foreach v_name in array array\['_open_pack_stock', 'open_pack'\]/);
  assert.match(MIGRATION, /_draw_booster_kyara\(v_uid, v_pack\.slug, v_pool, v_rates\)/);
});

test("garanties spéciales : règles configurables et signalées par carte", () => {
  assert.match(MIGRATION, /booster_guarantee_mythic_every/);
  assert.match(MIGRATION, /booster_golden_every/);
  assert.match(MIGRATION, /booster_divine_chance/);
  assert.match(MIGRATION, /'booster_special', v_special/);
  assert.match(MIGRATION, /'guarantee_type'/);
  assert.match(ACTIONS, /guaranteeType: card\.guarantee_type/);
  assert.match(ACTIONS, /boosterSpecial: card\.booster_special/);
  assert.match(REVEAL, /guaranteeType\?:/);
  assert.match(REVEAL, /entry\.guaranteed/);
  assert.match(REVEAL, /entry\.boosterSpecial/);
});

test("stats et interface : compteurs et garanties reflètent le serveur", () => {
  assert.match(MIGRATION, /'has_mythic', v_rarities/);
  assert.match(MIGRATION, /'has_high_rarity', v_rarities/);
  assert.match(MIGRATION, /'slot_4_min_rank', 2/);
  assert.match(MIGRATION, /'slot_5_min_rank', 3/);
  assert.match(DATA, /standard_boosters_opened/);
  assert.match(DATA, /pity_mythic/);
  assert.match(DATA, /hasMythic: chances\.has_mythic === true/);
  assert.match(DATA, /hasHighRarity: chances\.has_high_rarity === true/);
  assert.match(BOOSTERS_PAGE, /standardBoostersOpened=\{booster\.profile\.standardBoostersOpened\}/);
  assert.match(BOOSTERS_PAGE, /pityMythic=\{booster\.profile\.pityMythic\}/);
  assert.match(PICKER, /prochain dans/);
  assert.match(PICKER, /Pity Mythique au/);
});
