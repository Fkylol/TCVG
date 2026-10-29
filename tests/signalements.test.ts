import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  REPORT_MAX,
  REPORT_TOPICS,
  isReportTopic,
  normalizeReport,
  reportTopicLabel,
} from "../src/lib/card-reports";
import { CARDS } from "../src/lib/cards";

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/050_signalements_cartes.sql"),
  "utf8",
);
const ACTION = fs.readFileSync(path.join(process.cwd(), "src/app/actions/reports.ts"), "utf8");
const BOUTON = fs.readFileSync(
  path.join(process.cwd(), "src/components/report-card-button.tsx"),
  "utf8",
);
const COLLECTION = fs.readFileSync(
  path.join(process.cwd(), "src/components/collection-browser.tsx"),
  "utf8",
);
const ATELIER = fs.readFileSync(
  path.join(process.cwd(), "src/app/atelier/signalements/page.tsx"),
  "utf8",
);
const ATELIER_ACTION = fs.readFileSync(
  path.join(process.cwd(), "src/app/atelier/signalements/actions.ts"),
  "utf8",
);
const LECTURE = fs.readFileSync(path.join(process.cwd(), "src/lib/atelier-reports.ts"), "utf8");
const CLOCHE = fs.readFileSync(path.join(process.cwd(), "src/app/atelier/bell.tsx"), "utf8");
const ATELIER_LAYOUT = fs.readFileSync(
  path.join(process.cwd(), "src/app/atelier/layout.tsx"),
  "utf8",
);
const ACCES = fs.readFileSync(path.join(process.cwd(), "src/lib/atelier-access.ts"), "utf8");
const ACCUEIL = fs.readFileSync(path.join(process.cwd(), "src/app/atelier/page.tsx"), "utf8");
const ENTETE = fs.readFileSync(path.join(process.cwd(), "src/components/site-header.tsx"), "utf8");

test("signalement : un message court et un motif valide passent", () => {
  const clean = normalizeReport({ topic: "visuel", message: "  L'image   est coupée en haut.  " });
  assert.deepEqual(clean, { ok: true, topic: "visuel", message: "L'image est coupée en haut." });
});

test("signalement : motif inconnu, message vide ou trop long refusés", () => {
  const motif = normalizeReport({ topic: "graphisme", message: "Le visuel est cassé." });
  assert.equal(motif.ok, false);
  assert.match(motif.ok ? "" : motif.error, /ce qui cloche/i);

  const court = normalizeReport({ topic: "fiche", message: "  ah  " });
  assert.equal(court.ok, false);
  assert.match(court.ok ? "" : court.error, /5 caractères minimum/);

  const long = normalizeReport({ topic: "autre", message: "x".repeat(REPORT_MAX + 1) });
  assert.equal(long.ok, false);
  assert.match(long.ok ? "" : long.error, /1000 caractères maximum/);
});

test("signalement : les quatre motifs sont connus et libellés", () => {
  assert.deepEqual(
    REPORT_TOPICS.map((topic) => topic.slug),
    ["visuel", "fiche", "rarete", "autre"],
  );
  for (const topic of REPORT_TOPICS) {
    assert.equal(reportTopicLabel(topic.slug), topic.label);
    assert.ok(isReportTopic(topic.slug));
  }
  assert.equal(isReportTopic("inconnu"), false);
  assert.equal(reportTopicLabel("inconnu"), "Autre");
});

test("signalement SQL : table, bornes et policies cohérentes", () => {
  assert.match(MIGRATION, /create table if not exists public\.card_reports/);
  assert.match(MIGRATION, /references public\.cards \(id\) on delete cascade/);
  assert.match(MIGRATION, /check \(topic in \('visuel', 'fiche', 'rarete', 'autre'\)\)/);
  assert.match(MIGRATION, /char_length\(message\) between 5 and 1000/);
  assert.match(MIGRATION, /check \(status in \('open', 'done'\)\)/);
  assert.match(MIGRATION, /alter table public\.card_reports enable row level security/);

  // Le joueur écrit, l'administration lit : aucune lecture ouverte aux joueurs.
  assert.match(MIGRATION, /create policy "card_reports: envoi d'un signalement"[\s\S]*?with check \(user_id = auth\.uid\(\)\)/);
  assert.match(MIGRATION, /create policy "card_reports: lecture admin"[\s\S]*?using \(public\.is_admin\(\)\)/);
  assert.match(MIGRATION, /revoke all on public\.card_reports from anon, authenticated/);
  assert.match(MIGRATION, /grant insert, select, update on public\.card_reports to authenticated/);
});

test("signalement : l'action relit la carte et vérifie la session", () => {
  assert.match(ACTION, /^"use server";/);
  assert.match(ACTION, /const session = await getSession\(\);/);
  assert.match(ACTION, /if \(!session\) return \{ status: "error"/);
  assert.match(ACTION, /if \(!card\) return \{ status: "error", message: "Carte inconnue\." \}/);
  assert.match(ACTION, /normalizeReport\(\{ topic, message \}\)/);
  assert.match(ACTION, /from\("card_reports"\)\.insert\(/);
  assert.match(ACTION, /user_id: session\.user\.id/);
});

test("signalement : la collection propose le bouton sur chaque carte", () => {
  assert.match(COLLECTION, /import \{ ReportCardButton \} from "@\/components\/report-card-button"/);
  assert.match(COLLECTION, /<ReportCardButton card=\{card\} \/>/);
  assert.match(BOUTON, /REPORT_TOPICS\.map/);
  assert.match(BOUTON, /reportCard\(card\.id, topic, message\)/);
  assert.match(BOUTON, /maxLength=\{REPORT_MAX\}/);
});

test("signalement : l'atelier lit la base avec la session admin et ouvre la carte", () => {
  assert.match(ATELIER, /const session = await atelierSession\(\);/);
  assert.match(ATELIER, /readCardReports\(session\?\.supabase\)/);
  assert.match(ATELIER, /\/atelier\/cartes\?edit=\$\{encodeURIComponent\(report\.card_id\)\}/);
  assert.match(ATELIER, /resolveCardReport/);
  // Le bouton reste visible en ligne comme en local : il ouvre la carte.
  assert.match(ATELIER, /Modifier la carte/);
  assert.doesNotMatch(ATELIER, /\{ATELIER_LOCAL && \(\s*<Link/);
  // La file renvoie vers l'accueil de l'atelier.
  assert.match(ATELIER, /← Atelier/);
  assert.match(ATELIER, /href="\/atelier"/);
});

test("atelier : l'accueil donne accès aux deux outils", () => {
  // Plus de saut automatique dans la file : on ouvre l'atelier.
  assert.doesNotMatch(ACCUEIL, /redirect\(/);
  assert.match(ACCUEIL, /href="\/atelier\/signalements"/);
  assert.match(ACCUEIL, /href="\/atelier\/cartes"/);
  assert.match(ACCUEIL, /readCardReports\(session\?\.supabase\)/);
  // L'éditeur s'ouvre aussi en ligne (il écrit alors en base).
  assert.match(ACCUEIL, /Ouvrir l&apos;éditeur/);
  assert.doesNotMatch(ACCUEIL, /Indisponible en ligne/);
});

test("atelier : accès fondé sur la permission en base, en ligne", () => {
  // La permission est vérifiée par la base, sans dépendre du pseudo.
  assert.match(ACCES, /export async function canUseAtelier\(/);
  assert.match(ACCES, /supabase\.rpc\("is_atelier"\)/);
  assert.doesNotMatch(ACCES, /select\("username"\)/);

  assert.match(ACCES, /if \(process\.env\.NODE_ENV !== "production"\) return null;/);
  assert.match(ACCES, /if \(!session\) redirect\("\/login"\)/);
  assert.match(ACCES, /if \(!\(await canUseAtelier\(session\.supabase\)\)\) notFound\(\)/);

  // Le layout applique la garde à toutes les pages de l'atelier.
  assert.match(ATELIER_LAYOUT, /const session = await atelierSession\(\);/);
  assert.match(ATELIER_LAYOUT, /countOpenReports\(session\?\.supabase\)/);
  assert.match(ATELIER_LAYOUT, /<AtelierBell count=\{reports\} \/>/);

  // L'onglet Atelier suit cette liste, pas le drapeau admin, et s'efface
  // pour un administrateur : l'atelier est dans son panneau.
  assert.match(ENTETE, /\{atelier && !admin && <NavLink href="\/atelier">Atelier<\/NavLink>\}/);
  assert.doesNotMatch(ENTETE, /\{admin && <NavLink href="\/atelier">/);
});

test("atelier : les deux comptes n'ont plus le rôle d'administration", () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/053_atelier_sans_admin.sql"),
    "utf8",
  );
  assert.match(migration, /set is_admin = false/);
  assert.match(migration, /lower\(username\) in \('deathsky74', 'asperge'\)/);
  // L'onglet Atelier utilise la même permission que la base.
  const game = fs.readFileSync(path.join(process.cwd(), "src/app/(game)/layout.tsx"), "utf8");
  assert.match(game, /canUseAtelier\(supabase\)/);
  assert.match(game, /atelier=\{atelier\}/);
});

test("signalement : lecture par session admin, ou par la connexion de maintenance en local", () => {
  // Voie locale : scripts de maintenance, sans compte à ouvrir.
  assert.match(LECTURE, /openRunner\(\)/);
  assert.match(LECTURE, /from public\.card_reports/);
  assert.match(LECTURE, /status = 'open'/);
  assert.match(LECTURE, /set status = '\$\{status\}', resolved_at = \$\{resolvedAt\}/);
  // Voie en ligne : la table n'est lue qu'avec les droits de l'administrateur.
  assert.match(LECTURE, /from\("card_reports"\)/);
  assert.match(LECTURE, /supabase\?: SupabaseClient \| null/);

  // L'action revérifie la garde : une action serveur s'appelle seule.
  assert.match(ATELIER_ACTION, /const session = await atelierSession\(\);/);
  assert.match(ATELIER_ACTION, /setCardReportStatus\(session\?\.supabase, id, done\)/);
  assert.match(ATELIER_ACTION, /revalidatePath\("\/atelier\/signalements"\)/);
});

test("signalement : la cloche compte les signalements en attente", () => {
  assert.match(CLOCHE, /href="\/atelier\/signalements"/);
  assert.match(CLOCHE, /count > 0/);
  assert.match(CLOCHE, /\{count > 99 \? "99\+" : count\}/);
  // Une seule cloche, dans le bandeau : elle suit sur toutes les pages.
  assert.match(ATELIER_LAYOUT, /<AtelierBell/);
  assert.doesNotMatch(ATELIER, /<AtelierBell/);
});

test("signalement : le catalogue fournit bien les cartes signalables", () => {
  assert.ok(CARDS.length > 0);
  assert.equal(new Set(CARDS.map((card) => card.id)).size, CARDS.length);
});
