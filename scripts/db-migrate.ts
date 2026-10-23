/**
 * Applique supabase/schema.sql (ou un fichier passé en argument).
 *
 * Usage : npm run db:migrate [fichier.sql]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { openRunner } from "./lib/db-runner";

const FILE = process.argv[2] ?? "supabase/schema.sql";

async function main() {
  const sql = await fs.readFile(path.join(process.cwd(), FILE), "utf8");
  console.log(`→ fichier : ${FILE}`);

  const runner = await openRunner();
  console.log(`→ connecté via ${runner.label}`);

  try {
    console.log("→ application du SQL…");
    await runner.query(sql);
    console.log("✓ schéma appliqué");

    const columns = await runner.query(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles'
        order by ordinal_position`,
    );
    console.log(`  profiles : ${columns.map((row) => row.column_name).join(", ")}`);

    const functions = await runner.query(
      `select proname from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and proname in ('open_boosters', 'open_booster', 'set_profile_style')
        order by proname`,
    );
    const names = functions.map((row) => String(row.proname));
    console.log(`  fonctions : ${names.join(", ") || "(aucune)"}`);
    if (!names.includes("open_boosters")) throw new Error("open_boosters() absente après migration");
    if (!names.includes("set_profile_style")) throw new Error("set_profile_style() absente après migration");
    if (names.includes("open_booster")) console.warn("  ⚠ l'ancienne fonction open_booster() existe encore");

    const tables = await runner.query(
      `select table_name from information_schema.tables
        where table_schema = 'public' order by table_name`,
    );
    console.log(`  tables : ${tables.map((row) => row.table_name).join(", ")}`);

    const policies = await runner.query(
      `select count(*)::int as total from pg_policies where schemaname = 'public'`,
    );
    console.log(`  policies : ${policies[0]?.total ?? "?"}`);
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
