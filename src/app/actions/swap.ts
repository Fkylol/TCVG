"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { getCard } from "@/lib/cards";
import { getCollection } from "@/lib/data";
import { chatErrorText, checkChatBody } from "@/lib/chat/text";
import { MAX_OFFER_MESSAGE, parseOfferBoard, type ChatOfferBoard } from "@/lib/chat/offers";
import { discordDmEnabled, sendDiscordDm, swapOfferDmText } from "@/lib/discord";
import { evaluateFrames } from "@/lib/frames";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Actions serveur des échanges carte contre carte.
 *
 * Aucune règle métier n'est décidée ici : les fonctions SQL vérifient la
 * propriété des copies, le séquestre, les limites et l'expiration. Ce module
 * valide le texte pour un retour immédiat, traduit les refus et envoie le
 * message privé Discord.
 */

export type SwapActionResult = { ok: true; offerId?: number } | { ok: false; message: string };
export type SwapBoardResult = { ok: true; board: ChatOfferBoard } | { ok: false; message: string };

type RpcError = { message?: string } | null;

function reasonOf(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { ok?: boolean; reason?: string };
  return row.ok === false ? (row.reason ?? "error") : null;
}

function failure(reason: string | null, error?: RpcError): SwapActionResult {
  if (reason === null && error) console.error("swap", error.message);
  return { ok: false, message: chatErrorText(reason) };
}

/** Identifiant d'offre renvoyé par les fonctions SQL. */
function offerIdOf(data: unknown): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const id = (data as { id?: unknown }).id;
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Prévient le destinataire en message privé Discord.
 *
 * Aucun message n'est envoyé personnellement à l'aveugle :
 * `chat_offer_notice()` ne fournit l'identifiant du destinataire qu'au proposeur,
 * pour l'offre qu'il vient de créer, et seul le serveur (clé de service) lit
 * `discord_links`. Sans jeton de bot, sans identifiant lié ou si le joueur ne
 * partage pas le serveur du jeu avec le bot, rien ne part : la notification
 * in-site reste la trace, et l'action réussit quand même.
 */
async function notifyOfferByDiscord(
  supabase: SupabaseClient,
  offerId: number,
  proposer: string,
): Promise<void> {
  if (!discordDmEnabled() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const { data, error } = await supabase.rpc("chat_offer_notice", { p_offer_id: offerId });
    if (error || !data) return;

    const notice = data as {
      ok?: boolean;
      recipient?: string;
      owner?: string;
      offered_card_id?: string;
      requested_card_id?: string | null;
    };
    if (notice.ok !== true || !notice.recipient) return;

    const admin = createAdminClient();
    if (!admin) return;

    const { data: link } = await admin
      .from("discord_links")
      .select("discord_id")
      .eq("user_id", notice.recipient)
      .maybeSingle();
    const discordId = (link as { discord_id?: string } | null)?.discord_id;
    if (!discordId) return;

    await sendDiscordDm(
      discordId,
      swapOfferDmText({
        owner: notice.owner ?? "Joueur",
        proposer,
        offered: getCard(notice.offered_card_id ?? "")?.name ?? "une carte",
        requested: notice.requested_card_id
          ? (getCard(notice.requested_card_id)?.name ?? "une carte")
          : null,
      }),
    );
  } catch (error) {
    // Un MP manqué ne doit jamais faire échouer un échange.
    console.error("swap_discord", error);
  }
}

/** Propose une de ses cartes contre celle d'une annonce du chat. */
export async function createChatOffer(input: {
  announcementId: number;
  cardId: string;
  holo: boolean;
  message: string;
  clientKey: string;
}): Promise<SwapActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const clean = checkChatBody(input.message, true);
  if (!clean.ok) return { ok: false, message: chatErrorText(clean.reason) };
  if (Array.from(clean.body).length > MAX_OFFER_MESSAGE) {
    return { ok: false, message: chatErrorText("offer_too_long") };
  }

  const { data, error } = await session.supabase.rpc("chat_offer_create", {
    p_announcement_id: input.announcementId,
    p_card_id: input.cardId,
    p_holo: input.holo,
    p_message: clean.body,
    p_client_key: input.clientKey,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);

  const offerId = offerIdOf(data);
  revalidatePath("/agora/offres");
  revalidatePath("/notifications");

  // Pseudo du proposeur : celui du profil, comme dans le chat.
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("username")
    .eq("id", session.user.id)
    .maybeSingle();

  if (offerId) {
    await notifyOfferByDiscord(
      session.supabase,
      offerId,
      (profile as { username?: string } | null)?.username ?? "Un joueur",
    );
  }

  return { ok: true, offerId };
}

/** Accepte, refuse ou contre-propose une offre reçue. */
export async function respondChatOffer(input: {
  offerId: number;
  action: "accept" | "decline" | "counter";
  counterCardId?: string | null;
  counterHolo?: boolean;
  counterMessage?: string;
  clientKey?: string;
}): Promise<SwapActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  let message = "";
  if (input.action === "counter") {
    const clean = checkChatBody(input.counterMessage ?? "", true);
    if (!clean.ok) return { ok: false, message: chatErrorText(clean.reason) };
    if (Array.from(clean.body).length > MAX_OFFER_MESSAGE) {
      return { ok: false, message: chatErrorText("offer_too_long") };
    }
    message = clean.body;
  }

  const { data, error } = await session.supabase.rpc("chat_offer_respond", {
    p_offer_id: input.offerId,
    p_action: input.action,
    p_counter_card_id: input.action === "counter" ? (input.counterCardId ?? null) : null,
    p_counter_holo: input.action === "counter" ? Boolean(input.counterHolo) : false,
    p_counter_message: message,
    p_client_key: input.clientKey ?? null,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);

  revalidatePath("/agora/offres");
  revalidatePath("/notifications");
  revalidatePath("/collection");

  // Un échange accepté change les deux collections ; l'autre joueur est mis
  // en file par le trigger de collection, le joueur courant est évalué ici.
  if (input.action === "accept") await evaluateFrames(session.user.id);

  // Une contre-proposition crée une nouvelle offre : elle peut aussi
  // déclencher le message privé du joueur qui la reçoit.
  const offerId = offerIdOf(data);
  const isCounter = Boolean((data as { counter?: boolean } | null)?.counter);
  if (isCounter && offerId) {
    const { data: profile } = await session.supabase
      .from("profiles")
      .select("username")
      .eq("id", session.user.id)
      .maybeSingle();

    await notifyOfferByDiscord(
      session.supabase,
      offerId,
      (profile as { username?: string } | null)?.username ?? "Un joueur",
    );
  }

  return { ok: true, offerId };
}

/** Retire une proposition encore en attente : la copie revient dans l'album. */
export async function cancelChatOffer(offerId: number): Promise<SwapActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_offer_cancel", {
    p_offer_id: offerId,
  });

  const reason = reasonOf(data);
  if (error || reason) return failure(reason ?? "error", error);

  revalidatePath("/agora/offres");
  revalidatePath("/collection");
  return { ok: true };
}

/**
 * Cartes que le joueur peut proposer : ses copies disponibles (hors cartes
 * retirées). Le séquestre du marché a déjà déduit les copies en vente, donc
 * ce que renvoie la collection est exactement ce qui est libre.
 */
export type SwapCard = {
  cardId: string;
  quantity: number;
  holoQuantity: number;
};

export async function loadSwapCards(): Promise<
  { ok: true; cards: SwapCard[] } | { ok: false; message: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  try {
    const collection = await getCollection(session.supabase, session.user.id);
    return {
      ok: true,
      cards: collection
        .filter((row) => !row.retired && row.quantity > 0)
        .map((row) => ({
          cardId: row.cardId,
          quantity: row.quantity,
          holoQuantity: row.holoQuantity,
        })),
    };
  } catch (error) {
    console.error("swap_cards", error);
    return { ok: false, message: "Ta collection n'a pas pu être lue. Réessaie dans un instant." };
  }
}

/** Offres reçues et envoyées, plus la préférence e-mail. */
export async function loadChatOffers(): Promise<SwapBoardResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("chat_offer_list");
  if (error) {
    console.error("chat_offer_list", error);
    return { ok: false, message: chatErrorText("error") };
  }

  const board = parseOfferBoard(data);
  if (!board) return { ok: false, message: chatErrorText("error") };
  return { ok: true, board };
}
