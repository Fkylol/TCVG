import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { MOTION_BOOT_SCRIPT, MOTION_DEFAULT, MOTION_KEY, readMotionPreference } from "../src/lib/motion";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const CSS = read("src/app/globals.css");
const LAYOUT = read("src/app/layout.tsx");
const REVEAL = read("src/components/booster-reveal.tsx");
const AVATAR = read("src/components/avatar-frame.tsx");
const PROFIL = read("src/app/(game)/profil/page.tsx");
const TOGGLE = read("src/components/motion-toggle.tsx");

test("animations : le mode par défaut n'est pas celui de l'économie d'énergie", () => {
  assert.equal(MOTION_DEFAULT, "full");
  // Sans navigateur (rendu serveur), on annonce le mode complet.
  assert.equal(readMotionPreference(), "full");
  assert.match(MOTION_BOOT_SCRIPT, new RegExp(`localStorage.getItem\\("${MOTION_KEY}"\\)`));
  assert.match(MOTION_BOOT_SCRIPT, /dataset\.motion=m==="auto"\?"auto":"full"/);
});

/** Contenu des blocs `@media (prefers-reduced-motion: reduce)`, accolades comprises. */
function reducedBlocks(css: string): string[] {
  const marker = "@media (prefers-reduced-motion: reduce)";
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(marker, from);
    if (start === -1) return blocks;
    let depth = 0;
    let i = css.indexOf("{", start);
    const open = i;
    while (i < css.length) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
      i += 1;
    }
    blocks.push(css.slice(open + 1, i));
    from = i + 1;
  }
}

test("animations : le CSS ne réduit que si le joueur suit le système", () => {
  const blocks = reducedBlocks(CSS);
  assert.ok(blocks.length >= 4, `blocs trouvés : ${blocks.length}`);

  // Chaque sélecteur des blocs porte la garde : sans elle, l'économie
  // d'énergie du téléphone coupait toutes les animations.
  for (const block of blocks) {
    for (const line of block.split("\n")) {
      const selector = line.trim();
      if (!selector.startsWith(".") && !selector.startsWith("button:")) continue;
      assert.match(line, /html:not\(\[data-motion="full"\]\)/, selector);
    }
  }

  // L'ouverture de booster fait partie des animations protégées.
  assert.match(CSS, /html:not\(\[data-motion="full"\]\) \.pack-stage\[data-tearing="true"\]/);
  assert.match(CSS, /html:not\(\[data-motion="full"\]\) \.rip-card/);
});

test("animations : la page déclare le mode avant les animations", () => {
  assert.match(LAYOUT, /data-motion=\{MOTION_DEFAULT\}/);
  assert.match(LAYOUT, /strategy="beforeInteractive"/);
  assert.match(LAYOUT, /MOTION_BOOT_SCRIPT/);
});

test("animations : l'ouverture et les cadres ignorent la réduction forcée", () => {
  assert.match(REVEAL, /!isMotionForced\(\) && window\.matchMedia\(REDUCED_MOTION\)\.matches/);
  assert.match(AVATAR, /setSystemReduced\(!isMotionForced\(\) && media\.matches\)/);
  // Un changement de réglage s'applique sans recharger la page.
  assert.match(REVEAL, /addEventListener\(MOTION_EVENT/);
  assert.match(AVATAR, /addEventListener\(MOTION_EVENT/);
});

test("animations : le profil propose le choix « toujours / suivre le système »", () => {
  assert.match(PROFIL, /<MotionToggle \/>/);
  assert.match(TOGGLE, /setMotionPreference\(choice\.value\)/);
  assert.match(TOGGLE, /value: "full"/);
  assert.match(TOGGLE, /value: "auto"/);
});
