import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Ouverture par lots (×1 ×5 ×10) et compteur de boosters du header.
 *
 * Les tirages eux-mêmes vivent en base ; ces tests verrouillent les bornes, le
 * comportement en cas de stock insuffisant et le rendu du récapitulatif.
 */

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

const ACTIONS = read("src/app/actions.ts");
const PICKER = read("src/components/booster-picker.tsx");
const REVEAL = read("src/components/booster-reveal.tsx");
const HEADER = read("src/components/site-header.tsx");
const BADGE = read("src/components/booster-badge.tsx");
const REVEAL_QUEUE = read("src/lib/reveal-queue.ts");
const GAME_LAYOUT = read("src/app/(game)/layout.tsx");
const PAGES_LAYOUT = read("src/app/(pages)/layout.tsx");

test("ouverture en lot : bornée, séquentielle, ouvertures partielles conservées", () => {
  const start = ACTIONS.indexOf("export async function openPacks");
  assert.ok(start > 0, "openPacks absente");
  const fn = ACTIONS.slice(start);

  // Borne haute : jamais plus que le stock maximal, même si le client insiste.
  assert.match(fn, /Math\.min\(BOOSTER_STOCK_MAX, Math\.max\(1, Math\.trunc\(count\) \|\| 1\)\)/);
  // Un appel `open_pack` par booster : le tirage reste en base, un par un.
  assert.match(fn, /for \(let index = 0; index < requested; index \+= 1\)/);
  assert.match(fn, /rpc\("open_pack"/);
  assert.match(fn, /cards\.push\(\.\.\.\(payload\.cards \?\? \[\]\)\)/);

  // Refus au premier booster = erreur ; ensuite, on garde ce qui est ouvert.
  assert.match(fn, /if \(opened === 0\) return refusedOpen\(error\)/);
  assert.match(fn, /if \(opened === 0\) \{[\s\S]*?status: "empty"/);

  // Aucune revalidation pendant l'ouverture : elle réappliquait l'arbre
  // serveur sous la révélation et faisait disparaître l'overlay, alors que le
  // booster était déjà consommé (bogue « page du booster puis retour »).
  assert.doesNotMatch(fn, /revalidatePath\("/);

  // La page se relit à la fermeture de la révélation, pas pendant.
  assert.match(PICKER, /setPendingReveal\(null\);\s*\/\/[\s\S]*?router\.refresh\(\)/);

  // L'API simple reste un lot de 1.
  assert.match(ACTIONS, /export async function openPack\(packId: string\): Promise<OpenPackResult> \{\s*return openPacks\(packId, 1\);/);
});

test("interface : ×1 ×5 ×10, plafonné au stock disponible", () => {
  assert.match(PICKER, /const BATCHES = \[1, 5, 10\] as const/);
  assert.match(PICKER, /\{BATCHES\.map\(\(value\) =>/);
  assert.match(PICKER, /aria-pressed=\{batch === value\}/);
  assert.match(PICKER, /const keep = Math\.min\(batch, available\)/);
  assert.match(PICKER, /await openPacks\(selected\.id, keep\)/);
  // Le bouton annonce le lot réellement ouvert (« Ouvrir ×5 ») et le stock.
  assert.ok(PICKER.includes('Ouvrir{keep > 1 ? ` ×${keep}` : ""}'));
  assert.match(PICKER, /Gratuit · \{available\} restant/);
  // Le tiroir mobile et le panneau desktop partagent le même contrôle.
  assert.match(PICKER, /onBatch=\{setBatch\}/);
});

test("révélation : tout tirage passe par le dévoilement, récapitulatif en grille", () => {
  // Plus de raccourci « trop de cartes → récapitulatif direct » : un lot ×5
  // (25 cartes) se révèle carte par carte, comme un ×1.
  assert.doesNotMatch(REVEAL, /SEQUENCE_MAX/);
  // L'éventail ne montre que les prochaines cartes ; les suivantes arrivent
  // au fur et à mesure que la pile se vide.
  assert.match(REVEAL, /const FAN_VISIBLE = 5/);
  assert.match(REVEAL, /items\.slice\(revealed, revealed \+ FAN_VISIBLE\)/);
  assert.match(REVEAL, /later\(\(\) => setPhase\("fan"\), reduced \? 60 : 460\)/);
  assert.match(REVEAL, /const FAN_MAX = 12/);
  assert.match(REVEAL, /items\.length > FAN_MAX \? \(\s*<RevealGrid items=\{items\} \/>/);
  assert.match(REVEAL, /function RevealGrid/);
  // Les pastilles restent lisibles dans la grille (pas de survol nécessaire).
  assert.match(REVEAL, /×\{entry\.quantity\}/);
});

test("révélation : un tirage en attente survit à un remontage du picker", () => {
  // Un rendu serveur appliqué pendant l'ouverture remonte le composant : sans
  // ce relais hors composant, les cartes tirées n'étaient jamais montrées.
  assert.match(REVEAL_QUEUE, /export function setPendingReveal/);
  assert.match(REVEAL_QUEUE, /useSyncExternalStore/);
  assert.match(REVEAL_QUEUE, /\(\) => pending/);
  assert.match(PICKER, /const reveal = usePendingReveal\(\)/);
  assert.match(PICKER, /setPendingReveal\(\{ items, packId: selected\.id, opened: result\.opened \}\)/);
  // L'accueil partage le même relais, avec le pack Mix.
  assert.match(read("src/components/booster-station.tsx"), /setPendingReveal\(\{ items, packId: "mix", opened: 1 \}\)/);
});

test("header : compteur de boosters juste avant les Pixels", () => {
  assert.match(HEADER, /<BoosterBadge/);
  assert.ok(
    HEADER.indexOf("<BoosterBadge") < HEADER.indexOf("Pixels disponibles"),
    "le compteur doit précéder la pastille des Pixels",
  );

  assert.match(BADGE, /href="\/boosters"/);
  assert.match(BADGE, /projectedStock\(stock, anchor, now\)/);
  assert.match(BADGE, /BOOSTER_STOCK_MAX/);
  assert.match(BADGE, /setInterval\(\(\) => setNow\(Date\.now\(\)\), REFRESH_MS\)/);

  // Le stock vient du profil, avec son ancre et l'heure serveur.
  assert.match(GAME_LAYOUT, /boosterStock=\{profile\.boosterStock\}/);
  assert.match(GAME_LAYOUT, /boosterAnchor=\{profile\.lastBoosterAt\}/);
  assert.match(GAME_LAYOUT, /serverNow=\{serverNowMs\(\)\}/);
  assert.match(PAGES_LAYOUT, /boosterStock=\{profile\?\.boosterStock\}/);
});
