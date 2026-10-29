import { requireSession } from "@/lib/auth";
import { getReferralAdminReport } from "@/lib/referral/service";
import { csvCell } from "@/lib/referral/rules";

export const dynamic = "force-dynamic";

/** Export CSV des parrainages — réservé aux administrateurs (`is_admin()`). */
export async function GET() {
  const { supabase } = await requireSession();

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) {
    return new Response("Accès refusé", { status: 403 });
  }

  const report = await getReferralAdminReport(supabase, null);
  if (!report) {
    return new Response("Parrainage indisponible", { status: 503 });
  }

  const header = [
    "id",
    "parrain",
    "filleul",
    "cree_le",
    "statut",
    "voie",
    "boosters_ouverts",
    "a2f",
    "discord_lie",
    "signaux",
    "eligible_le",
    "paye_le",
    "motif_refus",
  ];

  const lines = report.rows.map((row) =>
    [
      row.id,
      row.referrer,
      row.referred,
      row.createdAt,
      row.status,
      row.path ?? "",
      row.openings,
      row.mfa ? "oui" : "non",
      row.discordLinked ? "oui" : "non",
      Object.keys(row.flags ?? {}).join(" "),
      row.eligibleAt ?? "",
      row.paidAt ?? "",
      row.refusedReason ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );

  // BOM UTF-8 : Excel ouvre correctement les accents.
  const csv = `\uFEFF${header.map(csvCell).join(";")}\n${lines.join("\n")}\n`;
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="parrainage-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
