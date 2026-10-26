import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CONFIG } from "@/lib/referral/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Tâche planifiée du parrainage — à appeler toutes les heures :
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://tcvg.fun/api/cron/referrals
 *
 * Elle paie les parrainages différés arrivés à échéance (par lots, avec reprise
 * par parrainage) et purge les empreintes de plus de 90 jours. Sans
 * `CRON_SECRET`, l'endpoint répond 503 : jamais de paiement ouvert à tous.
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
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET non configuré" },
      { status: 503 },
    );
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

  const { data, error } = await admin.rpc("referral_cron_batch", {
    p_limit: REFERRAL_CONFIG.cronBatchSize,
  });

  if (error) {
    console.error("referral_cron_batch", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const { data: purge, error: purgeError } = await admin.rpc("purge_referral_fingerprints");
  if (purgeError) console.error("purge_referral_fingerprints", purgeError);

  return NextResponse.json({ ok: true, batch: data, purge: purge ?? null });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
