import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { atelierImageSrc } from "../src/lib/atelier-image";

const ROUTE = fs.readFileSync(path.join(process.cwd(), "src/app/atelier/image/route.ts"), "utf8");
const FORM = fs.readFileSync(
  path.join(process.cwd(), "src/app/atelier/cartes/atelier-form.tsx"),
  "utf8",
);

test("aperçu : un visuel distant passe par le relais de l'atelier", () => {
  const source = "https://static.wikia.nocookie.net/ori/images/a/a2/Ori10.png/revision/latest?cb=1";
  const relayed = atelierImageSrc(source);
  assert.match(relayed, /^\/atelier\/image\?u=/);
  assert.equal(new URL(`http://localhost${relayed}`).searchParams.get("u"), source);
});

test("aperçu : vide ou déjà local, aucune réécriture", () => {
  assert.equal(atelierImageSrc(""), "");
  assert.equal(atelierImageSrc("/cards/kratos.png"), "/cards/kratos.png");
  assert.equal(atelierImageSrc("data:image/png;base64,AAA"), "data:image/png;base64,AAA");
});

test("aperçu : vignettes et carte passent par le relais, la carte garde son format", () => {
  assert.match(FORM, /src=\{atelierImageSrc\(candidate\.url\)\}/);
  assert.match(FORM, /src: atelierImageSrc\(draft\.portrait\?\.url \?\? ""\)/);
  // Sans hauteur imposée, `.card-art` (`flex: 1`) tombe à 0 : l'image est
  // chargée mais invisible. Le format de carte vient du `className`.
  assert.match(FORM, /className="aspect-\[3\/4\] w-\[240px\]"/);
  // Les anciens portraits n'ont pas toujours leurs dimensions : la vignette ne
  // doit pas dépendre d'un `width` fourni par les données.
  assert.match(FORM, /<Image[\s\S]{0,200}?fill[\s\S]{0,200}?sizes="180px"/);
});

test("relais : réservé au développement et aux images publiques", () => {
  assert.match(ROUTE, /process\.env\.NODE_ENV === "production"/);
  assert.match(ROUTE, /isPrivateHost\(target\.hostname\)/);
  assert.match(ROUTE, /127/);
  assert.match(ROUTE, /169 && b === 254/);
  assert.match(ROUTE, /192 && b === 168/);
  assert.match(ROUTE, /fetched\.contentType/);
  assert.match(ROUTE, /maxBytes: MAX_BYTES/);
});
