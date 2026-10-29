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
const HOST = read("src/components/reveal-host.tsx");
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
  assert.match(HOOK, /useFitTitle\(maxRatio = 0\.8, contentKey\?: string\)/);
  assert.match(HOOK, /\}, \[maxRatio, contentKey\]\);/);
  assert.match(COMPONENT, /useFitTitle\(0\.8, pack\.id\)/);
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
  assert.match(CSS, /\.pack-stage \{[\s\S]*?animation: pack-hover/);
  assert.match(CSS, /@keyframes pack-hover/);
  assert.match(CSS, /\.pack-cast \{[\s\S]*?radial-gradient/);
  // Mouvement réduit : ni flottement ni pulsation d'ombre.
  assert.match(CSS, /prefers-reduced-motion[\s\S]*?\.pack-cast/);
  assert.match(REVEAL, /Passer l'animation/);
  assert.match(REVEAL, /Doublon ×/);
  // Le poster déchiré est celui du pack réellement ouvert : l'hôte le relit
  // dans la liste complète, à partir du pack noté dans la révélation.
  assert.match(HOST, /getPack\(reveal\.packId\)/);
  assert.match(HOST, /pack=\{pack\}/);
  // La soudure se déchire au doigt : trois morceaux du même poster, la ligne
  // de soudure révélée derrière le doigt, et le point qui suit le geste.
  assert.match(REVEAL, /className="pack-half pack-body"/);
  assert.match(REVEAL, /pack-strip-right/);
  assert.match(REVEAL, /pack-strip-left/);
  assert.match(REVEAL, /onPointerMove/);
  assert.match(CSS, /\.pack-seam-line\s*\{[\s\S]*?vector-effect: non-scaling-stroke/);
  assert.match(CSS, /\.pack-spark\s*\{[\s\S]*?box-shadow: 0 0 10px 4px/);
  assert.match(CSS, /\.pack-stage\[data-tearing="true"\]/);
  assert.match(CSS, /\.pack-stage\[data-torn="true"\] \.pack-fringe/);
});

/** Contenu d'une règle ou d'un bloc `@keyframes`, accolades intérieures comprises. */
function cssBlock(css: string, header: string): string {
  const start = css.indexOf(header);
  assert.ok(start !== -1, `bloc introuvable : ${header}`);
  let depth = 0;
  let index = css.indexOf("{", start);
  const from = index;
  while (index < css.length) {
    if (css[index] === "{") depth += 1;
    else if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
    index += 1;
  }
  return css.slice(from + 1, index);
}

test("ouverture : la soudure cède dans une explosion de confettis et de traînées", () => {
  // La gerbe éclate au milieu de la soudure, en haut du sachet — pas au centre
  // du poster, où la lumière sortait de nulle part.
  assert.match(REVEAL, /className="fx-stage"/);
  assert.match(REVEAL, /className="fx-origin"/);
  assert.match(cssBlock(CSS, ".fx-origin {"), /top: 8\.4%/);
  // Elle n'est jouée qu'une fois la soudure cédée (`progress >= 1`).
  assert.match(REVEAL, /\{progress >= 1 && \(/);

  // Elle est un calque à part, posé après l'aura et devant le poster sur
  // lequel elle éclate : solidaire de l'aura, elle s'éteindrait avec elle dès
  // la sortie des cartes.
  assert.ok(
    REVEAL.indexOf('className="fx-stage"') > REVEAL.indexOf('className="aura-stage"'),
    "la gerbe est un calque à part, après l'aura",
  );
  const aura = REVEAL.match(/<div className="aura-stage"[\s\S]*?<\/div>\s*\)\}/)?.[0] ?? "";
  assert.ok(aura.includes("aura-seed"), "bloc d'aura introuvable");
  assert.doesNotMatch(aura, /fx-/, "la gerbe n'est pas solidaire de l'aura");
  const stage = cssBlock(CSS, ".fx-stage {");
  assert.match(stage, /z-index: 30/);
  assert.match(stage, /overflow: hidden/);
  assert.match(stage, /pointer-events: none/);

  // Aucune particule tirée au hasard : le rendu serveur doit égaler le client.
  assert.doesNotMatch(REVEAL, /Math\.random/);
  assert.match(REVEAL, /const TRAILS = Array\.from\(\{ length: 18 \}/);
  assert.match(REVEAL, /const BLAST_SPARKS = Array\.from\(\{ length: 22 \}/);
  assert.match(REVEAL, /const CONFETTI = Array\.from\(\{ length: 64 \}/);
  const confettiParts = REVEAL.slice(REVEAL.indexOf("const CONFETTI = "));
  assert.match(confettiParts, /delay: \(index % 8\) \* 26/, "les confettis partent par vagues");
  // L'ancienne poussière qui montait a disparu des deux côtés.
  assert.doesNotMatch(REVEAL, /aura-mote/);
  assert.doesNotMatch(CSS, /\.aura-mote\b/);
  assert.doesNotMatch(CSS, /\.fw-burst|\.fw-flake|@keyframes fw-fly|@keyframes fw-wave/);

  // La gerbe ne touche à rien d'autre qu'à `transform` et `opacity`.
  const frames = ["fx-flash", "fx-bloom", "fx-wave", "fx-trail", "fx-spark", "fx-confetti"];
  for (const name of frames) {
    const block = cssBlock(CSS, `@keyframes ${name} {`);
    assert.match(block, /opacity:/, `images clés ${name} muettes`);
    assert.doesNotMatch(
      block,
      /(top|left|width|height|margin|box-shadow|filter):/,
      `images clés ${name} hors du compositeur`,
    );
  }
  assert.match(CSS, /\.fx-confetti\s*\{[\s\S]*?animation: fx-confetti/);
  assert.match(CSS, /\.fx-trail\s*\{[\s\S]*?animation: fx-trail/);
  assert.match(CSS, /\.fx-spark\s*\{[\s\S]*?animation: fx-spark/);
  assert.match(CSS, /\.fx-wave\s*\{[\s\S]*?animation: fx-wave/);

  // Le confetti monte, culbute (`scaleX`) puis retombe plus bas que sa course.
  const confetti = cssBlock(CSS, "@keyframes fx-confetti {");
  assert.match(confetti, /calc\(var\(--fx-x, 0px\) \* 0\.58\)/);
  assert.match(confetti, /calc\(var\(--fx-y, 0px\) \+ var\(--fx-fall, 0px\)\)/);
  assert.match(confetti, /rotate\(calc\(var\(--fx-spin, 360deg\) \* 0\.36\)\)/);
  assert.match(confetti, /scaleX\(0\.22\)/);
  assert.match(confetti, /rotate\(var\(--fx-spin, 360deg\)\)/);

  // Trois formes de confetti, six tons, trois ondes de choc étalées.
  assert.match(CSS, /\.fx-confetti\[data-shape="dot"\]/);
  assert.match(CSS, /\.fx-confetti\[data-shape="ribbon"\]/);
  assert.match(REVEAL, /"flake" as const/);
  for (const tone of ["aura", "cyan", "violet", "pink", "white", "gold"]) {
    assert.match(CSS, new RegExp(`\\.fx-confetti\\[data-tone="${tone}"\\]`), tone);
  }
  assert.match(REVEAL, /const WAVES = \[0, 96, 208\]/);
  assert.equal(
    (REVEAL.match(/const WAVES = \[([^\]]*)\]/)?.[1].split(",").length ?? 0),
    3,
    "trois ondes de choc attendues",
  );
  assert.match(REVEAL, /\{WAVES\.map\(\(delay\) => \(/);

  // Économie d'énergie : la gerbe ne part pas du tout (chaque pièce reste à
  // `opacity: 0`).
  assert.match(CSS, /html:not\(\[data-motion="full"\]\) \.fx-confetti,/);
  assert.match(CSS, /html:not\(\[data-motion="full"\]\) \.fx-trail,/);

  // Le flash de la soudure et ses fibres ont quitté le vert de l'ancienne
  // identité pour le cyan de la marque : plus une seule teinte lime dans
  // l'ouverture.
  assert.doesNotMatch(CSS, /214, 255, 170|226, 255, 190/);
  assert.match(CSS, /\.pack-fringe\s*\{[\s\S]*?rgba\(54, 226, 255, 0\.6\)/);
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
    const opening = source.slice(source.indexOf("async function open()"), source.indexOf("\n  return (", source.indexOf("async function open()")));
    // La révélation vit hors du composant (`setPendingReveal`) et c'est l'hôte
    // unique qui la ferme : aucun rechargement serveur ici, ni pendant
    // l'ouverture ni pour effacer la révélation.
    assert.doesNotMatch(opening, /router\.refresh\(\)/, `${name} : rechargement pendant l'ouverture`);
    assert.doesNotMatch(opening, /setPendingReveal\(null\)/, `${name} : effacement pendant l'ouverture`);
  }

  // L'hôte, à la racine : il affiche la révélation en attente et relit la page
  // à sa fermeture, où que l'ouverture ait eu lieu.
  assert.match(code(HOST), /setPendingReveal\(null\);[\s\S]{0,200}router\.refresh\(\)/);
  assert.equal((code(HOST).match(/router\.refresh\(\)/g) ?? []).length, 1, "hôte : refresh unique");
});

test("révélation : la carte sort au format du poster, ni plus large ni plus haute", () => {
  // Le poster du booster et les cartes partagent le même cadre 5/8 : la carte
  // qui sort du sachet ne peut pas être plus grande que lui, et le passage du
  // sachet déchiré aux cartes ne change pas de gabarit.
  assert.match(CSS, /\.pack-poster \{[\s\S]*?aspect-ratio: 5 \/ 8/);
  assert.match(CSS, /\.reveal-stage \.rip-fan \{[\s\S]*?height: 100%/);
  assert.match(CSS, /\.reveal-stage \.rip-fan \{[\s\S]*?aspect-ratio: 5 \/ 8/);
  // La carte du dessus n'est plus agrandie de 5 % par-dessus les suivantes.
  assert.match(CSS, /scale\(calc\(1 - var\(--slot\) \* 0\.012\)\)/);
  assert.doesNotMatch(CSS, /scale\(calc\(1\.05 - var\(--slot\)/);
});

test("révélation : cadre stable et étincelles au-dessus de Rare", () => {
  assert.match(CSS, /\.reveal-stage\s*\{[\s\S]*?display:\s*grid/);
  assert.match(CSS, /\.reveal-stage\s*>\s*\*\s*\{[\s\S]*?grid-area:\s*1\s*\/\s*1/);
  assert.match(CSS, /\.reveal-foot\s*\{[\s\S]*?min-height:/);
  assert.match(CSS, /\.reveal-stage \.aura-stage\[data-fading="true"\][\s\S]*?opacity:\s*0/);
  assert.match(REVEAL, /HOT_RARITIES: Rarity\[\] = \["SR", "UR", "L"\]/);
  assert.match(REVEAL, /className="reveal-sparks"/);
  assert.match(CSS, /\.reveal-spark\s*\{[\s\S]*?animation:\s*spark-fly/);
  // Les cartes sortent en pile, seule celle du dessus se retourne.
  assert.match(CSS, /\.rip-card\[data-slot="0"\]\s*\{[\s\S]*?pointer-events: auto/);
  assert.match(CSS, /\.rip-card\[data-flipped="true"\] \.rip-card-inner/);
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

/**
 * Largeur du titre, en pourcentage de celle du poster, par unité de `cqw`.
 *
 * Mesuré sur la planche `/dev/packs`, Syne 800 chargée : le rapport est le même
 * à toutes les largeurs de pack (le titre et le poster grandissent ensemble),
 * donc ces valeurs suffisent à vérifier n'importe quel agencement. Une carte
 * renommée ou une taille de titre retouchée doit être remesurée ici.
 */
const TITLE_UNITS: Record<string, number> = {
  mix: 2.87,
  "action-aventure": 7.03,
  plateforme: 9.07,
  rpg: 3.67,
  mmo: 4.47,
  fps: 3.33,
  inde: 3.47,
  combat: 6.72,
  horreur: 5.94,
  strategie: 7.16,
  halloween: 8.39,
};

test("titre : aucun pack n'écrit plus large que lui, même sans JavaScript", () => {
  // Le titre est réglé en `cqw` ; l'ajustement côté navigateur ne fait que le
  // rogner en dernier recours. Ce qu'il faut garantir, c'est qu'il tient déjà
  // au repos — au premier rendu, ou si le calcul ne tourne pas.
  for (const pack of PACKS) {
    const unit = TITLE_UNITS[pack.id];
    assert.ok(unit, `rapport non mesuré pour ${pack.id}`);
    const width = pack.titleSize * unit;
    assert.ok(
      width <= 80,
      `${pack.id} : le titre occupe ${width.toFixed(1)} % du pack à sa taille de repos`,
    );
  }
});
