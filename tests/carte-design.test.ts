import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSS = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const CARD_FACE = readFileSync(path.join(ROOT, "src/components/card-face.tsx"), "utf8");
const TILT = readFileSync(path.join(ROOT, "src/lib/use-card-tilt.ts"), "utf8");
const FLIP = readFileSync(path.join(ROOT, "src/components/card-flip.tsx"), "utf8");

/** Clé de données → suffixe de token (`UC` → `U`, `SR` → `E`, …). */
const TOKENS = { C: "C", UC: "U", R: "R", SR: "E", UR: "L", L: "M" } as const;

/** Ordre d'affichage, du plus commun au plus rare. */
const TIERS = ["C", "UC", "R", "SR", "UR", "L"] as const;

function token(name: string): string {
  const match = CSS.match(new RegExp(`--rarity-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match, `token --rarity-${name} introuvable`);
  return match[1];
}

/** Luminance relative WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test("contraste : le texte des six raretés passe AA sur son fond", () => {
  for (const rarity of TIERS) {
    const suffix = TOKENS[rarity];
    const ink = token(`${suffix}-ink`);
    const bg = token(`${suffix}-bg`);
    assert.ok(
      contrast(ink, bg) >= 4.5,
      `${rarity} : encre ${ink} sur fond ${bg} = ${contrast(ink, bg).toFixed(2)}:1`,
    );
  }
});

test("contraste : le badge plein reste lisible", () => {
  for (const rarity of TIERS) {
    const suffix = TOKENS[rarity];
    const fill = token(suffix);
    const on = token(`${suffix}-on`);
    assert.ok(
      contrast(on, fill) >= 4.5,
      `${rarity} : badge ${on} sur ${fill} = ${contrast(on, fill).toFixed(2)}:1`,
    );
  }
});

/** Corps d'une règle `data-rarity="X"` (première occurrence, celle des tokens). */
function rarityBlock(rarity: string): string {
  const start = CSS.indexOf(`.card-face[data-rarity="${rarity}"] {`);
  assert.ok(start >= 0, `bloc [data-rarity="${rarity}"] introuvable`);
  const end = CSS.indexOf("\n}", start);
  return CSS.slice(start, end);
}

function numberIn(block: string, property: string): number {
  const match = block.match(new RegExp(`${property}:\\s*([0-9.]+)\\s*;`));
  assert.ok(match, `${property} introuvable dans le bloc`);
  return Number(match[1]);
}

test("rareté : chaque niveau porte sa couleur", () => {
  for (const rarity of TIERS) {
    assert.match(
      rarityBlock(rarity),
      new RegExp(`--rarity:\\s*var\\(--rarity-${TOKENS[rarity]}\\)`),
      `couleur ${rarity} non branchée`,
    );
  }
});

test("rareté : le foil change de calque en montant, sans jamais reculer", () => {
  const tiers = TIERS.map((rarity) => {
    const block = rarityBlock(rarity);
    return {
      rarity,
      art: block.includes("--foil-art") ? numberIn(block, "--foil-art") : 0,
      card: block.includes("--foil-card") ? numberIn(block, "--foil-card") : 0,
      sparkle: block.includes("--sparkle") ? numberIn(block, "--sparkle") : 0,
    };
  });
  const byRarity = new Map(tiers.map((tier) => [tier.rarity, tier]));

  // Jusqu'au Rare : aucun foil sous l'illustration ; à partir de l'Épique :
  // reverse holo sur les marges, puis les deux calques sur les hautes raretés.
  assert.equal(byRarity.get("C")?.art, 0);
  assert.equal(byRarity.get("C")?.card, 0);
  assert.equal(byRarity.get("UC")?.art, 0);
  assert.equal(byRarity.get("UC")?.card, 0);
  assert.ok((byRarity.get("R")?.art ?? 0) > 0, "le Rare foil sa fenêtre");
  assert.equal(byRarity.get("R")?.card, 0);
  assert.ok((byRarity.get("SR")?.card ?? 0) > 0, "l'Épique passe en reverse holo");
  assert.equal(byRarity.get("SR")?.art, 0);
  assert.ok((byRarity.get("UR")?.art ?? 0) > 0);
  assert.ok((byRarity.get("UR")?.card ?? 0) > 0);

  // Le Mythique porte le foil le plus dense des deux côtés, et un peu plus
  // de paillettes à chaque niveau.
  for (const rarity of ["C", "UC", "R", "SR", "UR"] as const) {
    const tier = byRarity.get(rarity);
    const mythic = byRarity.get("L");
    assert.ok((mythic?.art ?? 0) > (tier?.art ?? 0), `foil art ${rarity}`);
    assert.ok((mythic?.card ?? 0) > (tier?.card ?? 0), `foil carte ${rarity}`);
    assert.ok((mythic?.sparkle ?? 0) >= (tier?.sparkle ?? 0), `paillettes ${rarity}`);
  }
});

test("rareté : le Mythique a sa bordure prismatique et son animation", () => {
  assert.match(CSS, /data-rarity="L"\]::before/);
  // L'anneau est posé dans le padding box : sur la bordure, il serait clippé.
  assert.match(
    CSS,
    /data-rarity="L"\]::before \{[^}]*inset: 0;/,
    "l'anneau prismatique doit rester dans la zone non clippée",
  );
  assert.match(CSS, /conic-gradient\(/);
  assert.match(CSS, /@keyframes holo-hue/);
  // L'animation reste en pause tant que la carte n'est pas survolée.
  assert.match(CSS, /animation: holo-hue 14s linear infinite paused/);
  assert.match(
    CSS,
    /data-rarity="L"\]\[data-tilt="true"\] \.holo[^{]*\{\s*animation-play-state: running/,
  );
});

test("calques : foil sous l'illustration, reflet et paillettes au-dessus", () => {
  assert.match(CARD_FACE, /className="card-foil"/);
  assert.ok(
    CARD_FACE.indexOf("card-foil") < CARD_FACE.indexOf('className="card-head"'),
    "le foil carte entière doit être posé avant l'illustration",
  );
  assert.match(CSS, /\.card-foil\s*\{[\s\S]*?z-index:\s*0;/);
  assert.match(CSS, /\.card-art\s*\{[\s\S]*?z-index:\s*1;/);
});

test("variantes : chaque misprint a un rendu et un libellé", () => {
  for (const variant of ["holo_bleed", "off_center", "ghosting"]) {
    assert.match(CSS, new RegExp(`data-variant="${variant}"`), `variante ${variant}`);
  }
  assert.match(CARD_FACE, /VARIANT_LABELS\[variant\]/);
  assert.match(CARD_FACE, /variant !== "normal"/);
  assert.match(CARD_FACE, /data-variant=\{variant\}/);
});

test("accessibilité : prefers-reduced-motion éteint tilt et animations", () => {
  const start = CSS.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(start > 0);
  const block = CSS.slice(start, CSS.indexOf("\n}", CSS.indexOf(".card-shine::after", start)));
  assert.match(block, /animation: none/);
  assert.match(block, /transform: none/);
  assert.match(block, /\.card-shine::after\s*\{\s*display: none/);
});

test("banc d'essai : l'intensité vient du curseur, pas du pointeur", () => {
  assert.match(CSS, /\.holo-lab \.card-face\s*\{[\s\S]*--intensity: var\(--lab-intensity/);
});

test("performance : aucun contexte 3D au repos", () => {
  const base = CSS.slice(CSS.indexOf("\n.card-face {"), CSS.indexOf(".card-face[data-size=\"sm\"]"));
  assert.match(base, /transform: none;/);
  const tilted = CSS.slice(CSS.indexOf('.card-face[data-tilt="true"] {'));
  assert.match(tilted.slice(0, 300), /perspective\(800px\)/);
});

test("performance : les effets ne sont rendus que pendant l'interaction", () => {
  assert.match(
    CSS,
    /\.card-face:not\(\[data-tilt="true"\]\) \.holo[\s\S]*\{[\s\S]*display: none;/,
  );
  // La carte retournable incline son conteneur, pas ses faces.
  assert.match(CSS, /\.card-flip-tilt\[data-tilt="true"\] \.card-face \.holo/);
  // Le banc d'essai garde les effets visibles sans survol.
  assert.match(CSS, /\.holo-lab \.card-face \.holo/);
  assert.doesNotMatch(CSS, /background-position:\s*calc\(50% \+ var\(--tx\) \* 40px\)/);
});

test("performance : l'éclat de révélation reste sur le compositeur", () => {
  const flash = CSS.slice(CSS.indexOf(".reveal-flash {"), CSS.indexOf('.reveal-flash[data-rarity="UC"]'));
  assert.doesNotMatch(flash, /mix-blend-mode/);
  const start = CSS.indexOf("@keyframes reveal-flash");
  const keyframes = CSS.slice(start, CSS.indexOf("\n}", start) + 2);
  assert.match(keyframes, /opacity: 0;[\s\S]*opacity: 1;[\s\S]*opacity: 0;/);
  assert.doesNotMatch(keyframes, /transform/);
});

test("inclinaison : un remontage ne bloque plus la boucle d'animation", () => {
  assert.match(TILT, /cancelAnimationFrame\(frame\.current\)[\s\S]{0,160}frame\.current = null;/);
});

test("collection : la tuile s'élève au survol, sans inclinaison", () => {
  // Le tilt 3D est réservé à la visionneuse : la grille se contente d'un
  // léger soulèvement pour montrer la carte ciblée.
  assert.match(FLIP, /collection-tile/);
  assert.match(FLIP, /tilt=\{false\}/);
  assert.match(
    CSS,
    /\.collection-tile:hover,\s*\.collection-tile:focus-visible\s*\{\s*transform: translateY\(-6px\);/,
  );
});

test("visionneuse : l'inclinaison suit le pointeur sans traîner", () => {
  // Une transition sur l'inclinaison la faisait courir derrière le curseur.
  assert.match(CSS, /\.card-flip-tilt\[data-tilt="true"\]\s*\{\s*transition: transform 0s;/);
  // Le cadre est mesuré au repos : l'inclinaison ne déforme plus sa référence.
  assert.match(TILT, /bounds\.current = node\.getBoundingClientRect\(\)/);
  assert.match(TILT, /const STALE_MARGIN = 80;/);
});

test("visionneuse : fond opaque et effets coupés pendant le retournement", () => {
  // Un `backdrop-filter` plein écran derrière la grille recomposait toute la
  // page à chaque image de la rotation.
  assert.doesNotMatch(FLIP, /backdrop-blur/);
  assert.match(FLIP, /className="card-viewer"/);
  assert.match(CSS, /\.card-viewer\s*\{[\s\S]*?position:\s*fixed/);
  const viewerStart = CSS.indexOf(".card-viewer {");
  const viewer = CSS.slice(viewerStart, CSS.indexOf(".card-flip-tilt {", viewerStart));
  assert.ok(viewer.length > 0);
  assert.doesNotMatch(viewer, /backdrop-filter/);
  // Foil, paillettes et reflet sortent de l'arbre le temps de la rotation.
  assert.match(FLIP, /data-flipping=/);
  assert.match(
    CSS,
    /\.card-flip-tilt\[data-flipping="true"\] \.card-face \.holo[\s\S]*?display: none;/,
  );
});
