"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { atelierSession } from "@/lib/atelier-access";

/** Les pages qui montrent le catalogue : tout doit être relu après édition. */
function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/atelier/cartes");
  revalidatePath("/collection");
  revalidatePath("/marche");
  revalidatePath("/boosters");
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Grossissement du visuel : vide quand il vaut 1 (le cadrage par défaut). */
function zoom(value: FormDataEntryValue | null): number | null {
  const raw = text(value);
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Enregistre une modification de carte. L'écriture passe par une fonction SQL
 * qui vérifie elle-même l'appartenance à l'atelier : une action serveur peut
 * être appelée seule, la garde ne doit donc pas vivre que dans la page.
 */
export async function saveCardEdit(formData: FormData) {
  const session = await atelierSession();
  if (!session) redirect("/atelier/cartes?erreur=local");

  const id = text(formData.get("cardId"));
  if (!id) redirect("/atelier/cartes?erreur=carte");

  const { error } = await session.supabase.rpc("atelier_save_card_edit", {
    p_card_id: id,
    p_name: text(formData.get("name")),
    p_rarity: text(formData.get("rarity")),
    p_universe: text(formData.get("universe")),
    p_emoji: text(formData.get("emoji")),
    p_image_url: text(formData.get("imageUrl")),
    // Cadrage choisi dans l'aperçu (zoom, déplacement, remplir ou non le cadre).
    p_image_fit: text(formData.get("imageFit")),
    p_image_position: text(formData.get("imagePosition")),
    p_image_zoom: zoom(formData.get("imageZoom")),
  });

  if (error) {
    redirect(`/atelier/cartes?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(error.message)}`);
  }

  refresh();
  redirect(`/atelier/cartes?edit=${encodeURIComponent(id)}&ok=1`);
}

/**
 * Supprime complètement une carte : copies, annonces, ordres, envies, fiches
 * et signalements partent avec elle, et une tombe en base empêche le site de
 * la réafficher. La confirmation est explicite (case à cocher).
 */
export async function deleteCard(formData: FormData) {
  const session = await atelierSession();
  if (!session) redirect("/atelier/cartes?erreur=local");

  const id = text(formData.get("cardId"));
  if (!id) redirect("/atelier/cartes?erreur=carte");

  if (formData.get("confirme") !== "1") {
    redirect(`/atelier/cartes?edit=${encodeURIComponent(id)}&erreur=confirmation`);
  }

  const { error } = await session.supabase.rpc("atelier_delete_card", { p_card_id: id });
  if (error) {
    redirect(`/atelier/cartes?edit=${encodeURIComponent(id)}&erreur=${encodeURIComponent(error.message)}`);
  }

  refresh();
  redirect(`/atelier/cartes?ok=supprimee&carte=${encodeURIComponent(id)}`);
}
