/**
 * Étape 0 du chantier « rareté par popularité » : vérifie l'environnement.
 *
 * Réseau (Wikimedia REST + Wikidata API + SPARQL), base de données, droits
 * d'écriture (transaction annulée), schémas disponibles. Ne modifie rien de
 * durable. Sort en erreur au premier accès manquant.
 *
 *   node --env-file=.env --import tsx scripts/popularity/check-env.ts
 */

import { openRunner } from "../lib/db-runner";

const WIKI_CONTACT = process.env.WIKI_CONTACT ?? "https://tcvg.fun";
const LANGS = ["en", "fr", "ja", "es", "de", "pt"];

/**
 * Fenêtre de sondage : les douze derniers mois **complets**. Une fenêtre figée
 * dans le code renvoie tôt ou tard 404 (« pas de données pour ces dates ») et
 * ferait croire à une panne d'accès.
 */
function probeWindow(): { start: string; end: string } {
  const now = new Date();
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const first = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - 11, 1));
  const stamp = (date: Date) =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}01`;
  return { start: stamp(first), end: stamp(last) };
}

function agent(): string {
  return `TCVG-rarity-audit/1.0 (${WIKI_CONTACT})`;
}

type Check = { name: string; ok: boolean; detail: string };

async function probe(name: string, url: string, init?: RequestInit): Promise<Check> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": agent(), "Api-User-Agent": agent(), ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.text();
    return {
      name,
      ok: response.ok,
      detail: `${response.status} ${response.headers.get("content-type") ?? ""} — ${body.slice(0, 160).replace(/\s+/g, " ")}`,
    };
  } catch (error) {
    return { name, ok: false, detail: (error as Error).message };
  }
}

async function network(): Promise<Check[]> {
  const checks: Check[] = [];

  // 1. Pages vues (REST v1). Le sondage par article répond 404 quand l'article
  // n'existe pas dans cette langue (« Arthas Menethil » n'a pas d'article en
  // ja/es/de) : ce n'est pas une panne, c'est l'absence de donnée que le
  // pipeline traite déjà comme telle. La disponibilité se vérifie donc au
  // niveau du projet (agrégat), et le chemin par article une seule fois, en
  // anglais où l'article existe.
  const window = probeWindow();
  for (const lang of LANGS) {
    checks.push(
      await probe(
        `pageviews ${lang}.wikipedia`,
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/${lang}.wikipedia/all-access/user/monthly/${window.start}/${window.end}`,
      ),
    );
  }
  checks.push(
    await probe(
      "pageviews par article (en)",
      `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Arthas_Menethil/monthly/${window.start}/${window.end}`,
    ),
  );

  // 2. Wikidata : recherche d'entité.
  checks.push(
    await probe(
      "wikidata wbsearchentities",
      "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=Arthas%20Menethil&language=fr&uselang=fr&format=json&limit=5&origin=*",
      { headers: { Accept: "application/json" } },
    ),
  );

  // 3. Wikidata : entité complète (claims + sitelinks).
  checks.push(
    await probe(
      "wikidata wbgetentities",
      "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q1051078&props=claims|sitelinks|descriptions|labels&languages=en|fr&format=json&origin=*",
      { headers: { Accept: "application/json" } },
    ),
  );

  // 4. SPARQL (recherche par type + franchise).
  checks.push(
    await probe(
      "wikidata SPARQL",
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
        "SELECT ?item WHERE { ?item wdt:P31 wd:Q95074 . ?item rdfs:label \"Arthas Menethil\"@en } LIMIT 5",
      )}`,
      { headers: { Accept: "application/sparql-results+json" } },
    ),
  );

  // 5. API MediaWiki des wikis (recherche plein texte + redirections).
  for (const lang of ["en", "fr"]) {
    checks.push(
      await probe(
        `mediawiki search ${lang}.wikipedia`,
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=Arthas%20Menethil&format=json&srlimit=5&origin=*`,
        { headers: { Accept: "application/json" } },
      ),
    );
  }

  return checks;
}

async function database(): Promise<{ checks: Check[]; notes: string[] }> {
  const checks: Check[] = [];
  const notes: string[] = [];
  const runner = await openRunner();
  checks.push({ name: "connexion", ok: true, detail: runner.label });

  try {
    const version = await runner.query("select version() as v, current_database() as db, current_user as usr");
    checks.push({ name: "version", ok: true, detail: String(version[0]?.v).slice(0, 90) });

    const schemas = await runner.query(
      "select schema_name from information_schema.schemata order by schema_name",
    );
    notes.push(`schémas : ${schemas.map((row) => row.schema_name).join(", ")}`);

    const tables = await runner.query(`
      select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name
    `);
    notes.push(`tables public : ${tables.length}`);

    const cards = await runner.query("select count(*)::int as n from public.cards");
    const rarities = await runner.query(
      "select rarity, count(*)::int as n from public.cards where active group by rarity order by n desc",
    );
    notes.push(`cartes : ${cards[0]?.n}`);
    notes.push(
      `raretés actives : ${rarities.map((row) => `${row.rarity}=${row.n}`).join(" ")}`,
    );

    // Droits d'écriture : DDL dans un schéma temporaire + écriture réelle sur
    // une table `public` dans une transaction annulée.
    try {
      await runner.query("begin");
      await runner.query("create schema if not exists tvg_write_probe");
      await runner.query("create table tvg_write_probe.t (id int primary key, t text)");
      await runner.query("insert into tvg_write_probe.t values (1, 'ok')");
      await runner.query(
        "update public.cards set rarity = rarity where id = (select id from public.cards limit 1)",
      );
      await runner.query("rollback");
      await runner.query("drop schema if exists tvg_write_probe cascade");
      checks.push({ name: "écriture (DDL + public)", ok: true, detail: "transaction annulée, aucun changement" });
    } catch (error) {
      await runner.query("rollback").catch(() => {});
      checks.push({ name: "écriture (DDL + public)", ok: false, detail: (error as Error).message });
    }

    // Base ou environnement de test séparé ?
    const others = schemas
      .map((row) => String(row.schema_name))
      .filter((name) => !["public", "auth", "storage", "realtime", "vault", "extensions", "graphql", "graphql_public", "pgbouncer", "supabase_migrations", "information_schema", "pg_catalog", "pg_toast"].includes(name));
    notes.push(`schémas applicatifs autres que public : ${others.length ? others.join(", ") : "aucun"}`);
  } finally {
    await runner.close();
  }

  return { checks, notes };
}

async function main() {
  const results: Check[] = [...(await network())];
  let notes: string[] = [];
  try {
    const db = await database();
    results.push(...db.checks);
    notes = db.notes;
  } catch (error) {
    results.push({ name: "base de données", ok: false, detail: (error as Error).message });
  }

  console.log(`\nAgent HTTP : ${agent()}\n`);
  for (const result of results) {
    console.log(`${result.ok ? "✓" : "✗"} ${result.name} — ${result.detail}`);
  }
  if (notes.length) console.log(`\n${notes.map((note) => `• ${note}`).join("\n")}`);

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    console.error(`\n✗ ${failed.length} accès indisponible(s) : ${failed.map((f) => f.name).join(", ")}`);
    process.exit(1);
  }
  console.log("\n✓ environnement complet");
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
