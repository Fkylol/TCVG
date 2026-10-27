import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const EDITOR = readFileSync(path.join(ROOT, "src/components/profile-editor.tsx"), "utf8");

test("profil : les avatars tiennent sur deux rangées, le reste défile", () => {
  assert.match(EDITOR, /overflow-x-auto/);
  assert.match(EDITOR, /grid-rows-2/);
  assert.match(EDITOR, /grid-flow-col/);

  // Le cadre qui défile doit être positionné : les boutons radio `sr-only` sont
  // en position absolue, et sans ancêtre positionné ils se rattachent à la
  // fenêtre — la page entière gagnait alors une barre de défilement horizontale
  // large comme la collection du joueur.
  assert.match(EDITOR, /className="relative mt-4 overflow-x-auto pb-2"/);
});

test("profil : un champ de recherche filtre les avatars", () => {
  assert.match(EDITOR, /type="search"/);
  assert.match(EDITOR, /aria-label="Rechercher un avatar"/);
  // Nom et franchise, sans tenir compte des accents ni de la casse.
  assert.match(EDITOR, /normalize\(choice\.name\)\.includes\(needle\)/);
  assert.match(EDITOR, /normalize\(choice\.universe\)\.includes\(needle\)/);
  // Entrée ne doit pas envoyer le formulaire du profil.
  assert.match(EDITOR, /if \(event\.key === "Enter"\) event\.preventDefault\(\)/);
});

test("profil : l'avatar choisi survit à la recherche et n'est jamais effacé", () => {
  // Sélection contrôlée : le bouton radio garde son état même démonté.
  assert.match(EDITOR, /checked=\{selectedAvatar === choice\.id\}/);
  assert.match(EDITOR, /onChange=\{\(\) => setSelectedAvatar\(choice\.id\)\}/);
  // Le choix courant reste affiché quand la recherche l'écarte : sans son
  // bouton radio, le formulaire enverrait une valeur vide.
  assert.match(EDITOR, /choice\.id === selectedAvatar \|\| matches\.includes\(choice\)/);
});
