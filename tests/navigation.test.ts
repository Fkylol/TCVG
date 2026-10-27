import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const HEADER = read("src/components/site-header.tsx");
const ACCUEIL = read("src/app/page.tsx");
const PROFIL = read("src/app/(game)/profil/page.tsx");
const MARCHE = read("src/app/(game)/marche/page.tsx");

test("navigation : quatre onglets, dans cet ordre", () => {
  const tabs = [...HEADER.matchAll(/<NavLink href="([^"]+)">([^<]+)<\/NavLink>/g)].map(
    (match) => match[2],
  );
  assert.deepEqual(tabs.slice(0, 4), ["Boosters", "Collection", "Marché", "Classement"]);
});

test("navigation : la barre passe à la ligne au lieu de défiler", () => {
  // Avec les onglets d'administration, `overflow-x-auto` coupait « Atelier » et
  // affichait une barre de défilement horizontale dans l'en-tête.
  const nav = HEADER.match(/<nav className="([^"]+)"/)?.[1] ?? "";
  assert.match(nav, /flex-wrap/);
  assert.doesNotMatch(nav, /overflow-x-auto/);
});

test("navigation : l'accueil garde les onglets d'administration", () => {
  // La barre ne change pas d'onglets d'une page à l'autre : l'accueil oubliait
  // `admin` et `atelier`, donc un administrateur ne voyait plus « Admin » en
  // revenant sur la landing.
  assert.match(ACCUEIL, /rpc\("is_admin"\)/);
  assert.match(ACCUEIL, /admin=\{admin\}/);
  assert.match(ACCUEIL, /atelier=\{canUseAtelier\(profile\?\.username\)\}/);
});

test("navigation : l'Agora vit dans le marché, plus dans l'en-tête", () => {
  assert.doesNotMatch(HEADER, /<NavLink href="\/agora"/);
  // Le marché affiche l'Agora en dessous des annonces.
  assert.match(MARCHE, /import \{ AgoraLoader \}/);
  assert.match(MARCHE, /<AgoraLoader \/>/);
});

test("navigation : un seul onglet Admin, qui ouvre le panneau", () => {
  assert.match(HEADER, /\{admin && <NavLink href="\/admin">Admin<\/NavLink>\}/);
  // Les outils ne sont plus des onglets séparés.
  assert.doesNotMatch(HEADER, /NavLink href="\/admin\/marche"/);
  assert.doesNotMatch(HEADER, /NavLink href="\/admin\/parrainage"/);
  assert.doesNotMatch(HEADER, /NavLink href="\/admin\/cadres"/);

  const PANEL = read("src/app/(game)/admin/page.tsx");
  // Garde admin, comme les pages qu'il ouvre.
  assert.match(PANEL, /rpc\("is_admin"\)/);
  assert.match(PANEL, /if \(isAdmin !== true\) notFound\(\);/);
  // Les quatre outils sont dans le panneau.
  for (const href of ["/admin/marche", "/admin/parrainage", "/admin/cadres", "/atelier"]) {
    assert.match(PANEL, new RegExp(`href="${href}"`), `entrée ${href}`);
  }
});

test("navigation : envies et parrainage passent par le profil", () => {
  assert.doesNotMatch(HEADER, /<NavLink href="\/envies"/);
  assert.doesNotMatch(HEADER, /<NavLink href="\/parrainage"/);
  assert.match(PROFIL, /href="\/envies"/);
  assert.match(PROFIL, /href="\/parrainage"/);
});
