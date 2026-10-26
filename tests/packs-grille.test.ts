import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { PACKS, PACK_TILT } from "../src/lib/packs";

/**
 * Page Boosters : les dix packs sont visibles et ouvrables en permanence.
 * La rotation quotidienne a été retirée (migration 034) ; ces tests empêchent
 * son retour silencieux, côté interface comme côté base.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const PICKER = read("src/components/booster-picker.tsx");
const PAGE = read("src/app/(game)/boosters/page.tsx");
const ACTIONS = read("src/app/actions.ts");
const DATA = read("src/lib/data.ts");
const PACKS_SRC = read("src/lib/packs.ts");
const PACK = read("src/components/booster-pack.tsx");
const HOOK = read("src/lib/use-fit-title.ts");
const CSS = read("src/app/globals.css");
const SQL = read("supabase/migrations/035_packs_toujours_disponibles.sql");

test("les dix packs, dans l'ordre d'affichage demandé", () => {
  assert.deepEqual(
    PACKS.map((pack) => pack.id),
    [
      "mix",
      "action-aventure",
      "plateforme",
      "rpg",
      "mmo",
      "fps",
      "inde",
      "combat",
      "horreur",
      "strategie",
    ],
  );
});

test("inclinaison : tous les packs penchent du même côté", () => {
  assert.deepEqual(
    PACKS.map((pack) => pack.tilt),
    PACKS.map(() => PACK_TILT),
    "chaque pack doit reprendre l'inclinaison commune",
  );
  assert.ok(
    PACKS.every((pack) => Math.sign(pack.tilt.bx) === Math.sign(PACK_TILT.bx)),
    "tous les packs doivent pencher dans le même sens",
  );
  assert.ok(
    PACKS.every((pack) => Math.sign(pack.tilt.by) === Math.sign(PACK_TILT.by)),
    "tous les packs doivent pencher dans le même sens",
  );

  // Les valeurs partent en variables CSS, consommées par le poster.
  assert.match(PACK, /"--bx": `\$\{pack\.tilt\.bx\}deg`/);
  assert.match(PACK, /"--by": `\$\{pack\.tilt\.by\}deg`/);
  assert.match(CSS, /perspective\(900px\) rotateX\(var\(--bx\)\) rotateY\(var\(--by\)\)/);
  assert.match(CSS, /\[data-selected="true"\][\s\S]*?translateY\(-8px\) scale\(1\.04\)/);
  assert.match(CSS, /transition:\s*transform 0\.4s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
});

test("grille : tous les packs, un seul sélectionné, Mix par défaut", () => {
  // La grille boucle sur les dix packs, sans filtre de roulement.
  assert.match(PICKER, /\{packs\.map\(\(pack\) =>/);
  assert.match(PICKER, /aria-pressed=\{isSelected\}/);
  assert.match(PICKER, /pack\.id === "mix"/);

  // Largeurs et colonnes : 2 sur mobile, 3 à côté du panneau, 4 en très grand.
  assert.match(PICKER, /lg:grid-cols-3/);
  assert.match(PICKER, /2xl:grid-cols-4/);
  assert.match(PICKER, /max-w-\[190px\]/);

  // Compteur de disponibilité et tiroir mobile.
  assert.match(PICKER, /Packs disponibles/);
  assert.match(PICKER, /setSheetOpen\(true\)/);

  // Le poster n'est pas un bouton : la tuile entière reste le contrôle.
  assert.match(PICKER, /<BoosterPack\s/);
  assert.doesNotMatch(PICKER, /interactive/);
});

test("plus aucune rotation dans l'interface, le code ou les textes", () => {
  const sources = [PICKER, PAGE, ACTIONS, DATA, PACKS_SRC, PACK].join("\n");

  for (const forbidden of [
    /pack du jour/i,
    /journalier/i,
    /minuit/i,
    /rotation/i,
    /daily_pack/i,
    /getDailyPack/,
  ]) {
    assert.doesNotMatch(sources, forbidden);
  }

  assert.equal(fs.existsSync(path.join(ROOT, "src/lib/daily-pack.ts")), false);
});

test("migration 035 : ouverture directe, roulement supprimé, données intactes", () => {
  assert.match(SQL, /alter function public\.open_pack_any\(text\) rename to open_pack/);
  assert.match(SQL, /drop function if exists public\.daily_pack_info\(\)/);
  assert.match(SQL, /drop function if exists public\.daily_pack_slug_at\(timestamptz\)/);
  assert.match(SQL, /grant execute on function public\.open_pack\(text\) to authenticated/);
  // Aucune donnée de joueur n'est touchée.
  assert.doesNotMatch(SQL, /delete from|insert into|update\s+public\./i);
});

test("sous-titre : une ligne, réduction jusqu'à 11 px puis ellipse", () => {
  assert.match(CSS, /\.pack-subtitle\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(CSS, /\.pack-subtitle\s*\{[\s\S]*?text-overflow:\s*ellipsis/);
  assert.match(CSS, /\.pack-subtitle\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(CSS, /\.pack-subtitle\s*\{[\s\S]*?max-width:\s*100%/);

  assert.match(HOOK, /SUBTITLE_MIN_PX = 11/);
  assert.match(HOOK, /fitLine\(subtitleRef\.current, SUBTITLE_MIN_PX\)/);
  assert.match(PACK, /ref=\{subtitleRef\}/);

  // Le corps du pack garde 10 % de marge de chaque côté.
  assert.match(CSS, /\.pack-content\s*\{[\s\S]*?padding:[^;]*10cqw/);
});
