import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { PACKS } from "../src/lib/packs";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const COMPONENT = read("src/components/booster-pack.tsx");
const ART = read("src/components/pack-art.tsx");
const HOOK = read("src/lib/use-fit-title.ts");
const CSS = read("src/app/globals.css");
const REVEAL = read("src/components/booster-reveal.tsx");
const PICKER = read("src/components/booster-picker.tsx");
const DEMO = read("src/app/dev/packs/page.tsx");
const LAB = read("src/app/dev/packs/pack-lab.tsx");
const LAYOUT = read("src/app/layout.tsx");

test("posters : chaque pack a son emblème et sa texture originaux", () => {
  const keys = [...ART.matchAll(/case "([a-z-]+)":/g)].map((match) => match[1]);

  for (const pack of PACKS) {
    assert.equal(pack.emblem, pack.id, `emblème inattendu : ${pack.id}`);
    assert.equal(pack.texture, pack.id, `texture inattendue : ${pack.id}`);
    assert.ok(keys.includes(pack.id), `emblème manquant : ${pack.id}`);
  }
  assert.equal(new Set(keys).size, PACKS.length, "un emblème par pack");

  // Aucune image distante ni personnage : uniquement des formes.
  assert.doesNotMatch(ART, /https?:\/\//);
  assert.doesNotMatch(ART, /<image\b/);
  // Les textures respectent le viewBox du poster 5/8.
  assert.match(ART, /0 0 190 304/);
});

test("poster : dessiné en DOM, sans image raster ni holo", () => {
  assert.doesNotMatch(COMPONENT, /next\/image/);
  assert.doesNotMatch(COMPONENT, /\.webp/);
  assert.match(COMPONENT, /className="pack-poster"/);
  assert.match(COMPONENT, /useFitTitle/);
  assert.match(COMPONENT, /<PackEmblem name=\{pack\.emblem\}/);
  assert.match(COMPONENT, /<PackTexture name=\{pack\.texture\}/);
  // Plus aucun suivi du pointeur, ni foil, ni balayage de lumière.
  assert.doesNotMatch(COMPONENT, /usePackTilt|onPointer|DeviceOrientation|--mx|--my/);
  assert.doesNotMatch(CSS, /\.pack-foil|\.pack-shine/);
  // Les plis du plastique restent un overlay discret, pas un reflet animé.
  assert.match(CSS, /\.pack-folds\s*\{[\s\S]*?mix-blend-mode:\s*overlay/);

  assert.match(CSS, /\.pack-poster\s*\{[\s\S]*?aspect-ratio:\s*5 \/ 8/);
  assert.match(CSS, /\.pack-poster\s*\{[\s\S]*?border-radius:\s*16px/);
  assert.match(CSS, /\.pack-poster\s*\{[\s\S]*?container-type:\s*inline-size/);
  assert.match(CSS, /\.pack-band\s*\{[\s\S]*?max\(16px, 7cqw\)/);

  // Les encres claires reçoivent un voile sombre en bas pour le contraste.
  assert.match(COMPONENT, /hasLightInk\(pack\.colors\.ink\)/);
  assert.match(CSS, /\.pack-shade\s*\{[\s\S]*?var\(--pack-veil\)/);
  // La marque TCVG est posée sur une pastille sombre translucide.
  assert.match(CSS, /\.pack-mark\s*\{[\s\S]*?rgba\(8, 8, 16, 0\.5\)/);

  // La police Syne est chargée une seule fois, par le layout.
  assert.match(LAYOUT, /Syne\(/);
  assert.match(LAYOUT, /--font-syne/);
  assert.match(CSS, /\.pack-title\s*\{[\s\S]*?var\(--font-syne/);
});

test("inclinaison : propre à chaque pack, redressée au survol et au focus", () => {
  assert.match(COMPONENT, /"--bx": `\$\{pack\.tilt\.bx\}deg`/);
  assert.match(COMPONENT, /"--by": `\$\{pack\.tilt\.by\}deg`/);
  assert.match(COMPONENT, /data-selected=/);
  assert.match(CSS, /perspective\(900px\) rotateX\(var\(--bx\)\) rotateY\(var\(--by\)\)/);
  assert.match(
    CSS,
    /\[data-selected="true"\][\s\S]*?translateY\(-8px\) scale\(1\.04\)/,
    "le pack sélectionné reste droit et soulevé",
  );
  assert.match(CSS, /transition:\s*transform 0\.4s cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/);
  // Mouvement réduit : passage direct, sans transition.
  assert.match(CSS, /prefers-reduced-motion[\s\S]*?transition:\s*none/);
  // Le poster reste focusable sur la planche, jamais dans un bouton parent.
  assert.match(COMPONENT, /role=\{interactive \? "button"/);
  assert.match(COMPONENT, /aria-label=\{\s*interactive \? `Booster \$\{pack\.name\}/);
});

test("titre : mesure réelle et plafond à 80 % de la largeur du pack", () => {
  assert.match(HOOK, /useFitTitle\(maxRatio = 0\.8\)/);
  assert.match(HOOK, /document\.fonts\.ready/);
  assert.match(HOOK, /ResizeObserver/);
  assert.match(HOOK, /frame\.offsetWidth/);
  // La mesure couvre la ligne mesurée : `offsetWidth` pour le titre en
  // `max-content`, `scrollWidth` pour le sous-titre rogné par le pack.
  assert.match(HOOK, /line\.offsetWidth, line\.scrollWidth/);
  assert.match(HOOK, /fitLine\(titleRef\.current/);
  assert.match(HOOK, /target = packWidth \* maxRatio/);
  // Le titre peut mesurer sa largeur naturelle, notamment sur deux lignes.
  assert.match(CSS, /\.pack-title\s*\{[\s\S]*?width:\s*max-content/);
  assert.match(CSS, /\.pack-title\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(COMPONENT, /pack\.name\.split\("-"\)/);
});

test("ouverture : le poster est déchiré, l'animation peut être passée", () => {
  assert.match(REVEAL, /<BoosterPack pack=\{pack\} flat showPrice=\{false\} \/>/);

  // Le booster scellé flotte doucement, avec une ombre posée au sol.
  assert.match(REVEAL, /className="pack-cast"/);
  assert.match(CSS, /\.pack-stage \{\r?\n  animation: pack-hover/);
  assert.match(CSS, /@keyframes pack-hover/);
  assert.match(CSS, /\.pack-cast \{[\s\S]*?radial-gradient/);
  // Mouvement réduit : ni flottement ni pulsation d'ombre.
  assert.match(CSS, /prefers-reduced-motion[\s\S]*?\.pack-cast/);
  assert.match(REVEAL, /Passer l'animation/);
  assert.match(REVEAL, /Doublon ×/);
  assert.match(PICKER, /pack=\{packs\.find/);
  // La soudure de la révélation suit la bande crantée (7 cqw, 16 px mini).
  assert.match(CSS, /\.pack-strip\s*\{[\s\S]*?max\(16px, 7cqw\)/);
  assert.match(CSS, /\.pack-stage\[data-tearing="true"\]/);
});

test("ouverture : pas d'attente ni de rechargement serveur avant la révélation", () => {
  const STATION = read("src/components/booster-station.tsx");
  // Les commentaires citent volontairement `router.refresh()` : on les retire
  // avant de compter les appels réels.
  const code = (source: string) => source.replace(/\/\/[^\n]*/g, "");

  for (const [name, source] of [
    ["picker", code(PICKER)],
    ["station", code(STATION)],
  ] as const) {
    assert.doesNotMatch(source, /new Promise\(\(resolve\) => setTimeout/, `${name} : attente artificielle`);
    assert.match(source, /busy\.current/, `${name} : verrou anti-double-clic manquant`);
    assert.equal((source.match(/router\.refresh\(\)/g) ?? []).length, 1, `${name} : refresh unique attendu`);
    // La révélation vit hors du composant (`setPendingReveal`) : elle est
    // effacée à la fermeture, puis la page est relue.
    assert.match(
      source,
      /setPendingReveal\(null\);[\s\S]{0,200}router\.refresh\(\)/,
      `${name} : refresh à la fermeture`,
    );
  }
});

test("révélation : cadre stable et étincelles au-dessus de Rare", () => {
  assert.match(CSS, /\.reveal-stage\s*\{[\s\S]*?display:\s*grid/);
  assert.match(CSS, /\.reveal-stage\s*>\s*\*\s*\{[\s\S]*?grid-area:\s*1\s*\/\s*1/);
  assert.match(CSS, /\.reveal-foot\s*\{[\s\S]*?min-height:/);
  assert.match(CSS, /\.reveal-stage \.aura-stage\[data-fading="true"\][\s\S]*?opacity:\s*0/);
  assert.match(REVEAL, /HOT_RARITIES: Rarity\[\] = \["SR", "UR", "L"\]/);
  assert.match(REVEAL, /className="reveal-sparks"/);
  assert.match(CSS, /\.reveal-spark\s*\{[\s\S]*?animation:\s*spark-fly/);
});

test("pack indisponible : désaturé, incliné, avec la progression du seuil", () => {
  assert.match(CSS, /\[data-locked="true"\][\s\S]*?grayscale/);
  assert.match(CSS, /\n\.pack-poster\[data-locked="true"\][\s\S]*?transform:\s*perspective/);
  assert.match(LAB, /locked=\{unavailable\}/);
  assert.match(LAB, /Bientôt · \{MIN_POOL_SIZE - 6\} \/ \{MIN_POOL_SIZE\} persos/);
});

test("démo : /dev/packs, douze posters, fond clair/sombre, pack simulé", () => {
  assert.match(DEMO, /PackLab/);
  assert.match(DEMO, /is_admin/);
  assert.match(DEMO, /robots: \{ index: false, follow: false \}/);
  assert.match(LAB, /PACKS\.map/);
  assert.match(LAB, /Fond clair/);
  assert.match(LAB, /Fond sombre/);
  assert.match(LAB, /Simuler un pack indisponible/);
});
