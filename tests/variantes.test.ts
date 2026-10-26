import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  MISPRINTS,
  VARIANT_HINTS,
  VARIANT_LABELS,
  isMisprint,
  toCardVariant,
  type CardVariant,
} from "../src/lib/variants";

const ROOT = path.resolve(import.meta.dirname, "..");

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

test("variantes : les clés connues sont conservées", () => {
  assert.equal(toCardVariant(null), "normal");
  assert.equal(toCardVariant(undefined), "normal");
  assert.equal(toCardVariant(""), "normal");
  assert.equal(toCardVariant("normal"), "normal");
  assert.equal(toCardVariant("misprint"), "misprint");
  for (const misprint of MISPRINTS) {
    assert.equal(toCardVariant(misprint), misprint);
  }
});

test("variantes : une valeur inconnue retombe sur une carte normale", () => {
  assert.equal(toCardVariant("foil_bleed"), "normal");
  assert.equal(toCardVariant("GHOSTING"), "normal");
  assert.equal(toCardVariant("  ghosting  "), "normal");
});

test("variantes : chaque clé a un libellé et une explication", () => {
  const keys: CardVariant[] = ["normal", "misprint", ...MISPRINTS];
  for (const key of keys) {
    assert.ok(VARIANT_LABELS[key], `libellé manquant : ${key}`);
    assert.ok(VARIANT_HINTS[key], `explication manquante : ${key}`);
  }
  assert.equal(isMisprint("normal"), false);
  for (const key of keys.filter((key) => key !== "normal")) {
    assert.equal(isMisprint(key as CardVariant), true);
  }
});

test("variantes : la contrainte SQL accepte exactement les trois misprints", () => {
  const sql = read("supabase/migrations/013_catalogue_actif.sql");
  const match = sql.match(/collection_variant_check[\s\S]*?check \(variant is null or variant in \(([^)]+)\)\)/);
  assert.ok(match, "contrainte collection_variant_check introuvable");
  const allowed = match[1]
    .split(",")
    .map((value) => value.trim().replace(/^'|'$/g, ""))
    .sort();
  assert.deepEqual(allowed, [...MISPRINTS].sort());
});

test("rendu : la carte affiche le libellé de la variante", () => {
  const source = read("src/components/card-face.tsx");
  assert.match(source, /VARIANT_LABELS\[variant\]/);
  assert.match(source, /VARIANT_HINTS\[variant\]/);
  assert.match(source, /variant !== "normal"/);
});

test("rendu : une carte retirée perd son visuel mais garde ses infos", () => {
  const source = read("src/components/card-face.tsx");
  assert.match(source, /card\.retired === true/);
  assert.match(source, /const art = gone \? null : getCardArt/);
  assert.match(source, /data-retired=\{gone \? "true" : undefined\}/);
  assert.match(source, /Retirée/);

  // Les autres surfaces qui résolvent un visuel sans passer par CardFace
  // (avatar de profil, classement, marché) sont couvertes ici.
  const art = read("src/lib/card-art.ts");
  assert.match(art, /if \(isRetiredCard\(cardId\)\) return null/);
});

test("collection : la variante et le retrait viennent de la base", () => {
  const data = read("src/lib/data.ts");
  assert.match(data, /select\("card_id, quantity, holo_quantity, variant, first_obtained_at"\)/);
  assert.match(data, /from\("cards"\)[\s\S]{0,80}select\("id, active"\)/);
  assert.match(data, /variant: toCardVariant\(row\.variant\)/);
  assert.match(data, /retired: retired\.has\(row\.card_id\)/);

  const page = read("src/app/(game)/collection/page.tsx");
  assert.match(page, /variant: row\.variant/);
  assert.match(page, /retired: row\.retired/);
});

test("collection : le verso et la visionneuse rappellent la variante", () => {
  const flip = read("src/components/card-flip.tsx");
  assert.match(flip, /variant\?: CardVariant/);
  assert.match(flip, /retired\?: boolean/);
  assert.match(flip, /VARIANT_LABELS\[variant\]/);
  assert.match(flip, /Retirée du catalogue/);

  const css = read("src/app/globals.css");
  assert.match(css, /\.card-tags\s*\{/);
  assert.match(css, /\.card-retired\s*\{/);
  assert.match(css, /\.flip-back-tag\s*\{/);
});

test("ouverture : le misprint est annoncé dans la révélation", () => {
  const reveal = read("src/components/booster-reveal.tsx");
  assert.match(reveal, /variant: CardVariant/);
  assert.match(reveal, /variant=\{entry\.variant\}/);
  assert.match(reveal, /VARIANT_LABELS\[entry\.variant\]/);

  // Les deux entrées de booster transmettent la variante au reveal.
  for (const file of ["src/components/booster-picker.tsx", "src/components/booster-station.tsx"]) {
    assert.match(read(file), /variant: entry\.variant/);
  }
});

test("fiche : la variante possédée est affichée et appliquée", () => {
  const page = read("src/app/(game)/card/[id]/page.tsx");
  assert.match(page, /select\("quantity, holo_quantity, variant, first_obtained_at"\)/);
  assert.match(page, /toCardVariant\(data\?\.variant/);
  assert.match(page, /VARIANT_LABELS\[variant\]/);
  assert.match(page, /variant=\{owned \? variant : "normal"\}/);
});

test("synchronisation : une carte sortie du catalogue est supprimée", () => {
  const script = read("scripts/db-cards.ts");
  // Plus de retrait « doux » : la carte et ses copies quittent la base.
  assert.doesNotMatch(script, /retired_reason = coalesce/);
  assert.doesNotMatch(script, /set active = false/);
  assert.match(script, /delete from public\.collection\s+where card_id not in/);
  assert.match(script, /delete from public\.market_audit/);
  assert.match(script, /delete from public\.cards\s+where id not in/);
  // Garde-fou : un catalogue tronqué ne doit pas vider la base.
  assert.match(script, /catalogue suspicieusement court/);
});

test("visuels : un fichier de carte retirée n'est plus servi", () => {
  const script = read("scripts/cards-images.ts");
  assert.match(script, /card\.retired !== true/);
  assert.match(script, /carte retirée/);
});
