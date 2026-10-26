import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { parseCardProfile } from "../src/lib/card-profile";
import { WISHLIST_LIMIT } from "../src/lib/game";

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/019_fiche_editoriale_et_envies.sql"),
  "utf8",
);

test("fiche verrouillée : aucun champ n'est lu, même si le serveur en envoie", () => {
  // La fonction SQL ne doit renvoyer que `unlocked: false` ; le code refuse
  // en plus tout contenu dans ce cas, pour qu'un bug serveur ne devienne pas
  // une fuite côté interface.
  assert.equal(parseCardProfile({ unlocked: false, bio: "Kratos est un dieu." }), null);
  assert.equal(parseCardProfile({}), null);
  assert.equal(parseCardProfile(null), null);
  assert.equal(parseCardProfile("texte"), null);
});

test("fiche déverrouillée : champs optionnels et source conservés", () => {
  const profile = parseCardProfile({
    unlocked: true,
    overview: "Un guerrier spartiate.",
    bio: "Un guerrier spartiate.",
    appearances: [
      { media: "Jeu", title: "God of War" },
      { media: "Jeu", title: "God of War II" },
      { media: "Manga" },
      42,
    ],
    studio: "Santa Monica Studio",
    voice: "Christopher Judge",
    trivia: "Sa hache s'appelle Léviathan.",
    source_name: "TCVG",
    source_url: "https://tcvg.fun",
  });

  assert.ok(profile);
  assert.equal(profile.overview, "Un guerrier spartiate.");
  assert.equal(profile.bio, "Un guerrier spartiate.");
  // Une apparition sans titre est ignorée, le média manquant devient « — ».
  assert.deepEqual(profile.appearances, [
    { media: "Jeu", title: "God of War" },
    { media: "Jeu", title: "God of War II" },
  ]);
  assert.equal(profile.studio, "Santa Monica Studio");
  assert.equal(profile.sourceName, "TCVG");
  assert.equal(profile.sourceUrl, "https://tcvg.fun");
});

test("fiche déverrouillée sans contenu : tout reste vide, jamais inventé", () => {
  const profile = parseCardProfile({ unlocked: true });

  assert.ok(profile);
  assert.equal(profile.overview, null);
  assert.equal(profile.bio, null);
  assert.deepEqual(profile.appearances, []);
  assert.equal(profile.trivia, null);
  assert.equal(profile.sourceName, null);
});

test("migration 019 : la fiche est lue par une fonction vérifiant la possession", () => {
  // Garde-fou : si quelqu'un retire le contrôle de possession ou la révocation
  // des accès directs, ce test casse avant la mise en ligne.
  assert.match(MIGRATION, /create or replace function public\.card_profile\(/);
  assert.match(MIGRATION, /from public\.collection c/);
  assert.match(MIGRATION, /jsonb_build_object\('unlocked', false\)/);
  assert.match(MIGRATION, /revoke all on public\.card_profiles from anon, authenticated/);
  assert.match(MIGRATION, /revoke all on function public\.card_profile\(text\) from anon/);
});

test("liste d'envies : plafond de 200 identique dans le code et dans la base", () => {
  assert.equal(WISHLIST_LIMIT, 200);
  assert.match(MIGRATION, /v_max integer := 200/);
  assert.match(MIGRATION, /raise exception 'wishlist_full'/);
});
