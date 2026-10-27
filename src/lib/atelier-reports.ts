/**
 * Signalements de carte, lus et acquittés par l'atelier.
 *
 * Deux voies de lecture, selon l'endroit où tourne l'atelier :
 *   • en ligne, avec la session d'un administrateur (`is_admin()` vrai, policies
 *     de la migration 050) — c'est la voie normale depuis le site ;
 *   • en local, par la connexion de maintenance (`.env` :
 *     `SUPABASE_ACCESS_TOKEN` ou `SUPABASE_DB_URL`), comme `db:cards`, pour que
 *     l'outil de développement n'ait pas besoin d'un compte à ouvrir.
 *
 * La clé publique ne peut jamais les lire : les policies n'ouvrent la table
 * qu'aux administrateurs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { openRunner, type Runner } from "../../scripts/lib/db-runner";

export type CardReport = {
  id: number;
  card_id: string;
  topic: string;
  message: string;
  status: "open" | "done";
  /** Dates ISO, sérialisables vers le client si besoin. */
  created_at: string;
  resolved_at: string | null;
};

export type ReportsResult =
  | { ok: true; open: CardReport[]; done: CardReport[]; error?: undefined }
  | { ok: false; open: CardReport[]; done: CardReport[]; error: string };

/** Colonnes lues, partagées par les deux voies. */
const COLUMNS = "id, card_id, topic, message, status, created_at, resolved_at";

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

function toReport(row: Record<string, unknown>): CardReport {
  return {
    id: Number(row.id),
    card_id: String(row.card_id ?? ""),
    topic: String(row.topic ?? "autre"),
    message: String(row.message ?? ""),
    status: row.status === "done" ? "done" : "open",
    created_at: iso(row.created_at),
    resolved_at: row.resolved_at ? iso(row.resolved_at) : null,
  };
}

async function withRunner<T>(work: (runner: Runner) => Promise<T>): Promise<T> {
  const runner = await openRunner();
  try {
    return await work(runner);
  } finally {
    await runner.close();
  }
}

/**
 * File complète des signalements (200 derniers), séparée en deux : à vérifier,
 * et déjà traités (pour retrouver ce qui a été corrigé).
 */
export async function readCardReports(
  supabase?: SupabaseClient | null,
): Promise<ReportsResult> {
  try {
    const rows = supabase
      ? await (async () => {
          const { data, error } = await supabase
            .from("card_reports")
            .select(COLUMNS)
            .order("created_at", { ascending: false })
            .limit(200);
          if (error) throw new Error(error.message);
          return (data ?? []) as Record<string, unknown>[];
        })()
      : await withRunner((runner) =>
          runner.query(
            `select ${COLUMNS}
               from public.card_reports
              order by created_at desc
              limit 200`,
          ),
        );

    const reports = rows.map(toReport);
    return {
      ok: true,
      open: reports.filter((report) => report.status === "open"),
      done: reports.filter((report) => report.status === "done").slice(0, 20),
    };
  } catch (error) {
    return {
      ok: false,
      open: [],
      done: [],
      error: (error as Error).message || "Lecture impossible.",
    };
  }
}

/**
 * Nombre de signalements en attente, pour la cloche de l'atelier.
 * Une base injoignable ne doit pas casser l'atelier : on renvoie 0.
 */
export async function countOpenReports(supabase?: SupabaseClient | null): Promise<number> {
  try {
    if (supabase) {
      const { count, error } = await supabase
        .from("card_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw new Error(error.message);
      return count ?? 0;
    }

    const rows = await withRunner((runner) =>
      runner.query(`select count(*)::int as n from public.card_reports where status = 'open'`),
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Marque un signalement comme traité (ou le rouvre).
 *
 * `Runner.query` n'accepte qu'une chaîne : les deux valeurs insérées sont un
 * identifiant déjà vérifié entier et un statut choisi dans une liste fermée,
 * jamais du texte venu du formulaire. La voie Supabase n'écrit que ces deux
 * colonnes, sous la policy « traitement admin ».
 */
export async function setCardReportStatus(
  supabase: SupabaseClient | null | undefined,
  id: number,
  done: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Signalement inconnu." };
  const status = done ? "done" : "open";
  const resolvedAt = done ? "now()" : "null";

  try {
    if (supabase) {
      const { error } = await supabase
        .from("card_reports")
        .update({
          status,
          resolved_at: done ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    await withRunner((runner) =>
      runner.query(
        `update public.card_reports
            set status = '${status}', resolved_at = ${resolvedAt}
          where id = ${id}`,
      ),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message || "La mise à jour a échoué." };
  }
}
