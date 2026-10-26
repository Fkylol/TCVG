"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { checkChatBody, chatErrorText } from "@/lib/chat/text";
import { isChatLanguage, type ChatLanguage } from "@/lib/chat/config";
import { parseChatState, parseChatUserHistory } from "@/lib/chat/types";
import type { ChatState, ChatUserHistory } from "@/lib/chat/types";

/**
 * Actions serveur de L'Agora.
 *
 * Chaque action revérifie la session, puis délègue à une fonction SQL qui
 * refait tous les contrôles (déblocage, sanction, débit, propriété de la
 * carte, rôle de modération). Le client ne décide de rien : il ne fait
 * qu'afficher la réponse.
 */

export type ChatActionResult = { ok: true } | { ok: false; message: string };
export type ChatStateResult = { ok: true; state: ChatState } | { ok: false; message: string };

/** Session authentifiée, telle que la renvoie `getSession`. */
type AuthedSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;

type RpcError = { message?: string } | null;

/** Extrait la raison métier d'une réponse `{ ok: false, reason }`. */
function reasonOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { ok?: boolean; reason?: string };
  return row.ok === false ? (row.reason ?? "error") : null;
}

function failure(reason: string | null, error?: RpcError): ChatActionResult {
  if (reason === null && error) console.error("chat", error.message);
  return { ok: false, message: chatErrorText(reason) };
}

/** Envoie un message de texte dans un salon. */
export async function sendChatMessage(roomId: number, rawBody: string): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const check = checkChatBody(rawBody);
  if (!check.ok) return { ok: false, message: chatErrorText(check.reason) };

  const { data, error } = await session.supabase.rpc("chat_send", {
    p_room_id: roomId,
    p_body: check.body,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);

  return { ok: true };
}

/**
 * Publie l'annonce elle-même. Mutualisé par les deux points d'entrée : le
 * panneau (salon choisi à l'écran) et la fiche d'une carte (salon courant).
 */
async function publishAnnouncement(
  session: AuthedSession,
  kind: "have" | "want",
  cardId: string,
  roomId: number,
  rawBody: string,
): Promise<ChatActionResult> {
  const check = checkChatBody(rawBody, true);
  if (!check.ok) return { ok: false, message: chatErrorText(check.reason) };

  const { data, error } = await session.supabase.rpc("chat_announce", {
    p_kind: kind,
    p_card_id: cardId,
    p_room_id: roomId,
    p_body: check.body,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);

  return { ok: true };
}

/** Publie une annonce « J'échange » ou « Je cherche » avec sa carte. */
export async function announceCard(
  kind: "have" | "want",
  cardId: string,
  roomId: number,
  rawBody = "",
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  return publishAnnouncement(session, kind, cardId, roomId, rawBody);
}

/**
 * Publie une annonce depuis la fiche d'une carte, sans ouvrir le panneau.
 *
 * Le salon est celui du joueur : `chat_join` sans argument reprend la langue
 * et le salon mémorisés, sinon le salon le moins rempli de sa langue. Le
 * message apparaît donc là où le joueur lit, jamais dans un salon arbitraire.
 * Les règles d'annonce (doublon, carte absente ou en envie, débit, quota)
 * restent vérifiées par `chat_announce`.
 */
export async function announceCardHere(
  kind: "have" | "want",
  cardId: string,
  rawBody = "",
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_join", {
    p_language: null,
    p_room_id: null,
  });

  if (error) return failure("error", error);

  const payload = data as { ok?: boolean; reason?: string; state?: unknown } | null;
  if (!payload?.ok) return failure(payload?.reason ?? "error");

  const state = parseChatState(payload.state);
  if (!state?.roomId) return { ok: false, message: chatErrorText("no_room") };

  return publishAnnouncement(session, kind, cardId, state.roomId, rawBody);
}

/** Retire une annonce (l'auteur seulement, ou la modération). */
export async function withdrawChatAnnouncement(announcementId: number): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_withdraw_announcement", {
    p_id: announcementId,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);
  return { ok: true };
}

/** Supprime un de ses propres messages (droit à l'effacement). */
export async function deleteChatMessage(messageId: number): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_delete_message", {
    p_id: messageId,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);
  return { ok: true };
}

/** Signale un message à la modération. */
export async function reportChatMessage(
  messageId: number,
  reason: string,
  note: string | null = null,
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_report", {
    p_message_id: messageId,
    p_reason: reason,
    p_note: note?.slice(0, 200) || null,
  });

  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);
  return { ok: true };
}

/**
 * Bloque un joueur : ses messages disparaissent du salon et, plus tard, ses
 * offres d'échange ne pourront plus arriver.
 */
export async function blockChatUser(userId: string): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };
  if (userId === session.user.id) return { ok: false, message: chatErrorText("invalid_user") };

  const { data, error } = await session.supabase.rpc("chat_block", { p_user_id: userId });
  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);
  return { ok: true };
}

export async function unblockChatUser(userId: string): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_unblock", { p_user_id: userId });
  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);
  return { ok: true };
}

/** Entre dans un groupe de langues (ou un salon précis). */
export async function joinChat(
  language?: ChatLanguage,
  roomId?: number | null,
): Promise<ChatStateResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_join", {
    p_language: isChatLanguage(language) ? language : null,
    p_room_id: roomId ?? null,
  });

  if (error) {
    console.error("chat_join", error);
    return { ok: false, message: chatErrorText("error") };
  }

  const payload = data as { ok?: boolean; reason?: string; state?: unknown } | null;
  if (!payload?.ok) return { ok: false, message: chatErrorText(payload?.reason) };

  const state = parseChatState(payload.state);
  if (!state) return { ok: false, message: chatErrorText("error") };
  return { ok: true, state };
}

/** Change de salon à la main (capacité vérifiée en base). */
export async function setChatRoom(roomId: number): Promise<ChatStateResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_set_room", { p_room_id: roomId });
  if (error) {
    console.error("chat_set_room", error);
    return { ok: false, message: chatErrorText("error") };
  }

  const payload = data as { ok?: boolean; reason?: string; state?: unknown } | null;
  if (!payload?.ok) return { ok: false, message: chatErrorText(payload?.reason) };

  const state = parseChatState(payload.state);
  if (!state) return { ok: false, message: chatErrorText("error") };
  return { ok: true, state };
}

/** Battement de présence : renvoie les compteurs de joueurs connectés. */
export async function pingChat(roomId: number): Promise<{ ok: boolean; online: Record<number, number> }> {
  const session = await getSession();
  if (!session) return { ok: false, online: {} };

  const { data, error } = await session.supabase.rpc("chat_ping", { p_room_id: roomId });
  if (error) return { ok: false, online: {} };

  const payload = data as { ok?: boolean; online?: { room_id: number; online: number }[] } | null;
  const online: Record<number, number> = {};
  for (const row of payload?.online ?? []) {
    online[Number(row.room_id)] = Number(row.online);
  }

  return { ok: payload?.ok === true, online };
}

/** Masque ou réaffiche les annonces dans le fil. */
export async function setChatHideAnnouncements(hide: boolean): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_set_hide_announcements", {
    p_hide: hide,
  });
  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);
  return { ok: true };
}

// ————— Modération —————
// Les fonctions SQL vérifient `is_admin()` : ces actions ne protègent rien
// par elles-mêmes, elles ne font que traduire la réponse.

export async function moderateDeleteMessage(
  messageId: number,
  reason: string,
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_moderate_delete", {
    p_message_id: messageId,
    p_reason: reason.slice(0, 200),
  });

  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);

  revalidatePath("/agora");
  revalidatePath("/agora/moderation");
  return { ok: true };
}

export async function muteChatUser(
  userId: string,
  minutes: number | null,
  reason: string,
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_mute", {
    p_user_id: userId,
    p_minutes: minutes,
    p_reason: reason.slice(0, 200),
  });

  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);

  revalidatePath("/agora");
  revalidatePath("/agora/moderation");
  return { ok: true };
}

export async function unmuteChatUser(userId: string): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_unmute", { p_user_id: userId });
  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);

  revalidatePath("/agora/moderation");
  return { ok: true };
}

export async function clearChatAnnouncements(userId: string): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_clear_announcements", {
    p_user_id: userId,
  });
  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);

  revalidatePath("/agora");
  revalidatePath("/agora/moderation");
  return { ok: true };
}

export async function setChatRoomReadOnly(
  roomId: number,
  readOnly: boolean,
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_set_read_only", {
    p_room_id: roomId,
    p_read_only: readOnly,
  });
  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);

  revalidatePath("/agora");
  revalidatePath("/agora/moderation");
  return { ok: true };
}

export type ChatUserHistoryResult =
  | { ok: true; history: ChatUserHistory }
  | { ok: false; message: string };

/** Historique des messages d'un joueur (y compris supprimés), pour la modération. */
export async function loadChatUserHistory(userId: string): Promise<ChatUserHistoryResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_admin_user_history", {
    p_user_id: userId,
    p_limit: 50,
  });

  if (error) {
    console.error("chat_admin_user_history", error);
    return { ok: false, message: chatErrorText("error") };
  }

  const history = parseChatUserHistory(data);
  if (!history) return { ok: false, message: chatErrorText("not_admin") };

  return { ok: true, history };
}

export async function resolveChatReport(
  reportId: number,
  status: "handled" | "dismissed",
): Promise<ChatActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_resolve_report", {
    p_report_id: reportId,
    p_status: status,
  });
  const failureReason = reasonOf(data);
  if (error || failureReason) return failure(failureReason ?? "error", error);

  revalidatePath("/agora/moderation");
  return { ok: true };
}
