import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Administration du marché (migration 026). Le rapport est gardé par la
 * fonction elle-même : même si le client appelait l'API directement, le
 * drapeau est vérifié côté base.
 */
const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/026_admin_marche.sql"),
  "utf8",
);

function block(name: string): string {
  const start = MIGRATION.indexOf(`function public.${name}`);
  assert.ok(start > -1, `fonction ${name} absente de la migration`);
  return MIGRATION.slice(start, MIGRATION.indexOf("$$;", start));
}

test("administrateur : drapeau sur le profil, fermé par défaut", () => {
  assert.match(MIGRATION, /add column if not exists is_admin boolean not null default false/);
  assert.match(MIGRATION, /if not has_column_privilege\('authenticated', 'public\.profiles', 'is_admin', 'update'\)/);
});

test("is_admin : lecture du drapeau du joueur connecté", () => {
  const fn = block("is_admin");
  assert.match(fn, /from public\.profiles p where p\.id = auth\.uid\(\)/);
  assert.match(fn, /coalesce\(/);
  assert.match(MIGRATION, /grant execute on function public\.is_admin\(\) to authenticated/);
});

test("rapport : refusé aux joueurs et aux visiteurs", () => {
  const report = block("admin_market_report");
  assert.match(report, /raise exception 'not_authenticated'/);
  assert.match(report, /raise exception 'not_admin' using errcode = '42501'/);
  // Le contrôle passe avant toute agrégation.
  assert.ok(
    report.indexOf("not_admin") < report.indexOf("'top_sellers'"),
    "le contrôle d'accès doit précéder la première donnée",
  );
  assert.match(MIGRATION, /revoke all on function public\.admin_market_report\(integer\) from anon/);
});

test("rapport : fenêtre bornée à 90 jours", () => {
  const report = block("admin_market_report");
  assert.match(report, /least\(greatest\(coalesce\(p_days, 7\), 1\), 90\)/);
});

test("rapport : signaux attendus (volumes, paires croisées, rafales)", () => {
  const report = block("admin_market_report");
  for (const key of ["'trades'", "'volume'", "'fees'", "'top_sellers'", "'pairs'", "'bursts'", "'audit'"]) {
    assert.ok(report.includes(key), `clé ${key} absente du rapport`);
  }
  assert.match(report, /count\(\*\) filter \(where t\.buyer_id = least/);
  assert.match(report, /count\(\*\) filter \(where t\.seller_id = least/);
  assert.match(report, /having count\(\*\) >= 20/);
  assert.match(report, /limit 50/);
});

test("administration : rollback documenté", () => {
  assert.match(MIGRATION, /ROLLBACK/);
  assert.match(MIGRATION, /drop column if exists is_admin/);
});
