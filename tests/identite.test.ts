import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const readBytes = (file: string) => readFileSync(path.join(ROOT, file));

/** Tous les fichiers de style et de rendu, pour les garde-fous d'identité. */
function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, files);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) files.push(rel);
  }
  return files;
}

const SOURCES = walk("src");

const CSS = read("src/app/globals.css");
const LAYOUT = read("src/app/layout.tsx");
const HEADER = read("src/components/site-header.tsx");
const FOOTER = read("src/components/site-footer.tsx");
const LOGO = read("src/components/logo-mark.tsx");

test("identité : le bleu nuit de la vitrine remplace le noir mat et le lime", () => {
  assert.match(CSS, /--ink: #080a16/);
  assert.match(CSS, /--cyan: #36e2ff/);
  assert.match(CSS, /--violet: #8b7bff/);
  assert.match(CSS, /--pink: #ff4fd8/);
  // Le lime a disparu : l'accent principal est le cyan.
  assert.doesNotMatch(CSS, /#b6ff2e/);
  assert.doesNotMatch(CSS, /182,\s*255,\s*46/);
  // Le jeton `acid` a disparu avec le lime : plus de `--acid`, donc plus aucun
  // utilitaire `bg-acid` / `text-acid` à traîner dans les pages.
  assert.doesNotMatch(CSS, /--acid/);
  assert.doesNotMatch(CSS, /--color-acid/);
  assert.match(CSS, /--cyan-line: rgba\(54, 226, 255, 0\.34\)/);
  assert.match(CSS, /--cyan-wash: rgba\(54, 226, 255, 0\.12\)/);
  assert.match(CSS, /@theme inline \{[\s\S]*?--color-cyan: #36e2ff/);
});

test("identité : plus une seule couleur lime dans le code de l'application", () => {
  // Vert lime de l'ancienne identité : aucun fichier ne doit le cacher en dur,
  // ni sous son nom de jeton (`acid`), ni sous l'une de ses teintes.
  const LIME_HEXES = /#(?:b6ff2e|c8ff4d|d6ffaa|dcffa8|e2ffbe)/i;
  const ACID_TOKEN = /--acid|["']acid["']|acid-(?:line|wash)|(?:bg|text|border|btn)-acid/;

  for (const file of SOURCES) {
    const content = read(file);
    assert.doesNotMatch(content, LIME_HEXES, `lime codé en dur : ${file}`);
    assert.doesNotMatch(content, ACID_TOKEN, `jeton acid restant : ${file}`);
  }
});

test("identité : les aurores éclairent le haut de chaque page", () => {
  const body = CSS.match(/body \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(body, /background-color: var\(--ink\)/);
  assert.match(body, /radial-gradient\([^)]*rgba\(54, 226, 255, 0\.2\)/);
  assert.match(body, /radial-gradient\([^)]*rgba\(255, 79, 216, 0\.18\)/);
  // Posées en fond de page : jamais de calque devant le contenu.
  assert.doesNotMatch(CSS, /\.aurora\s*\{/);
});

test("identité : Syne, DM Sans et IBM Plex Mono", () => {
  assert.match(LAYOUT, /import \{ DM_Sans, IBM_Plex_Mono, Syne \} from "next\/font\/google"/);
  assert.match(LAYOUT, /variable: "--font-dm-sans"/);
  assert.match(LAYOUT, /variable: "--font-plex-mono"/);
  assert.match(LAYOUT, /variable: "--font-syne"/);
  assert.match(LAYOUT, /weight: \["600", "800"\]/);
  assert.match(LAYOUT, /className=\{`\$\{dmSans\.variable\} \$\{plexMono\.variable\} \$\{syne\.variable\}/);
  assert.doesNotMatch(LAYOUT, /Geist|JetBrains_Mono|Space_Mono/);

  assert.match(CSS, /--font-sans: var\(--font-dm-sans\)/);
  assert.match(CSS, /--font-display: var\(--font-syne\)/);
  assert.match(CSS, /--font-mono: var\(--font-plex-mono\)/);
  assert.doesNotMatch(CSS, /--font-geist-sans|--font-jetbrains|--font-space-mono/);
});

test("identité : titres en dégradé, filets de marque, plaques de verre", () => {
  // Les titres lisent le dégradé par `text-fill` : les utilitaires `text-*`
  // des pages ne peuvent pas l'éteindre.
  assert.match(CSS, /\.display \{[\s\S]*?background: var\(--brand\)/);
  assert.match(CSS, /\.display \{[\s\S]*?-webkit-text-fill-color: transparent/);
  assert.match(CSS, /--brand: linear-gradient\(90deg, var\(--cyan\), var\(--violet\) 55%, var\(--pink\)\)/);

  // Un titre décoratif doit pouvoir s'effacer : le filigrane d'univers ressortait
  // en pleine couleur derrière le nom du personnage, à la même taille que lui.
  assert.match(
    CSS,
    /\.display-ghost \{\s*background: none;\s*-webkit-text-fill-color: currentColor;/,
  );
  assert.match(read("src/app/(game)/card/[id]/page.tsx"), /display display-ghost/);
  assert.match(CSS, /\.eyebrow \{[\s\S]*?font-family: var\(--font-mono\)/);
  assert.match(CSS, /\.eyebrow::before \{[\s\S]*?background: var\(--brand\)/);
  assert.match(CSS, /\.title-rule \{[\s\S]*?background: var\(--brand\)/);

  assert.match(CSS, /--radius: 18px/);
  assert.match(CSS, /\.panel \{[\s\S]*?background: var\(--panel-bg\)/);
  assert.match(CSS, /--panel-bg: rgba\(255, 255, 255, 0\.045\)/);
});

test("identité : boutons et onglets en pastilles", () => {
  assert.match(CSS, /\.btn \{[\s\S]*?border-radius: var\(--pill\)/);
  assert.match(CSS, /\.btn-primary \{[\s\S]*?background: var\(--brand\)/);
  assert.match(CSS, /\.btn-primary \{[\s\S]*?color: var\(--ink\)/);
  assert.match(CSS, /\.btn-primary:hover:not\(:disabled\) \{[\s\S]*?transform: translateY\(-2px\)/);
  assert.match(CSS, /\.tabs \{[\s\S]*?border-radius: var\(--pill\)/);
  assert.match(CSS, /\.tab\[aria-current="page"\] \{[\s\S]*?box-shadow: inset 0 -2px 0 0 var\(--cyan\)/);
  assert.match(CSS, /\.chip \{[\s\S]*?border-radius: var\(--pill\)/);
  assert.match(CSS, /\.field:focus \{[\s\S]*?box-shadow: 0 0 0 3px rgba\(54, 226, 255, 0\.16\)/);
});

test("identité : le logo est dessiné et la barre du haut est en verre", () => {
  assert.match(LOGO, /viewBox="0 0 34 34"/);
  assert.match(LOGO, /<linearGradient id=\{gradient\}/);
  assert.match(LOGO, /stopColor="var\(--cyan\)"/);
  assert.match(LOGO, /stopColor="var\(--pink\)"/);
  assert.match(LOGO, /<rect[\s\S]*?rx="9"[\s\S]*?stroke=\{`url\(#\$\{gradient\}\)`\}/);
  assert.match(LOGO, /<circle cx="17" cy="17" r="6\.5"/);

  assert.match(HEADER, /import \{ LogoMark \} from "@\/components\/logo-mark"/);
  assert.match(HEADER, /<LogoMark id="header"/);
  assert.doesNotMatch(HEADER, /logo\.png/);
  assert.match(HEADER, /className="topbar mx-auto flex max-w-6xl/);
  assert.match(CSS, /\.topbar \{[\s\S]*?backdrop-filter: blur\(var\(--glass-blur\)\)/);
  assert.match(CSS, /--glass: rgba\(10, 13, 28, 0\.72\)/);

  assert.match(FOOTER, /<LogoMark id="footer"/);
});

test("identité : l'onglet porte le même logo que le site", () => {
  // L'onglet lisait encore l'ancien logo lime : le dessin vient désormais du
  // fichier d'icône `src/app/icon.svg`, au même tracé que `LogoMark`.
  const ICON = read("src/app/icon.svg");
  assert.match(ICON, /viewBox="0 0 34 34"/);
  // Le fond du cadre et le dégradé de la marque (cyan vers rose).
  assert.match(ICON, /fill="#080a16"/);
  assert.match(ICON, /stop-color="#36e2ff"/);
  assert.match(ICON, /stop-color="#ff4fd8"/);
  // Mêmes formes que le logo de l'en-tête, à l'épaisseur de trait près.
  assert.match(ICON, /<rect[^>]*width="30\.8"[^>]*rx="9"/);
  assert.match(ICON, /<circle cx="17" cy="17" r="6\.5"/);

  // Le favicon de secours (navigateurs sans SVG) garde les mêmes tailles :
  // 16, 32 et 48 px, chacune encapsulée en PNG.
  const ICO = readBytes("src/app/favicon.ico");
  assert.equal(ICO.readUInt16LE(0), 0);
  assert.equal(ICO.readUInt16LE(2), 1);
  assert.equal(ICO.readUInt16LE(4), 3);
  assert.deepEqual([...ICO.subarray(6, 12)], [16, 16, 0, 0, 1, 0]);
  assert.deepEqual([...ICO.subarray(22, 28)], [32, 32, 0, 0, 1, 0]);
  assert.deepEqual([...ICO.subarray(38, 44)], [48, 48, 0, 0, 1, 0]);
  const firstPng = ICO.readUInt32LE(6 + 12);
  assert.equal(ICO.subarray(firstPng, firstPng + 8).toString("latin1"), "\x89PNG\r\n\x1a\n");

  // L'ancien logo lime a disparu : plus de PNG d'icône dans `src/app`.
  assert.ok(existsSync(path.join(ROOT, "src/app/apple-icon.png")));
  assert.ok(!existsSync(path.join(ROOT, "src/app/icon.png")));
});
