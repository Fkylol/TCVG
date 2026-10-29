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
const REVEAL_HOST = read("src/components/reveal-host.tsx");
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

  // La page se relit à la fermeture de la révélation, pas pendant — et c'est
  // l'hôte unique, à la racine du site, qui s'en charge.
  assert.match(REVEAL_HOST, /setPendingReveal\(null\);\s*\/\/[\s\S]*?router\.refresh\(\)/);

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
  assert.match(PICKER, /\{t\("Ouvrir"\)\}\{keep > 1 \? ` ×\$\{keep\}` : ""\}/);
  assert.match(PICKER, /\{t\("Gratuit"\)\} · \{available\} \{t\("restant"\)\}/);
  // Le tiroir mobile et le panneau desktop partagent le même contrôle.
  assert.match(PICKER, /onBatch=\{setBatch\}/);
});

test("révélation : cache le nom et la rareté avant le retournement, tri croissant", () => {
  assert.match(REVEAL, /sortByRarity\(items, \(entry\) => entry\.card\.rarity\)/);
  assert.match(REVEAL, /RARITY, rarestRarity, sortByRarity/);
  // Un seul état gouverne le nom, la rareté et la face : `faceShown`.
  assert.match(REVEAL, /const faceShown = faceRevealed && flipped === revealed/);
  assert.match(REVEAL, /faceShown \? current\.card\.name : t\("Carte à découvrir"\)/);
  assert.match(REVEAL, /\{faceShown \? \(\s*<>\s*<span className=\{\`chip[\s\S]{0,220}?\{rarity\.label\}/);
  assert.match(REVEAL, /onTransitionEnd=\{\(event\) => \{/);
  assert.match(REVEAL, /event\.propertyName === "transform" && isFlipped && isTop/);
  assert.match(REVEAL, /if \(reduced\) later\(\(\) => setFaceRevealed\(true\), 60\)/);
  // La face reste montée pendant la rotation, sinon la carte n'a pas l'air de
  // se retourner : ce sont seulement le nom et la rareté qui attendent.
  assert.match(REVEAL, /<span className="rip-face rip-face-front">\s*<CardFace/);
  assert.doesNotMatch(REVEAL, /faceRevealed && isFlipped && \(/);
  assert.match(REVEAL, /faceShown && isFlipped\s*\? `\$\{entry\.card\.name\}, \$\{RARITY\[entry\.card\.rarity\]\.label\}`\s*: t\("Retourner la carte"\)/);
  // La vignette en cours reste un dos tant que la face n'est pas découverte.
  assert.match(REVEAL, /position < revealed \|\| \(position === flipped && faceRevealed\)/);
  // Le dos n'est jamais cerclé de la couleur de la rareté qu'il cache.
  assert.match(REVEAL, /const BACK_GLOW = "rgba\(255, 255, 255, 0\.28\)"/);
  assert.match(REVEAL, /"--glow": isFlipped \? AURA\[entry\.card\.rarity\]\.glow : BACK_GLOW/);
  assert.doesNotMatch(REVEAL, /style=\{\{ "--glow": AURA\[entry\.card\.rarity\]\.glow \} as CSSProperties\}/);
});

test("révélation : tout tirage passe par le dévoilement, récapitulatif en grille", () => {
  // Plus de raccourci « trop de cartes → récapitulatif direct » : un lot ×5
  // (25 cartes) se révèle carte par carte, comme un ×1.
  assert.doesNotMatch(REVEAL, /SEQUENCE_MAX/);
  // L'éventail ne montre que les prochaines cartes ; les suivantes arrivent
  // au fur et à mesure que la pile se vide.
  assert.match(REVEAL, /const FAN_VISIBLE = 5/);
  assert.match(REVEAL, /revealItems\.slice\(revealed, revealed \+ FAN_VISIBLE\)/);
  assert.match(REVEAL, /later\(\(\) => setPhase\("fan"\), reduced \? 60 : 460\)/);
  assert.match(REVEAL, /const FAN_MAX = 12/);
  assert.match(REVEAL, /revealItems\.length > FAN_MAX \? \(\s*<RevealGrid items=\{revealItems\} \/>/);
  assert.match(REVEAL, /function RevealGrid/);
  // Les pastilles restent lisibles dans la grille (pas de survol nécessaire).
  assert.match(REVEAL, /×\{entry\.quantity\}/);
  assert.match(REVEAL, /RevealGrid items=\{revealItems\}/);
  assert.match(REVEAL, /revealItems\.map\(\(entry, position\) => \{/);
});

test("révélation : un tirage en attente survit à un remontage du picker", () => {
  // Un rendu serveur appliqué pendant l'ouverture remonte le composant : sans
  // ce relais hors composant, les cartes tirées n'étaient jamais montrées.
  assert.match(REVEAL_QUEUE, /export function setPendingReveal/);
  assert.match(REVEAL_QUEUE, /useSyncExternalStore/);
  assert.match(REVEAL_QUEUE, /\(\) => pending/);
  // Le picker et l'accueil se contentent de mettre la révélation en attente :
  // c'est l'hôte unique, monté à la racine, qui l'affiche.
  assert.match(PICKER, /setPendingReveal\(\{ items, packId: selected\.id, opened: result\.opened \}\)/);
  assert.doesNotMatch(PICKER, /usePendingReveal|<BoosterReveal/);
  assert.match(REVEAL_HOST, /const reveal = usePendingReveal\(\)/);
  assert.match(REVEAL_HOST, /if \(!reveal\) return null;/);
  assert.match(REVEAL_HOST, /pack=\{pack\}/);
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
