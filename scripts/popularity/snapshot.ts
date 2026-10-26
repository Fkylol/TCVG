/**
 * Instantané complet de la base, avec restauration testée.
 *
 * Il n'existe qu'une seule base (production). Avant toute écriture du chantier
 * « rareté par popularité », on exporte toutes les tables `public` en JSON,
 * puis on rejoue l'export dans un schéma séparé (`snapshot_test`) pour prouver
 * qu'il est complet et restaurable. Le schéma de test est supprimé ensuite :
 * rien ne reste en base après un instantané réussi.
 *
 * Usage :
 *   node --env-file=.env --import tsx scripts/popularity/snapshot.ts
 *   node --env-file=.env --import tsx scripts/popularity/snapshot.ts --verify <dossier>
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { openRunner, type Runner } from "../lib/db-runner";

const SNAPSHOT_ROOT = path.join(process.cwd(), ".snapshots");
const TEST_SCHEMA = "snapshot_test";

type Manifest = {
  createdAt: string;
  /** Renseigné une fois la restauration testée : l'instantané est utilisable. */
  verifiedAt?: string;
  tables: { table: string; rows: number; sha256: string }[];
};

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function dollarQuote(payload: string): string {
  let tag = `snap${hash(payload).slice(0, 8)}`;
  while (payload.includes(`$${tag}$`)) tag = `${tag}x`;
  return `$${tag}$${payload}$${tag}$`;
}

async function listTables(runner: Runner): Promise<string[]> {
  const rows = await runner.query(`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name
  `);
  return rows.map((row) => String(row.table_name));
}

/** Empreinte indépendante de l'ordre des lignes. */
async function fingerprint(runner: Runner, qualified: string): Promise<{ rows: number; md5: string }> {
  const rows = await runner.query(`
    select count(*)::int as rows,
           coalesce(md5(string_agg(h, '' order by h)), '') as md5
      from (select md5(to_jsonb(t)::text) as h from ${qualified} t) s
  `);
  return { rows: Number(rows[0]?.rows ?? 0), md5: String(rows[0]?.md5 ?? "") };
}

async function dump(runner: Runner): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(SNAPSHOT_ROOT, stamp);
  await fs.mkdir(dir, { recursive: true });

  const manifest: Manifest = { createdAt: new Date().toISOString(), tables: [] };
  const tables = await listTables(runner);

  for (const table of tables) {
    const rows = await runner.query(`select coalesce(jsonb_agg(t), '[]'::jsonb) as rows from public.${table} t`);
    const payload = JSON.stringify(rows[0]?.rows ?? []);
    await fs.writeFile(path.join(dir, `${table}.json`), payload, "utf8");
    manifest.tables.push({
      table,
      rows: (JSON.parse(payload) as unknown[]).length,
      sha256: hash(payload),
    });
    process.stdout.write(`  ${table} : ${manifest.tables.length}/${tables.length}\r`);
  }

  await fs.writeFile(path.join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\n→ instantané : ${path.relative(process.cwd(), dir)} (${tables.length} tables)`);
  return dir;
}

async function verify(runner: Runner, dir: string): Promise<void> {
  const raw = await fs.readFile(path.join(dir, "manifest.json"), "utf8");
  const manifest = JSON.parse(raw) as Manifest;

  console.log(`→ vérification de ${manifest.tables.length} tables dans le schéma ${TEST_SCHEMA}`);
  await runner.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
  await runner.query(`create schema ${TEST_SCHEMA}`);

  let mismatches = 0;
  try {
    for (const entry of manifest.tables) {
      const payload = await fs.readFile(path.join(dir, `${entry.table}.json`), "utf8");
      if (hash(payload) !== entry.sha256) {
        console.log(`  ✗ ${entry.table} : empreinte du fichier différente`);
        mismatches += 1;
        continue;
      }

      await runner.query(`create table ${TEST_SCHEMA}.${entry.table} (like public.${entry.table})`);
      await runner.query(`
        insert into ${TEST_SCHEMA}.${entry.table}
        select * from jsonb_populate_recordset(null::${TEST_SCHEMA}.${entry.table}, ${dollarQuote(payload)}::jsonb)
      `);

      const source = await fingerprint(runner, `public.${entry.table}`);
      const restored = await fingerprint(runner, `${TEST_SCHEMA}.${entry.table}`);
      const ok = source.rows === restored.rows && source.md5 === restored.md5;
      if (!ok) {
        mismatches += 1;
        console.log(`  ✗ ${entry.table} : ${source.rows}/${source.md5} ≠ ${restored.rows}/${restored.md5}`);
      } else {
        console.log(`  ✓ ${entry.table} (${source.rows} lignes)`);
      }
    }
  } finally {
    await runner.query(`drop schema if exists ${TEST_SCHEMA} cascade`);
    const left = await runner.query(
      `select count(*)::int as total from information_schema.schemata where schema_name = '${TEST_SCHEMA}'`,
    );
    console.log(`  schéma de test supprimé : ${left[0]?.total === 0 ? "oui" : "NON"}`);
  }

  if (mismatches > 0) {
    throw new Error(`${mismatches} table(s) ne se restaurent pas à l'identique`);
  }
  console.log("✓ restauration vérifiée : toutes les tables sont identiques à l'original.");
}

async function main() {
  const [, , flag, arg] = process.argv;
  const runner = await openRunner();
  try {
    if (flag === "--verify") {
      if (!arg) throw new Error("indique le dossier de l'instantané à vérifier");
      await verify(runner, path.resolve(process.cwd(), arg));
      return;
    }

    const dir = await dump(runner);
    await verify(runner, dir);

    const manifestPath = path.join(dir, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;
    manifest.verifiedAt = new Date().toISOString();
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const total = manifest.tables.reduce((sum, entry) => sum + entry.rows, 0);
    console.log(`✓ instantané vérifié : ${manifest.tables.length} tables, ${total} lignes, ${dir}`);
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
