import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * « Ouvrir un booster » depuis une fiche verrouillée doit arriver sur le pack
 * qui peut réellement donner la carte. Le lien dépend de `card_booster_chances`,
 * qui a longtemps échoué en silence (colonne `price_pixels` supprimée) : la
 * fiche retombait alors sur `/boosters` sans sélection. Ces tests verrouillent
 * le calcul SQL et le lien.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/039_chances_booster_par_carte.sql"),
  "utf8",
);

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

test("chances : le calcul ne lit plus de colonne supprimée", () => {
  assert.match(MIGRATION, /create or replace function public\.card_booster_chances\(/);
  // Corps de la fonction seulement : le bloc de contrôle final cite la colonne
  // supprimée pour vérifier qu'elle ne revient pas.
  const body = MIGRATION.slice(MIGRATION.indexOf("as $$"), MIGRATION.indexOf("$$;"));
  assert.doesNotMatch(body, /price_pixels/);
});

test("chances : pool jouable, genre strict et packs ouvrables seulement", () => {
  assert.match(MIGRATION, /from public\.playable_cards c/);
  assert.match(MIGRATION, /join public\.card_genres cg on cg\.card_id = c\.id/);
  assert.match(MIGRATION, /coalesce\(v_pool, 0\) < v_min/);
  assert.match(MIGRATION, /if not v_has or coalesce\(v_pool, 0\) < v_min then/);
  assert.match(MIGRATION, /v_chance := 1 - power\(1 - v_slot, v_type\.cards_count\)/);
});

test("chances : une carte retirée ne sort d'aucun booster", () => {
  assert.match(MIGRATION, /if not found then\s+return v_out;/);
});

test("fiche : le bouton pointe vers le pack au meilleur taux", () => {
  const page = source("src/app/(game)/card/[id]/page.tsx");
  assert.match(page, /href=\{bestChance \? `\/boosters\?pack=\$\{bestChance\.slug\}` : "\/boosters"\}/);
  assert.match(page, /const bestChance = chances\[0\] \?\? null;/);
});

test("boosters : le pack demandé dans l'URL est présélectionné", () => {
  const page = source("src/app/(game)/boosters/page.tsx");
  assert.match(page, /initialPackId=\{packParam \?\? null\}/);
  const picker = source("src/components/booster-picker.tsx");
  assert.match(picker, /initialPackId && packs\.some\(\(pack\) => pack\.id === initialPackId\)/);
});

test("fiche : plus de prix dans les chances, les boosters sont gratuits", () => {
  const data = source("src/lib/data.ts");
  const type = data.slice(
    data.indexOf("export type BoosterChance"),
    data.indexOf("};", data.indexOf("export type BoosterChance")),
  );
  assert.doesNotMatch(type, /price/);
  const page = source("src/app/(game)/card/[id]/page.tsx");
  assert.doesNotMatch(page, /chance\.price/);
});
