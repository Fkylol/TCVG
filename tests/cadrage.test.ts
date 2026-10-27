import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_FRAMING,
  MAX_ZOOM,
  MIN_ZOOM,
  clampFraming,
  fitFraming,
  formatPosition,
  framingStyle,
  panFraming,
  parsePosition,
  zoomFraming,
} from "../src/lib/framing";
import { validateDraft, type CardDraft } from "../src/lib/atelier-core";
import { GENRES } from "../src/lib/card-genres";
import { CARDS, UNIVERSES } from "../src/lib/cards";
import { PORTRAIT_FRAMING, getPortraitFraming } from "../src/lib/portraits";

const FORM = fs.readFileSync(
  path.join(process.cwd(), "src/app/atelier/cartes/atelier-form.tsx"),
  "utf8",
);
const STORE = fs.readFileSync(path.join(process.cwd(), "src/lib/atelier-store.ts"), "utf8");

test("cadrage : position par défaut et bornes", () => {
  assert.deepEqual(parsePosition("50% 0%"), { x: 50, y: 0 });
  assert.deepEqual(parsePosition("150% -20%"), { x: 100, y: 0 });
  assert.deepEqual(parsePosition("illisible"), { x: 50, y: 0 });
  assert.equal(formatPosition(33.333, 66.666), "33.3% 66.7%");
  assert.equal(formatPosition(-5, 200), "0% 100%");
});

test("cadrage : le défaut reste exactement haut-centre", () => {
  assert.deepEqual(clampFraming(undefined), DEFAULT_FRAMING);
  assert.deepEqual(clampFraming({}), DEFAULT_FRAMING);
  assert.deepEqual(clampFraming({ objectFit: "contain" }), {
    objectFit: "contain",
    objectPosition: "50% 0%",
  });
  // Un zoom de 1 n'est pas écrit : le cadrage par défaut reste minimal.
  assert.equal(clampFraming({ zoom: 1 }).zoom, undefined);
});

test("cadrage : le zoom est borné et arrondi", () => {
  assert.equal(clampFraming({ zoom: 0.2 }).zoom, MIN_ZOOM > 1 ? MIN_ZOOM : undefined);
  assert.equal(clampFraming({ zoom: 99 }).zoom, MAX_ZOOM);
  assert.equal(clampFraming({ zoom: 1.234 }).zoom, 1.23);
  assert.equal(zoomFraming({ objectFit: "cover", objectPosition: "20% 30%" }, 2).zoom, 2);
});

test("cadrage : glisser à droite découvre la gauche", () => {
  const start = clampFraming({ objectPosition: "50% 50%" });
  const moved = panFraming(start, 0.1, 0);
  assert.deepEqual(parsePosition(moved.objectPosition), { x: 40, y: 50 });

  // Le geste est divisé par le zoom : à ×2, la même course déplace moitié moins.
  const zoomed = panFraming({ objectPosition: "50% 50%", zoom: 2 }, 0.1, 0);
  assert.deepEqual(parsePosition(zoomed.objectPosition), { x: 45, y: 50 });

  // Borné : on ne sort jamais du cadre.
  const far = panFraming(start, 5, 5);
  assert.deepEqual(parsePosition(far.objectPosition), { x: 0, y: 0 });
});

test("cadrage : ajustement et style CSS", () => {
  const contain = fitFraming({ objectFit: "cover", objectPosition: "50% 0%" });
  assert.equal(contain.objectFit, "contain");
  assert.equal(fitFraming(contain).objectFit, "cover");

  assert.deepEqual(framingStyle(undefined), {
    objectFit: "cover",
    objectPosition: "50% 0%",
  });

  const zoomed = framingStyle({ objectFit: "cover", objectPosition: "30% 20%", zoom: 1.8 });
  assert.equal(zoomed.transform, "scale(1.8)");
  assert.equal(zoomed.transformOrigin, "30% 20%");
  assert.equal(framingStyle({ objectFit: "cover", objectPosition: "30% 20%" }).transform, undefined);
});

test("cadrage : le portrait enregistré passe avant le réglage écrit à la main", () => {
  // Sans cadrage dans les données, on retombe sur `PORTRAIT_FRAMING` puis le défaut.
  assert.deepEqual(getPortraitFraming("ciri"), PORTRAIT_FRAMING.ciri);
  assert.deepEqual(getPortraitFraming("inconnue"), DEFAULT_FRAMING);
});

test("cadrage : la fiche refuse un cadrage inexploitable", () => {
  const context = { universes: Object.keys(UNIVERSES), cards: CARDS, genres: GENRES.map((g) => g.slug) };
  const base: CardDraft = {
    id: "carte-cadrage-test",
    name: "Personnage Test",
    universe: "ori",
    emoji: "🖼️",
    rarity: "C",
    genres: ["action-aventure"],
    lore: { tagline: "Test", bio: "Carte de test pour le cadrage." },
    portrait: { url: "https://exemple.test/visuel.png", source: "custom", width: 800, height: 900 },
  };

  assert.deepEqual(validateDraft(base, context), { ok: true });
  assert.deepEqual(
    validateDraft(
      { ...base, portrait: { ...base.portrait!, framing: { objectFit: "cover", objectPosition: "12.5% 40%", zoom: 2 } } },
      context,
    ),
    { ok: true },
  );

  const bad = validateDraft(
    {
      ...base,
      portrait: {
        ...base.portrait!,
        framing: { objectFit: "stretch" as "cover", objectPosition: "dedans", zoom: 9 },
      },
    },
    context,
  );
  assert.equal(bad.ok, false);
  const errors = bad.ok ? [] : bad.errors;
  assert.ok(errors.some((error) => /ajustement inconnu/.test(error)));
  assert.ok(errors.some((error) => /position illisible/.test(error)));
  assert.ok(errors.some((error) => /zoom hors bornes/.test(error)));
});

test("cadrage : l'atelier le règle à la souris et l'enregistre", () => {
  // Glisser sur l'aperçu + curseur de zoom.
  assert.match(FORM, /onPointerDown=\{startPan\}/);
  assert.match(FORM, /onPointerMove=\{movePan\}/);
  assert.match(FORM, /panFraming\(framing, dx, dy\)/);
  assert.match(FORM, /type="range"/);
  assert.match(FORM, /updateFraming\(zoomFraming\(framing, Number\(event\.target\.value\)\)\)/);
  assert.match(FORM, /framing: clampFraming\(draft\.portrait\?\.framing\)/);

  // Le cadrage suit la carte jusqu'au fichier de données.
  assert.match(STORE, /\(draft\.portrait\.framing \? \{ framing: draft\.portrait\.framing \} : \{\}\)/);
});
