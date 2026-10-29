import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const ORIGIN = read("src/lib/origin.ts");
const ACTIONS = read("src/app/actions.ts");
const REFERRAL = read("src/app/actions/referral.ts");
const CONFIRM = read("src/app/auth/confirm/route.ts");
const LOGIN = read("src/app/login/page.tsx");
const MIGRATION = read("supabase/migrations/051_bonus_bienvenue.sql");

test("connexion : l'origine OAuth est en HTTPS hors machine locale", () => {
  // Sans en-tête `x-forwarded-proto`, l'ancien code annonçait http://tcvg.fun :
  // une adresse hors liste blanche, et Discord ramenait sur localhost.
  assert.match(ORIGIN, /const local = .*localhost/);
  assert.match(ORIGIN, /headerList\.get\("x-forwarded-proto"\) \?\? \(local \? "http" : "https"\)/);
  assert.match(ACTIONS, /from "@\/lib\/origin"/);
  assert.match(REFERRAL, /from "@\/lib\/origin"/);
  assert.doesNotMatch(ACTIONS, /x-forwarded-proto/);
  assert.doesNotMatch(REFERRAL, /x-forwarded-proto/);
});

test("connexion : un retour Discord raté ne renvoie pas dans le vide", () => {
  // Le motif est journalisé, et une session déjà ouverte (autre onglet) suffit.
  assert.match(CONFIRM, /console\.error\("auth_confirm echange", error\.message\)/);
  assert.match(CONFIRM, /const \{ data: existing \} = await supabase\.auth\.getUser\(\)/);
  assert.match(CONFIRM, /if \(existing\.user\) return NextResponse\.redirect\(target\)/);
  assert.match(CONFIRM, /\/login\?erreur=confirmation/);

  // L'écran de connexion explique l'échec au lieu de rester muet.
  assert.match(LOGIN, /erreur === "confirmation"/);
  assert.match(LOGIN, /t\("La connexion n'a pas abouti/);
});

test("cadeau : 10 boosters pour les nouveaux comptes", () => {
  assert.match(MIGRATION, /insert into public\.profiles \(id, username, last_booster_at, booster_stock, bonus_boosters\)/);
  assert.match(MIGRATION, /now\(\)[\s\S]*?\b1,[\s\S]*?\b10\b/);
  assert.match(MIGRATION, /values \(v_created, 10, 'bienvenue'\)/);
});

test("cadeau : versé une seule fois à tous les joueurs existants", () => {
  assert.match(MIGRATION, /where reason = 'cadeau-10-boosters'/);
  assert.match(MIGRATION, /set bonus_boosters = bonus_boosters \+ 10/);
  assert.match(MIGRATION, /select id, 10, 'cadeau-10-boosters'/);
  // Le journal accepte un cadeau sans parrainage, et les deux motifs du cadeau.
  assert.match(MIGRATION, /alter column referral_id drop not null/);
  assert.match(MIGRATION, /'parrain', 'filleul', 'bienvenue', 'cadeau-10-boosters'/);
});
