import type { SupabaseClient } from "@supabase/supabase-js";
import { getCollection, getWishlist } from "@/lib/data";
import { parseChatAdminQueue, parseChatPage, parseChatState } from "./types";
import type { ChatAdminQueue, ChatPage, ChatState } from "./types";

/**
 * Requêtes serveur de L'Agora.
 *
 * Tout passe par des fonctions SQL (`security definer`) : les tables du chat
 * ne sont pas lisibles directement. Si la migration 031 n'est pas encore
 * appliquée, les fonctions renvoient `PGRST202` / `42883` : le panneau
 * affiche alors un état d'attente au lieu de casser la page du marché.
 */

function isMissingFunction(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883" || error?.code === "PGRST205";
}

/**
 * État initial du panneau.
 *
 * `chat_join` place le joueur : dernière langue choisie, dernier salon s'il
 * n'est pas complet, sinon le salon le moins rempli de sa langue. C'est aussi
 * lui qui enregistre la présence et, après une heure d'absence, le message
 * d'arrivée.
 */
export async function getChatState(supabase: SupabaseClient): Promise<ChatState | null> {
  const { data, error } = await supabase.rpc("chat_join", {
    p_language: null,
    p_room_id: null,
  });

  if (error) {
    if (!isMissingFunction(error)) console.error("chat_join", error);
    return null;
  }

  const payload = data as { ok?: boolean; state?: unknown } | null;
  if (!payload?.ok) return null;
  return parseChatState(payload.state);
}

/** Historique d'un salon, ou de tous les salons (`roomId` nul, lecture seule). */
export async function getChatHistory(
  supabase: SupabaseClient,
  roomId: number | null,
  options: { before?: number | null; after?: number | null; limit?: number } = {},
): Promise<ChatPage> {
  const { data, error } = await supabase.rpc("chat_history", {
    p_room_id: roomId,
    p_before: options.before ?? null,
    p_after: options.after ?? null,
    p_limit: options.limit ?? 50,
  });

  if (error) {
    if (!isMissingFunction(error)) console.error("chat_history", error);
    return { messages: [], hasMore: false };
  }

  return parseChatPage(data);
}

/**
 * Cartes proposables dans le sélecteur d'annonce.
 *
 * On ne renvoie que la collection et les envies **du joueur connecté** : la
 * mention « Il te manque » de chaque annonce est calculée avec ces mêmes
 * données, côté serveur, jamais avec celles d'un autre joueur.
 */
export type ChatCardOptions = {
  /** Exemplaires possédés, par carte. */
  quantities: Record<string, number>;
  /** Cartes retirées du catalogue : ni proposées ni recherchées. */
  retired: string[];
  /** Cartes dans les envies du joueur. */
  wishlist: string[];
};

export async function getChatCardOptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChatCardOptions> {
  const [collection, wishlist] = await Promise.all([
    getCollection(supabase, userId),
    getWishlist(supabase, userId),
  ]);

  const quantities: Record<string, number> = {};
  const retired: string[] = [];
  for (const row of collection) {
    quantities[row.cardId] = row.quantity;
    if (row.retired) retired.push(row.cardId);
  }

  return { quantities, retired, wishlist: wishlist.map((row) => row.cardId) };
}

/** File de signalements, sanctions actives et journal — réservée aux admins. */
export async function getChatAdminQueue(
  supabase: SupabaseClient,
): Promise<ChatAdminQueue | null> {
  const { data, error } = await supabase.rpc("chat_admin_queue");

  if (error) {
    if (!isMissingFunction(error)) console.error("chat_admin_queue", error);
    return null;
  }

  return parseChatAdminQueue(data);
}
