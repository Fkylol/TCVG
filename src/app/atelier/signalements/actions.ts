"use server";

import { revalidatePath } from "next/cache";

import { atelierSession } from "@/lib/atelier-access";
import { setCardReportStatus } from "@/lib/atelier-reports";

export type ResolveReportResult = { ok: true } | { ok: false; error: string };

/**
 * Marque un signalement comme traité (ou le rouvre).
 *
 * En ligne, la mise à jour passe par la session de l'administrateur (policy
 * « traitement admin ») : la garde du layout est revérifiée ici, une action
 * serveur pouvant être appelée seule. En local, elle passe par la connexion de
 * maintenance (`.env`), l'atelier n'ayant pas de compte à ouvrir.
 */
export async function resolveCardReport(id: number, done: boolean): Promise<ResolveReportResult> {
  const session = await atelierSession();
  const result = await setCardReportStatus(session?.supabase, id, done);
  if (!result.ok) return result;

  revalidatePath("/atelier/signalements");
  revalidatePath("/atelier/cartes");
  return { ok: true };
}
