"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getFrame } from "@/lib/frames.config";

async function admin() {
  const session = await getSession();
  if (!session) return null;
  const { data } = await session.supabase.rpc("is_admin");
  return data === true ? session : null;
}

/** Active ou désactive un cadre pour tout le monde. */
export async function setFrameActive(formData: FormData) {
  const session = await admin();
  if (!session) return;

  const frameId = String(formData.get("frame") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!getFrame(frameId)) return;

  const { error } = await session.supabase.rpc("frame_admin_set_active", {
    p_frame_id: frameId,
    p_active: active,
    p_reason: reason || null,
  });
  if (error) console.error("frame_admin_set_active", error);

  revalidatePath("/admin/cadres");
  revalidatePath("/profil");
}

/** Attribue un cadre à un joueur, avec un motif journalisé. */
export async function assignFrame(formData: FormData) {
  const session = await admin();
  if (!session) return;

  const username = String(formData.get("username") ?? "").trim().slice(0, 60);
  const frameId = String(formData.get("frame") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  const frame = getFrame(frameId);
  if (!username || !frame) return;

  const { error } = await session.supabase.rpc("frame_admin_assign", {
    p_username: username,
    p_frame_id: frame.id,
    p_reason: reason || null,
    p_frame_name: frame.name,
  });
  if (error) console.error("frame_admin_assign", error);

  revalidatePath("/admin/cadres");
  revalidatePath("/profil");
}

/** Retire un cadre à un joueur (usage rare : correction ou sanction). */
export async function removeFrame(formData: FormData) {
  const session = await admin();
  if (!session) return;

  const username = String(formData.get("username") ?? "").trim().slice(0, 60);
  const frameId = String(formData.get("frame") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!username || !getFrame(frameId)) return;

  const { error } = await session.supabase.rpc("frame_admin_remove", {
    p_username: username,
    p_frame_id: frameId,
    p_reason: reason || null,
  });
  if (error) console.error("frame_admin_remove", error);

  revalidatePath("/admin/cadres");
  revalidatePath("/profil");
}

/** Remet tous les joueurs dans la file de recalcul. */
export async function queueAllFrames() {
  const session = await admin();
  if (!session) return;

  const { error } = await session.supabase.rpc("frame_admin_queue_all");
  if (error) console.error("frame_admin_queue_all", error);

  revalidatePath("/admin/cadres");
}
