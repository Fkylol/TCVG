"use server";

import { getSession } from "@/lib/auth";
import { normalizeReport } from "@/lib/card-reports";
import { getCard } from "@/lib/cards";

export type ReportCardResult = { status: "ok" } | { status: "error"; message: string };

/**
 * Signale une carte depuis la collection.
 *
 * Le motif et le message sont revérifiés ici : le formulaire peut envoyer
 * n'importe quoi, et la base refuse déjà les valeurs hors bornes. Le
 * signalement reste lisible par l'administration seule (voir migration 050) ;
 * il est relu dans l'atelier local, qui rouvre la carte à corriger.
 */
export async function reportCard(cardId: string, topic: string, message: string): Promise<ReportCardResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const card = getCard((cardId ?? "").trim());
  if (!card) return { status: "error", message: "Carte inconnue." };

  const clean = normalizeReport({ topic, message });
  if (!clean.ok) return { status: "error", message: clean.error };

  const { error } = await session.supabase.from("card_reports").insert({
    card_id: card.id,
    user_id: session.user.id,
    topic: clean.topic,
    message: clean.message,
  });

  if (error) {
    console.error("reportCard", error);
    return { status: "error", message: "L'envoi a échoué. Réessaie dans un instant." };
  }

  return { status: "ok" };
}
