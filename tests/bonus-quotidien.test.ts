import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DailyBonusNote } from "../src/components/daily-bonus-note";

/**
 * Le bonus de 24 h est réclamé à chaque arrivée sur le site : `claimDailyBonus()`
 * ne crédite que si le délai est écoulé. La barre ne doit donc apparaître que
 * sur le rendu qui a réellement crédité — un affichage systématique annoncerait
 * +10 Pixels à chaque page sans rien verser.
 */

function render(bonus: Parameters<typeof DailyBonusNote>[0]["bonus"]): string {
  return renderToStaticMarkup(createElement(DailyBonusNote, { bonus }));
}

test("bonus crédité : la barre annonce le montant versé", () => {
  const html = render({ claimed: true, amount: 10, nextAt: null });

  assert.match(html, /role="status"/);
  assert.match(html, /Bonus quotidien/);
  assert.match(html, /\+10/);
});

test("montant lu depuis la base, jamais codé en dur", () => {
  const html = render({ claimed: true, amount: 25, nextAt: null });

  assert.match(html, /\+25/);
  assert.doesNotMatch(html, /\+10/);
});

test("délai non écoulé : rien n'est affiché", () => {
  assert.equal(render({ claimed: false, amount: 0, nextAt: null }), "");
});

test("réponse vide ou montant nul : aucune barre", () => {
  assert.equal(render(null), "");
  assert.equal(render({ claimed: true, amount: 0, nextAt: null }), "");
});

test("les deux gabarits montent la barre au-dessus du contenu", () => {
  // Sans ce branchement, le bonus resterait invisible : le solde bougerait
  // sans explication, ce qui est exactement le défaut corrigé.
  for (const layout of ["src/app/(game)/layout.tsx", "src/app/(pages)/layout.tsx"]) {
    const source = readLayout(layout);
    assert.match(source, /<DailyBonusNote bonus=\{bonus\} \/>/, `${layout} n'affiche pas la barre`);
    assert.ok(
      source.indexOf("<DailyBonusNote") < source.indexOf("{children}"),
      `${layout} doit afficher la barre avant le contenu`,
    );
  }
});

function readLayout(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}
