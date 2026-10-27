import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { STANDARD_BACK, backColorsFor } from "../src/lib/card-back";
import { PACKS } from "../src/lib/packs";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const CONFIG = read("src/lib/card-back.ts");
const COMPONENT = read("src/components/card-back.tsx");
const CSS = read("src/app/globals.css");
const REVEAL = read("src/components/booster-reveal.tsx");
const LAB = read("src/app/dev/dos-de-carte/page.tsx");

test("dos de carte : chaque pack a le sien, le standard sert de repli", () => {
  const seen = new Set<string>();

  for (const pack of PACKS) {
    const colors = backColorsFor(pack);
    // Le dos reprend les couleurs du poster : rien à tenir à jour deux fois.
    assert.equal(colors.t1, pack.colors.t1, `t1 : ${pack.id}`);
    assert.equal(colors.t2, pack.colors.t2, `t2 : ${pack.id}`);
    assert.equal(colors.ink, pack.colors.ink, `encre : ${pack.id}`);
    assert.equal(colors.gl, pack.colors.gl, `emblème : ${pack.id}`);
    assert.equal(colors.tx, pack.colors.tx, `treillis : ${pack.id}`);
    assert.match(colors.ln, /^rgba\(255, 255, 255, 0\.\d+\)$/, `cadre : ${pack.id}`);

    // Deux packs ne peuvent pas partager le même fond.
    const fond = `${colors.t1}/${colors.t2}`;
    assert.equal(seen.has(fond), false, `fond en double : ${pack.id}`);
    seen.add(fond);
  }

  assert.deepEqual(backColorsFor(null), STANDARD_BACK);
  assert.deepEqual(backColorsFor(undefined), STANDARD_BACK);
  assert.match(CONFIG, /export const STANDARD_BACK: CardBackColors = \{/);
  assert.match(CONFIG, /t1: "#6a56d6"/);
  // L'emblème du dos standard suit l'accent du site : le cyan, plus de lime.
  assert.match(CONFIG, /gl: "#36e2ff"/);
  assert.equal(new Set(Object.values(STANDARD_BACK)).size, 6);
});

test("dos de carte : dessiné en DOM, sans image raster", () => {
  assert.doesNotMatch(COMPONENT, /next\/image/);
  assert.doesNotMatch(COMPONENT, /\.(?:jpg|jpeg|png|webp|avif)/);
  assert.doesNotMatch(COMPONENT, /<image\b/);

  // Le dessin : cadre double, treillis de losanges, quatre anneaux, croix et
  // pastilles des coins.
  assert.match(COMPONENT, /viewBox="0 0 300 400"/);
  assert.match(COMPONENT, /preserveAspectRatio="xMidYMid slice"/);
  assert.match(COMPONENT, /const RINGS = \[69, 93, 120, 150\]/);
  assert.match(COMPONENT, /const TICKS: \[number, number\]\[\]/);
  assert.match(COMPONENT, /const DOTS: \[number, number\]\[\]/);
  assert.match(COMPONENT, /<pattern id=\{lattice\} width="30" height="30"/);
  assert.match(COMPONENT, /M0 15L15 0L30 15L15 30Z/);
  // Le motif doit être unique sur la page : la carte du dessus et les vignettes
  // du pied de révélation cohabitent.
  assert.match(COMPONENT, /card-back-lattice-\$\{useId\(\)\.replace\(/);

  // Le médaillon : verre, disque sombre, emblème et wordmark.
  assert.match(COMPONENT, /card-back-med/);
  assert.match(COMPONENT, /card-back-disc/);
  assert.match(COMPONENT, /transform="rotate\(45 24 24\)"/);
  assert.match(COMPONENT, /<span className="card-back-word">TCVG<\/span>/);
  assert.match(COMPONENT, /className="card-back-sheen"/);
});

test("dos de carte : tout suit la largeur du dos", () => {
  assert.match(CSS, /\.card-back \{[\s\S]*?container: card-back \/ inline-size/);
  assert.match(CSS, /\.card-back \{[\s\S]*?linear-gradient\(162deg, var\(--cb-t1\), var\(--cb-t2\)\)/);
  assert.match(CSS, /\.card-back-med \{[\s\S]*?width: 44cqw/);
  assert.match(CSS, /\.card-back-disc svg \{[\s\S]*?width: 56%/);
  assert.match(CSS, /\.card-back-word \{[\s\S]*?font-size: 6\.4cqw/);
  assert.match(CSS, /\.card-back-word \{[\s\S]*?letter-spacing: 0\.42em/);
  // Le film du booster : un dégradé répété, pas un reflet qui suit le pointeur.
  assert.match(CSS, /\.card-back-sheen \{[\s\S]*?repeating-linear-gradient\(/);
  assert.match(CSS, /\.card-back-sheen \{[\s\S]*?mix-blend-mode: overlay/);
  // Aucune transition ni animation dans le dos : rien à couper en mouvement
  // réduit, la lueur de rareté porte déjà l'effet.
  assert.doesNotMatch(CSS, /\.card-back \{[^}]*transition/);
  assert.doesNotMatch(CSS, /\.card-back \{[^}]*animation/);
});

test("dos de carte : la vignette efface le wordmark et grossit le médaillon", () => {
  assert.match(CSS, /@container card-back \(max-width: 96px\)/);
  assert.match(CSS, /@container card-back \(max-width: 96px\) \{[\s\S]*?\.card-back-word \{[\s\S]*?display: none/);
  assert.match(CSS, /@container card-back \(max-width: 96px\) \{[\s\S]*?width: 62cqw/);
});

test("ouverture : le dos remplace la photo dans les deux emplacements", () => {
  assert.match(REVEAL, /import \{ CardBack \} from "@\/components\/card-back"/);
  assert.equal((REVEAL.match(/<CardBack pack=\{pack\} \/>/g) ?? []).length, 2);
  assert.doesNotMatch(REVEAL, /dos-carte\.jpg/);

  // La lueur de rareté reste sur la face, autour du dos.
  assert.match(CSS, /\.rip-face-back \{[\s\S]*?var\(--glow, rgba\(255, 255, 255, 0\.3\)\)/);
});

test("planche de contrôle : un dos par pack, réservée à l'administration", () => {
  assert.match(LAB, /PACKS\.map/);
  assert.match(LAB, /robots: \{ index: false, follow: false \}/);
  assert.match(LAB, /process\.env\.NODE_ENV === "production"/);
  assert.match(LAB, /await supabase\.rpc\("is_admin"\)/);
  assert.match(LAB, /if \(admin !== true\) notFound\(\)/);
});
