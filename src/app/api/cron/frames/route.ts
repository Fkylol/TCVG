import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { evaluateFramesForUser } from "@/lib/frames";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Tâche planifiée des cadres — à appeler une fois par jour :
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://tcvg.fun/api/cron/frames
 *
 * Elle traite la file d'évaluation (acquisitions, ventes, échanges,
 * parrainages) puis recalcule les joueurs les plus anciens à évaluer. Le
 * recalcul complet tourne donc en continu sur plusieurs jours si la base est
 * grande, sans jamais dépasser le temps d'une fonction.
 *
 * Sans `CRON_SECRET`, l'endpoint répond 503 : jamais de déblocage ouvert à tous.
 */

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-cron-secret")?.trim() ?? "");

  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function run(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET non configuré" }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "non autorisé" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY manquant" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const requested = Number.parseInt(searchParams.get("limit") ?? "150", 10);
  const limit = Number.isFinite(requested) ? Math.min(300, Math.max(10, requested)) : 150;

  const [queue, sweep] = await Promise.all([
    admin.rpc("frame_queue_list", { p_limit: limit }),
    admin.rpc("frame_sweep_list", { p_limit: limit }),
  ]);

  if (queue.error || sweep.error) {
    console.error("frame_cron_lists", queue.error ?? sweep.error);
    return NextResponse.json(
      { ok: false, error: (queue.error ?? sweep.error)?.message ?? "liste indisponible" },
      { status: 500 },
    );
  }

  const ids = Array.from(
    new Set([
      ...((queue.data ?? []) as string[]),
      ...((sweep.data ?? []) as string[]),
    ]),
  );

  let newlyUnlocked = 0;
  let processed = 0;
  let failed = 0;

  for (const userId of ids) {
    const result = await evaluateFramesForUser(admin, userId);
    if (result.skipped) {
      failed += 1;
      continue;
    }
    processed += 1;
    newlyUnlocked += result.newlyUnlocked.length;
  }

  return NextResponse.json({
    ok: true,
    queued: (queue.data ?? []).length,
    sweep: (sweep.data ?? []).length,
    processed,
    failed,
    newlyUnlocked,
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
