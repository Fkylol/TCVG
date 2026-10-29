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

test("rareté : chaque niveau porte sa couleur", () => {
  for (const rarity of TIERS) {
    assert.match(
      rarityBlock(rarity),
      new RegExp(`--rarity:\\s*var\\(--rarity-${TOKENS[rarity]}\\)`),
      `couleur ${rarity} non branchée`,
    );
  }
});

/** Intensité de la pellicule d'une rareté, lue dans le CSS. */
function holoStrength(rarity: string): number {
  const match = CSS.match(
    new RegExp(`\\.card-face\\[data-rarity="${rarity}"\\] \\{\\s*--ho: ([0-9.]+);`),
  );
  assert.ok(match, `--ho introuvable pour ${rarity}`);
  return Number(match[1]);
}

test("pellicule : le Commun reste mat, les autres montent sans reculer", () => {
  // Le Commun n'a ni foil ni reflet : aucun calque à composer.
  assert.match(
    CSS,
    /\.card-face\[data-rarity="C"\] \.card-holo,[\s\S]{0,120}?display: none;/,
  );

  const steps = (["UC", "R", "SR", "UR", "L"] as const).map(holoStrength);
  for (let index = 1; index < steps.length; index += 1) {
    assert.ok(steps[index] > steps[index - 1], `pellicule au palier ${index + 1}`);
  }
  assert.equal(steps.at(-1), 0.85);
  // Une copie brillante pousse la pellicule à fond.
  assert.match(CSS, /\.card-face\[data-holo="true"\] \{\s*--ho: 1;/);

  // Rien au repos : la pellicule est proportionnelle au survol, et une carte
  // qu'on ne touche pas n'a donc aucun voile sur son illustration — c'est ce
  // qui garde aux visuels leur contraste dans une grille. Sous la main elle
  // monte à sa pleine densité (`--ho`).
  assert.match(
    CSS,
    /\.card-holo \{[\s\S]*?opacity: calc\(var\(--ho, 0\) \* var\(--intensity, 0\)\);/,
    "la pellicule doit suivre le pointeur, sans reste au repos",
  );
  // Le reflet suit exactement la même règle : en `overlay`, posé en permanence
  // sur toute la surface, il bouchait les noirs et écrasait les hautes lumières
  // de chaque visuel.
  assert.match(
    CSS,
    /\.card-glare \{[\s\S]*?opacity: var\(--intensity, 0\);/,
    "le reflet doit s'éteindre au repos",
  );
});

test("copie brillante : la pellicule revient, mais sous la main", () => {
  // Le Commun reste mat, sauf sur une copie brillante : la pellicule y est
  // réaffichée même quand la rareté la coupe.
  assert.match(
    CSS,
    /\.card-face\[data-holo="true"\] \.card-holo,\s*\n\.card-face\[data-holo="true"\] \.card-glare \{\s*display: block;/,
  );

  // Elle s'allume comme les autres : au repos, l'illustration reste nette, et
  // c'est l'étoile `✦` de la vignette qui annonce la copie holo.
  assert.match(
    CSS,
    /\.card-face\[data-holo="true"\] \.card-holo \{\s*opacity: var\(--intensity, 0\);\s*\}/,
    "la règle de la copie brillante a changé de forme",
  );
  // Plus aucune pellicule allumée sans pointeur : ni dérive de teintes, ni
  // reste d'opacité sur une variante.
  assert.doesNotMatch(CSS, /@keyframes holo-drift/);
  assert.doesNotMatch(
    CSS,
    /\.card-holo \{\s*opacity: calc\([0-9.]+ \+ [0-9.]+ \* var\(--intensity, 0\)\);/,
    "une pellicule brille encore au repos",
  );

  // Le Commun reste mat, sauf sur une copie brillante : les deux sélecteurs ont
  // la même spécificité, donc c'est l'ordre du fichier qui décide.
  assert.ok(
    CSS.indexOf('.card-face[data-rarity="C"] .card-holo') <
      CSS.indexOf('.card-face[data-holo="true"] .card-holo'),
    "la règle de la copie brillante doit passer après celle du Commun",
  );
  // Reverse garde son propre foil : la pellicule de fenêtre reste éteinte.
  assert.ok(
    CSS.indexOf('.card-face[data-variant="reverse"] .card-holo') >
      CSS.indexOf('.card-face[data-holo="true"] .card-holo'),
    "Reverse doit garder le dernier mot sur la pellicule",
  );
});

test("pellicule : le Mythique a le seul foil prismatique", () => {
  const mythic = CSS.slice(
    CSS.indexOf('.card-face[data-rarity="L"] {\n  --foil'),
    CSS.indexOf("/* Grain fin du carton. */"),
  );
  assert.ok(mythic.length > 0, "foil du Mythique introuvable");
  assert.match(mythic, /repeating-linear-gradient\(\s*125deg/);
  assert.match(mythic, /#ff4a6e/);
  assert.match(mythic, /#4ad7ff/);
  // Les autres raretés déclinent simplement la couleur du carton.
  assert.match(CSS, /--foil: repeating-linear-gradient\([\s\S]*?var\(--rarity\)/);
});

test("rareté : le Mythique a sa bordure prismatique", () => {
  assert.match(CSS, /data-rarity="L"\]::before/);
  // L'anneau est posé dans le padding box : sur la bordure, il serait clippé.
  assert.match(
    CSS,
    /data-rarity="L"\]::before \{[^}]*inset: 0;/,
    "l'anneau prismatique doit rester dans la zone non clippée",
  );
  assert.match(CSS, /conic-gradient\(/);
  // L'anneau tourne avec l'inclinaison de la carte.
  assert.match(CSS, /conic-gradient\(\s*from calc\(140deg \+ var\(--rx\) \* 3\)/);
});

test("calques : la pellicule vit dans la fenêtre d'illustration, sous le numéro", () => {
  assert.match(CARD_FACE, /className="card-holo"/);
  assert.match(CARD_FACE, /className="card-glare"/);
  assert.ok(
    CARD_FACE.indexOf('className="card-art"') < CARD_FACE.indexOf('className="card-holo"'),
    "la pellicule doit être posée dans la fenêtre d'illustration",
  );
  assert.match(CSS, /\.card-holo\s*\{[\s\S]*?z-index:\s*2;/);
  assert.match(CSS, /\.card-holo\s*\{[\s\S]*?pointer-events:\s*none;/);
  // Le numéro d'album et les étiquettes restent au-dessus de la pellicule.
  assert.match(CSS, /\.card-number\s*\{[\s\S]*?z-index:\s*4;/);
});

test("variantes : chaque misprint a un rendu et un libellé", () => {
  for (const variant of ["holo_bleed", "off_center", "ghosting", "reverse", "holo_blue"]) {
    assert.match(CSS, new RegExp(`data-variant="${variant}"`), `variante ${variant}`);
  }
  // Reverse : la pellicule quitte le visuel pour le cadre.
  assert.match(CSS, /data-variant="reverse"\] \.card-holo,[\s\S]*?display: none/);
  // Holo bleue : elle reste visible même sur une Commune, sinon le défaut
  // disparaîtrait sur la majorité des cartes.
  assert.match(CSS, /data-variant="holo_blue"\] \.card-holo \{\s*display: block;/);
  assert.match(CARD_FACE, /VARIANT_LABELS\[variant\]/);
  assert.match(CARD_FACE, /variant !== "normal"/);
  assert.match(CARD_FACE, /data-variant=\{variant\}/);
});

test("accessibilité : prefers-reduced-motion éteint l'inclinaison, pas la pellicule", () => {
  const start = CSS.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(start > 0);
  const block = CSS.slice(start, start + 2600);
  assert.match(block, /transform: none/);
  // La pellicule reste allumée : elle ne bouge qu'avec le pointeur.
  assert.match(block, /html:not\(\[data-motion="full"\]\) \.card-holo,/);
  assert.match(block, /transition: none;/);
  // La dérive d'une copie brillante se fige au lieu de tourner.
  assert.match(
    block,
    /html:not\(\[data-motion="full"\]\) \.card-face\[data-holo="true"\] \.card-holo \{\s*animation: none;/,
  );
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

test("performance : la pellicule est purement CSS, sans particule à rendre", () => {
  // Deux calques vides : aucune particule, aucun tirage aléatoire, donc rien
  // à hydrater et rien à recalculer frame par frame côté React.
  assert.doesNotMatch(CARD_FACE, /CardSparkles|Math\.random/);
  assert.doesNotMatch(CARD_FACE, /card-shine/);
  assert.match(CARD_FACE, /<span className="card-holo" aria-hidden \/>/);
  assert.equal((CARD_FACE.match(/className="card-(holo|glare)"/g) ?? []).length, 2);
  // Le Commun n'affiche aucun calque, et les textures sont servies en local.
  assert.match(CSS, /--holo-glitter: url\("\/textures\/holo-glitter\.png"\)/);
  assert.match(CSS, /--holo-foil: url\("\/textures\/holo-foil\.png"\)/);
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
  // La transformation est retirée le temps de la lecture, sinon la mesure
  // porterait sur la boîte inclinée.
  assert.match(TILT, /node\.style\.transform = "none";[\s\S]{0,120}getBoundingClientRect\(\)/);
  // Mesurée une fois par survol, pas à chaque image.
  assert.match(TILT, /const measure = useCallback\(\(node: T\) => \{/);
});

test("inclinaison : le pointeur posé sur un bord ne fait plus sauter la carte", () => {
  // La forme inclinée s'écarte du curseur : un `pointerleave` ne suffit pas à
  // conclure, sinon la carte sort, revient à plat, est survolée, ressort…
  assert.match(TILT, /const EDGE_SLACK = 8;/);
  assert.match(
    TILT,
    /onPointerLeave\(event: ReactPointerEvent<T>\) \{[\s\S]{0,400}if \(inside\(event\.clientX, event\.clientY\)\) return;/,
  );
  // Le pointeur reste suivi sur le document pendant le survol : près d'un
  // bord, la carte ne reçoit plus les déplacements.
  assert.match(TILT, /document\.addEventListener\("pointermove", onMove, \{ passive: true \}\)/);
  assert.match(TILT, /removeEventListener\("pointermove", onMove\)/);
});

test("visionneuse : l'inclinaison vit à l'extérieur du retournement", () => {
  // Trois étages : perspective sur la scène, inclinaison sur le conteneur,
  // retournement sur la carte intérieure.
  assert.match(CSS, /\.flip-stage \{\s*perspective: 900px;/);
  assert.match(
    CSS,
    /\.card-flip-tilt \{[\s\S]*?transform: rotateX\(var\(--rx\)\) rotateY\(var\(--ry\)\);/,
  );
  assert.match(CSS, /\.card-flip\[data-flipped="true"\] \{\s*transform: rotateY\(180deg\);\s*\}/);
  assert.match(
    CSS,
    /\.card-flip \{[\s\S]*?transition: transform 600ms cubic-bezier\(0\.3, 0\.7, 0\.2, 1\);/,
  );

  // Les axes ne sont jamais retournés, et le retournement n'est jamais posé
  // sur le conteneur d'inclinaison (il écraserait le rotateY du verso).
  assert.doesNotMatch(CSS, /--flip/);
  assert.doesNotMatch(CSS, /\.card-flip-tilt\[data-flipped/);

  // Le conteneur d'inclinaison enveloppe le retournement.
  assert.ok(
    FLIP.indexOf('className="card-flip-tilt') < FLIP.indexOf('className="card-flip"'),
    "l'inclinaison doit rester à l'extérieur du retournement",
  );
  assert.doesNotMatch(FLIP, /data-flipped=\{flipped\}\s+data-flipping/);
  assert.match(FLIP, /const FLIP_MS = 600;/);
  // La carte ouverte s'incline plus franchement que les vignettes.
  assert.match(FLIP, /useCardTilt<HTMLDivElement>\(25\)/);
  assert.match(TILT, /useCardTilt<T extends HTMLElement>\(maxTilt: number = MAX_TILT\)/);

  // Verso : l'inclinaison est coupée, la carte se remet à plat.
  assert.match(CSS, /\.card-flip-tilt\[data-flat="true"\] \{\s*transform: none;/);
  assert.match(FLIP, /\{\.\.\.\(flipped \? \{\} : tilt\)\}/);
  assert.match(FLIP, /data-flat=\{flipped \? "true" : undefined\}/);

  // Deux faces superposées, dos caché, verso tourné de 180°.
  assert.match(CSS, /\.card-flip-face \{[\s\S]*?position: absolute;/);
  assert.match(CSS, /\.card-flip-face \{[\s\S]*?backface-visibility: hidden;/);
  assert.match(CSS, /\.card-flip-back \{[\s\S]*?transform: rotateY\(180deg\);/);
});

test("visionneuse : les variables d'inclinaison traversent la carte", () => {
  // `useCardTilt` écrit `--rx`/`--ry`/`--tx`/`--ty`/`--intensity` sur
  // `.card-flip-tilt`, au-dessus de la carte : le foil et le reflet les lisent
  // par héritage. Une déclaration sur `.card-face` elle-même les masquerait,
  // et la pellicule resterait figée, imprimée sur le carton.
  const face = CSS.slice(CSS.indexOf("\n.card-face {"), CSS.indexOf('.card-face[data-size="sm"]'));
  for (const name of ["--rx", "--ry", "--tx", "--ty", "--intensity"]) {
    assert.doesNotMatch(
      face,
      new RegExp(`${name}:`),
      `${name} ne doit pas être déclaré sur .card-face`,
    );
  }

  // Les valeurs de repos vivent à la racine : elles ne font que fournir un
  // défaut à qui n'en reçoit aucun.
  const rootStart = CSS.indexOf(":root {\n  --rx");
  assert.ok(rootStart > 0, "les valeurs de repos de l'inclinaison sont introuvables");
  const root = CSS.slice(rootStart, CSS.indexOf("\n}", rootStart));
  for (const name of ["--rx", "--ry", "--tx", "--ty", "--intensity", "--tilt-scale"]) {
    assert.match(root, new RegExp(`${name}:`), `${name} manque aux valeurs de repos`);
  }
});

test("vignette : les étages de texte ne se compressent pas", () => {
  // Trois étages fixes — en-tête, univers, statistiques — et un seul souple :
  // l'illustration. Compressés, le nom et l'univers se coupaient en deux au
  // lieu de déborder franchement, et les stats passaient sous le bord.
  assert.match(
    CSS,
    /\.card-head,\s*\n\.card-universe,\s*\n\.card-stats \{\s*flex: 0 0 auto;\s*\}/,
  );

  // La vignette d'annonce du marché était trop étroite (80 px) pour une carte
  // en taille « sm » : les deux listes, actives et terminées, lui donnent 96 px.
  const MARKET = readFileSync(path.join(ROOT, "src/components/market-browser.tsx"), "utf8");
  assert.equal(
    (MARKET.match(/w-24 shrink-0 self-start/g) ?? []).length,
    2,
    "les deux listes d'annonces doivent partager la même vignette",
  );
  assert.doesNotMatch(MARKET, /w-20 shrink-0/);
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
  // La pellicule sort de l'arbre le temps de la rotation.
  assert.match(FLIP, /data-flipping=/);
  assert.match(
    CSS,
    /\.card-flip-tilt\[data-flipping="true"\] \.card-face \.card-holo,[\s\S]*?display: none;/,
  );
});
