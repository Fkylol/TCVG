/**
 * Connexion à la base Supabase pour les scripts de maintenance.
 *
 * Deux voies, dans cet ordre :
 *   1. SUPABASE_ACCESS_TOKEN — token personnel (sbp_…) → Management API.
 *   2. SUPABASE_DB_URL — chaîne de connexion Postgres (contient le mot de passe).
 */

import { Client } from "pg";

export type Runner = {
  label: string;
  query: (sql: string) => Promise<Record<string, unknown>[]>;
  close: () => Promise<void>;
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function projectRefFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname.split(".")[0];
  } catch {
    return undefined;
  }
}

export const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ?? projectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

async function viaApi(token: string): Promise<Runner> {
  if (!PROJECT_REF) throw new Error("Impossible de déduire la référence du projet (NEXT_PUBLIC_SUPABASE_URL).");

  const query = async (sql: string) => {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "tcgv-migrate",
      },
      body: JSON.stringify({ query: sql }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Management API ${response.status} : ${text.slice(0, 300)}`);
    }
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    } catch {
      return [];
    }
  };

  // Test de validité du token avant tout travail.
  await query("select 1 as ok");
  return { label: `Management API (projet ${PROJECT_REF})`, query, close: async () => {} };
}

async function viaPostgres(connectionString: string): Promise<Runner> {
  if (/YOUR-PASSWORD/i.test(safeDecode(connectionString))) {
    throw new Error(
      "La chaîne contient encore le placeholder [YOUR-PASSWORD] : remplace-le par le mot de passe de la base.",
    );
  }

  const url = new URL(connectionString.trim());
  // Un espace recopié en début ou fin de mot de passe (souvent encodé `%20`)
  // provoque un `28P01` impossible à diagnostiquer à l'œil : on le retire.
  const password = safeDecode(url.password).trim();
  if (!password) throw new Error("Le mot de passe de SUPABASE_DB_URL est vide.");

  const client = new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: safeDecode(url.username),
    password,
    database: url.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });

  await client.connect();
  return {
    label: "connexion Postgres directe",
    query: async (sql: string) => (await client.query(sql)).rows as Record<string, unknown>[],
    close: () => client.end(),
  };
}

/** Ouvre une connexion en essayant le token, puis la chaîne Postgres. */
export async function openRunner(): Promise<Runner> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const dbUrl = process.env.SUPABASE_DB_URL;

  try {
    if (token) return await viaApi(token);
    if (dbUrl) return await viaPostgres(dbUrl);
    throw new Error(
      "Aucune voie disponible.\n" +
        "  • SUPABASE_ACCESS_TOKEN  (Account → Access Tokens, révocable) — recommandé\n" +
        "  • SUPABASE_DB_URL        (Project Settings → Database → Connection string)",
    );
  } catch (error) {
    if ((error as { code?: string }).code === "28P01") {
      throw new Error(
        "Mot de passe refusé (28P01). Utilise plutôt SUPABASE_ACCESS_TOKEN, ou colle la migration\n" +
          "  dans le SQL Editor du dashboard.",
      );
    }
    throw error;
  }
}
