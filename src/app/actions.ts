"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { displayName, getSession } from "@/lib/auth";
import { sendFeedbackEmail } from "@/lib/email";
import { getPack } from "@/lib/packs";
import { evaluateFrames, fetchFrameStats } from "@/lib/frames";
import { resolveSelectedFrame } from "@/lib/frames.config";
import { BOOSTER_STOCK_MAX, WISHLIST_LIMIT } from "@/lib/game";
import { CARDS, getCard, type Card } from "@/lib/cards";
import { toCardVariant, type CardVariant } from "@/lib/variants";
import {
  getCardMarketStats,
  getCardSalesHistory,
  getMarketQuote,
  getOwnedCardIds,
  type CardSaleEntry,
  type MarketQuote,
} from "@/lib/data";

async function currentOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return undefined;
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Connexion Discord (OAuth). Le fournisseur doit être activé dans Supabase :
 * Authentication → Providers → Discord, avec l'identifiant et le secret de
 * l'application Discord, et l'URL de retour .../auth/confirm autorisée.
 */
export async function signInWithDiscord() {
  const supabase = await createClient();
  const origin = await currentOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${origin ?? ""}/auth/confirm?next=/boosters`,
      // Scope minimal : pseudo + `mfa_enabled`. Jamais l'e-mail, les serveurs,
      // les messages ou les amis (voir le parrainage et la confidentialité).
      scopes: "identify",
    },
  });

  if (error || !data.url) {
    console.error("signInWithDiscord", error);
    redirect("/login?erreur=discord");
  }

  redirect(data.url);
}

export type PurchaseCard = {
  id: string;
  rarity: string;
  holo: boolean;
  isNew: boolean;
  /** Nombre de copies possédées après l'achat. */
  quantity: number;
  /** Variante cosmétique éventuelle (misprint), normalisée pour le rendu. */
  variant: CardVariant;
};

/** Forme brute renvoyée par `open_pack()` / `buy_booster()` (jsonb en base). */
type RpcCard = {
  id: string;
  rarity: string;
  holo: boolean;
  variant: string | null;
  is_new: boolean;
  quantity: number;
};

function mapCards(cards: RpcCard[] | undefined): PurchaseCard[] {
  return (cards ?? []).map((card) => ({
    id: card.id,
    rarity: card.rarity,
    holo: card.holo,
    isNew: card.is_new,
    quantity: card.quantity,
    variant: toCardVariant(card.variant),
  }));
}

export type RecycleResult =
  | { status: "ok"; amount: number; pixels: number; quantity: number; holo: number }
  | { status: "keep_one"; pixels: number; quantity: number; holo: number }
  | { status: "not_owned"; pixels: number }
  | { status: "error"; message: string };

/**
 * Recycle une copie d'une carte. `holo = true` retire une brillante (3 × la
 * valeur), sinon une normale. La règle « une copie normale est toujours
 * conservée » et le crédit atomique sont appliqués par `recycle_card()`.
 */
export async function recycleCard(cardId: string, holo = false): Promise<RecycleResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("recycle_card", {
    p_card_id: cardId,
    p_holo: holo,
  });

  if (error) {
    console.error("recycle_card", error);
    return { status: "error", message: "Recyclage impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    amount?: number;
    pixels?: number;
    quantity?: number;
    holo?: number;
    reason?: string;
  } | null;

  if (!payload) return { status: "error", message: "Recyclage impossible. Réessaie dans un instant." };

  if (!payload.ok) {
    if (payload.reason === "keep_one") {
      return {
        status: "keep_one",
        pixels: payload.pixels ?? 0,
        quantity: payload.quantity ?? 0,
        holo: payload.holo ?? 0,
      };
    }
    if (payload.reason === "not_owned") {
      return { status: "not_owned", pixels: payload.pixels ?? 0 };
    }
    return { status: "error", message: "Recyclage impossible. Réessaie dans un instant." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/collection");
  revalidatePath(`/card/${cardId}`);

  return {
    status: "ok",
    amount: payload.amount ?? 0,
    pixels: payload.pixels ?? 0,
    quantity: payload.quantity ?? 0,
    holo: payload.holo ?? 0,
  };
}

export type RecycleAllResult =
  | { status: "ok"; amount: number; cards: number; pixels: number }
  | { status: "error"; message: string };

/** Recycle d'un coup tous les doublons normaux ; les holos sont conservées. */
export async function recycleAllDuplicates(): Promise<RecycleAllResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("recycle_all_duplicates");

  if (error) {
    console.error("recycle_all_duplicates", error);
    return { status: "error", message: "Recyclage impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    amount?: number;
    cards?: number;
    pixels?: number;
  } | null;

  if (!payload?.ok) {
    return { status: "error", message: "Recyclage impossible. Réessaie dans un instant." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/collection");

  return {
    status: "ok",
    amount: payload.amount ?? 0,
    cards: payload.cards ?? 0,
    pixels: payload.pixels ?? 0,
  };
}

export type CreateListingResult =
  | { status: "ok"; id: number; price: number }
  | { status: "not_owned" }
  | { status: "out_of_bounds"; min: number; max: number; reference: number }
  | { status: "too_many"; max: number }
  | { status: "error"; message: string };

/** Met une copie en vente — la dernière comprise. Le prix, la possession de la
 *  variante et la limite d'annonces sont validés par `create_listing()` en base. */
export type SellQuoteResult =
  | {
      status: "ok";
      normal: MarketQuote | null;
      holo: MarketQuote | null;
      median: number | null;
      lowest: number | null;
    }
  | { status: "error"; message: string };

/**
 * Chiffres du marché pour la modale de vente de la collection : prix conseillé
 * et fourchette par variante, médiane des ventes récentes et annonce la moins
 * chère. Tout est calculé en base, aucune estimation côté navigateur.
 */
export async function fetchSellQuote(cardId: string): Promise<SellQuoteResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };
  if (!getCard(cardId)) return { status: "error", message: "Carte introuvable." };

  const [normal, holo, stats] = await Promise.all([
    getMarketQuote(session.supabase, cardId, false),
    getMarketQuote(session.supabase, cardId, true),
    getCardMarketStats(session.supabase, cardId),
  ]);

  return { status: "ok", normal, holo, median: stats.median30, lowest: stats.lowest };
}

export async function createListing(
  cardId: string,
  holo: boolean,
  price: number,
): Promise<CreateListingResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  if (!Number.isInteger(price) || price < 1) {
    return { status: "error", message: "Indique un prix entier en Pixels." };
  }

  const { data, error } = await session.supabase.rpc("create_listing", {
    p_card_id: cardId,
    p_holo: holo,
    p_price: price,
  });

  if (error) {
    console.error("create_listing", error);
    // Limite de débit et cartes retirées sont refusées par des triggers :
    // c'est le seul endroit où le joueur en reçoit la raison.
    if (error.message.includes("rate_limited")) {
      return {
        status: "error",
        message: "Trop d'actions au marché en peu de temps : réessaie dans quelques minutes.",
      };
    }
    if (error.message.includes("card_retired")) {
      return { status: "error", message: "Cette carte n'est plus échangeable au marché." };
    }
    return { status: "error", message: "Mise en vente impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    id?: number;
    price?: number;
    min?: number;
    max?: number;
    reference?: number;
    reason?: string;
  } | null;

  if (!payload?.ok) {
    switch (payload?.reason) {
      case "not_owned":
        return { status: "not_owned" };
      case "price_out_of_bounds":
        return {
          status: "out_of_bounds",
          min: payload.min ?? 0,
          max: payload.max ?? 0,
          reference: payload.reference ?? 0,
        };
      case "too_many_listings":
        return { status: "too_many", max: payload.max ?? 10 };
      case "invalid_price":
        return { status: "error", message: "Indique un prix entier en Pixels." };
      default:
        return { status: "error", message: "Mise en vente impossible. Réessaie dans un instant." };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  revalidatePath("/collection");
  revalidatePath(`/card/${cardId}`);
  await evaluateFrames(session.user.id);

  return { status: "ok", id: Number(payload.id), price: payload.price ?? price };
}

export type BuyListingResult =
  | { status: "ok"; pixels: number; price: number; fee: number; cardId: string; holo: boolean }
  | { status: "insufficient"; pixels: number; price: number }
  | { status: "own" }
  | { status: "unavailable" }
  | { status: "expired" }
  | { status: "error"; message: string };

/** Achat atomique : débit, crédit vendeur, transfert et transactions en base. */
export async function buyListing(listingId: number): Promise<BuyListingResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("buy_listing", {
    p_listing_id: listingId,
  });

  if (error) {
    console.error("buy_listing", error);
    return { status: "error", message: "Achat impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    reason?: string;
    pixels?: number;
    price?: number;
    fee?: number;
    card_id?: string;
    holo?: boolean;
  } | null;

  if (!payload?.ok) {
    switch (payload?.reason) {
      case "insufficient_pixels":
        return {
          status: "insufficient",
          pixels: payload.pixels ?? 0,
          price: payload.price ?? 0,
        };
      case "own_listing":
        return { status: "own" };
      case "unavailable":
        return { status: "unavailable" };
      case "expired":
        return { status: "expired" };
      default:
        return { status: "error", message: "Achat impossible. Réessaie dans un instant." };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  revalidatePath("/collection");
  if (payload.card_id) revalidatePath(`/card/${payload.card_id}`);
  await evaluateFrames(session.user.id);

  return {
    status: "ok",
    pixels: payload.pixels ?? 0,
    price: payload.price ?? 0,
    fee: payload.fee ?? 0,
    cardId: payload.card_id ?? "",
    holo: Boolean(payload.holo),
  };
}

export type CardSalesResult =
  | { status: "ok"; sales: CardSaleEntry[]; total: number }
  | { status: "error"; message: string };

/** Lot suivant de l'historique des ventes d'une carte (12 par appel). */
export async function loadCardSales(cardId: string, offset: number): Promise<CardSalesResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  if (!getCard(cardId)) return { status: "error", message: "Carte introuvable." };

  const start = Math.max(0, Math.floor(offset));
  const page = await getCardSalesHistory(session.supabase, cardId, 12, start);

  return { status: "ok", sales: page.sales, total: page.total };
}

export type UniverseTile = { card: Card; owned: boolean };

export type UniverseCardsResult =
  | { status: "ok"; tiles: UniverseTile[] }
  | { status: "error"; message: string };

/**
 * Lot suivant des personnages de la même franchise (six par appel).
 *
 * La possession est vérifiée côté serveur à chaque lot : le navigateur ne
 * décide jamais quelle tuile s'affiche en couleur.
 */
export async function loadUniverseCards(
  cardId: string,
  offset: number,
): Promise<UniverseCardsResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const card = getCard(cardId);
  if (!card) return { status: "error", message: "Carte introuvable." };

  const others = CARDS.filter(
    (other) => other.universe === card.universe && other.id !== card.id,
  );
  const start = Math.max(0, Math.min(Math.floor(offset), others.length));
  const batch = others.slice(start, start + 6);

  const owned = await getOwnedCardIds(
    session.supabase,
    session.user.id,
    batch.map((other) => other.id),
  );

  return {
    status: "ok",
    tiles: batch.map((other) => ({ card: other, owned: owned.has(other.id) })),
  };
}

export type WishlistResult =
  | { status: "ok"; wished: boolean }
  | { status: "error"; message: string };

/** Ajoute ou retire une carte de la liste d'envies du joueur connecté. */
export async function toggleWishlist(cardId: string): Promise<WishlistResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const current = await session.supabase
    .from("wishlist")
    .select("card_id")
    .eq("user_id", session.user.id)
    .eq("card_id", cardId)
    .maybeSingle();

  if (current.error) {
    console.error("wishlist_read", current.error);
    return { status: "error", message: "Liste d'envies indisponible. Réessaie dans un instant." };
  }

  if (current.data) {
    const { error } = await session.supabase
      .from("wishlist")
      .delete()
      .eq("user_id", session.user.id)
      .eq("card_id", cardId);

    if (error) {
      console.error("wishlist_delete", error);
      return { status: "error", message: "Impossible de retirer cette carte. Réessaie dans un instant." };
    }
  } else {
    const { error } = await session.supabase
      .from("wishlist")
      .insert({ user_id: session.user.id, card_id: cardId });

    if (error) {
      // Le plafond de 200 envies est posé par le trigger `wishlist_limit` :
      // le message est le seul endroit où le joueur l'apprend.
      if (error.message.includes("wishlist_full")) {
        return {
          status: "error",
          message: `Ta liste d'envies est pleine (${WISHLIST_LIMIT} cartes) : retire-en une pour en ajouter une autre.`,
        };
      }
      console.error("wishlist_insert", error);
      return { status: "error", message: "Impossible d'ajouter cette carte. Réessaie dans un instant." };
    }
  }

  revalidatePath(`/card/${cardId}`);
  revalidatePath("/envies");
  return { status: "ok", wished: !current.data };
}

export type WishlistAlertResult =
  | { status: "ok"; maxPrice: number | null }
  | { status: "error"; message: string };

/**
 * Règle le seuil d'alerte d'une envie (« préviens-moi sous ◆ X »).
 * `null` retire le seuil : toutes les annonces alertent.
 */
export async function setWishlistAlert(
  cardId: string,
  maxPrice: number | null,
): Promise<WishlistAlertResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  if (maxPrice !== null && (!Number.isInteger(maxPrice) || maxPrice < 1)) {
    return { status: "error", message: "Indique un prix entier en Pixels." };
  }

  const { data, error } = await session.supabase.rpc("set_wishlist_alert", {
    p_card_id: cardId,
    p_max_price: maxPrice,
  });

  if (error) {
    console.error("set_wishlist_alert", error);
    return { status: "error", message: "Seuil impossible à enregistrer. Réessaie dans un instant." };
  }

  const payload = data as { ok: boolean; reason?: string; max_price?: number | null } | null;

  if (!payload?.ok) {
    if (payload?.reason === "not_wishlisted") {
      return { status: "error", message: "Cette carte n'est plus dans tes envies." };
    }
    return { status: "error", message: "Seuil impossible à enregistrer. Réessaie dans un instant." };
  }

  revalidatePath("/envies");
  return { status: "ok", maxPrice: payload.max_price ?? null };
}

export type CancelListingResult =
  | { status: "ok"; cardId: string }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/** Annule une annonce active et rend la copie à la collection. */
export async function cancelListing(listingId: number): Promise<CancelListingResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("cancel_listing", {
    p_listing_id: listingId,
  });

  if (error) {
    console.error("cancel_listing", error);
    return { status: "error", message: "Annulation impossible. Réessaie dans un instant." };
  }

  const payload = data as { ok: boolean; reason?: string; card_id?: string } | null;

  if (!payload?.ok) {
    if (payload?.reason === "unavailable") return { status: "unavailable" };
    return { status: "error", message: "Annulation impossible. Réessaie dans un instant." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  revalidatePath("/collection");
  if (payload.card_id) revalidatePath(`/card/${payload.card_id}`);

  return { status: "ok", cardId: payload.card_id ?? "" };
}

/** Marque toutes les notifications du joueur comme lues (bouton de la page). */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const { error } = await session.supabase.rpc("mark_notifications_read", { p_ids: null });
  if (error) {
    console.error("mark_notifications_read", error);
    return;
  }

  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export type UpdateListingPriceResult =
  | { status: "ok"; price: number; sold: boolean }
  | { status: "out_of_bounds"; min: number; max: number; reference: number }
  | { status: "expired" }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/**
 * Change le prix d'une annonce active. Les bornes sont celles de la mise en
 * vente ; si un ordre d'achat attend et que le nouveau prix y entre, la vente
 * part dans la même transaction — d'où `sold` dans le résultat.
 */
export async function updateListingPrice(
  listingId: number,
  price: number,
): Promise<UpdateListingPriceResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  if (!Number.isInteger(price) || price < 1) {
    return { status: "error", message: "Indique un prix entier en Pixels." };
  }

  const { data, error } = await session.supabase.rpc("update_listing_price", {
    p_listing_id: listingId,
    p_price: price,
  });

  if (error) {
    console.error("update_listing_price", error);
    return { status: "error", message: "Changement de prix impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    price?: number;
    card_id?: string;
    min?: number;
    max?: number;
    reference?: number;
    sold?: boolean;
    reason?: string;
  } | null;

  if (!payload?.ok) {
    switch (payload?.reason) {
      case "unavailable":
        return { status: "unavailable" };
      case "expired":
        return { status: "expired" };
      case "price_out_of_bounds":
        return {
          status: "out_of_bounds",
          min: payload.min ?? 0,
          max: payload.max ?? 0,
          reference: payload.reference ?? 0,
        };
      default:
        return { status: "error", message: "Changement de prix impossible. Réessaie dans un instant." };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  revalidatePath("/collection");
  if (payload.card_id) revalidatePath(`/card/${payload.card_id}`);
  if (payload.sold) await evaluateFrames(session.user.id);

  return { status: "ok", price: payload.price ?? price, sold: Boolean(payload.sold) };
}

export type CreateBuyOrderResult =
  | { status: "ok"; id: number; filled: boolean; spent: number | null; max: number; pixels: number }
  | { status: "insufficient"; pixels: number; price: number }
  | { status: "out_of_bounds"; min: number; max: number; reference: number }
  | { status: "too_many"; max: number }
  | { status: "error"; message: string };

/**
 * Pose un ordre d'achat : le prix maximum est réservé sur le solde, puis le
 * moteur d'appariement tente immédiatement de le servir avec les annonces en
 * vente. Bornes, solde, plafond d'ordres et exécution sont validés en base.
 */
export async function createBuyOrder(
  cardId: string,
  holo: boolean,
  maxPrice: number,
): Promise<CreateBuyOrderResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  if (!Number.isInteger(maxPrice) || maxPrice < 1) {
    return { status: "error", message: "Indique un prix entier en Pixels." };
  }

  const { data, error } = await session.supabase.rpc("create_buy_order", {
    p_card_id: cardId,
    p_holo: holo,
    p_max_price: maxPrice,
  });

  if (error) {
    console.error("create_buy_order", error);
    if (error.message.includes("rate_limited")) {
      return {
        status: "error",
        message: "Trop d'actions au marché en peu de temps : réessaie dans quelques minutes.",
      };
    }
    if (error.message.includes("card_retired")) {
      return { status: "error", message: "Cette carte n'est plus échangeable au marché." };
    }
    return { status: "error", message: "Ordre d'achat impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    id?: number;
    status?: string;
    max?: number;
    min?: number;
    reference?: number;
    spent?: number | null;
    pixels?: number;
    price?: number;
    reason?: string;
  } | null;

  if (!payload?.ok) {
    switch (payload?.reason) {
      case "insufficient_pixels":
        return {
          status: "insufficient",
          pixels: payload.pixels ?? 0,
          price: payload.price ?? maxPrice,
        };
      case "price_out_of_bounds":
        return {
          status: "out_of_bounds",
          min: payload.min ?? 0,
          max: payload.max ?? 0,
          reference: payload.reference ?? 0,
        };
      case "too_many_orders":
        return { status: "too_many", max: payload.max ?? 20 };
      case "invalid_price":
        return { status: "error", message: "Indique un prix entier en Pixels." };
      case "unknown_card":
        return { status: "error", message: "Cette carte n'est plus disponible sur le marché." };
      default:
        return { status: "error", message: "Ordre d'achat impossible. Réessaie dans un instant." };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  revalidatePath("/collection");
  revalidatePath(`/card/${cardId}`);
  if (payload.status === "filled") await evaluateFrames(session.user.id);

  return {
    status: "ok",
    id: Number(payload.id),
    filled: payload.status === "filled",
    spent: payload.spent == null ? null : Number(payload.spent),
    max: payload.max ?? maxPrice,
    pixels: payload.pixels ?? 0,
  };
}

export type CancelBuyOrderResult =
  | { status: "ok"; cardId: string; refund: number; pixels: number }
  | { status: "unavailable" }
  | { status: "error"; message: string };

/** Annule un ordre actif et rend la réservation en Pixels. */
export async function cancelBuyOrder(orderId: number): Promise<CancelBuyOrderResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("cancel_buy_order", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("cancel_buy_order", error);
    return { status: "error", message: "Annulation impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    reason?: string;
    card_id?: string;
    refund?: number;
    pixels?: number;
  } | null;

  if (!payload?.ok) {
    if (payload?.reason === "unavailable") return { status: "unavailable" };
    return { status: "error", message: "Annulation impossible. Réessaie dans un instant." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  if (payload.card_id) revalidatePath(`/card/${payload.card_id}`);

  return {
    status: "ok",
    cardId: payload.card_id ?? "",
    refund: payload.refund ?? 0,
    pixels: payload.pixels ?? 0,
  };
}

export type FeedbackState = { error?: string; message?: string };

/** Envoi d'un avis ou d'un bug depuis `/avis-et-bugs`. Le message est stocké
 *  tel quel, sans lecture publique : il se consulte depuis le dashboard. */
export async function sendFeedback(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const kind = String(formData.get("kind") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const page = String(formData.get("page") ?? "").trim();

  if (kind !== "avis" && kind !== "bug") return { error: "Choisis « avis » ou « bug »." };
  if (message.length < 10) return { error: "Décris ton message en 10 caractères minimum." };
  if (message.length > 2000) return { error: "Message trop long : 2000 caractères maximum." };
  if (page.length > 200) return { error: "Nom de page trop long." };

  const session = await getSession();
  const supabase = session?.supabase ?? (await createClient());

  const { error } = await supabase.from("feedback").insert({
    user_id: session?.user.id ?? null,
    kind,
    message,
    page: page === "" ? null : page,
  });

  if (error) {
    console.error("sendFeedback", error);
    return { error: "L'envoi a échoué. Réessaie dans un instant." };
  }

  // Notification email : le message est déjà enregistré, un échec d'envoi ne
  // doit pas faire croire au joueur que son message est perdu.
  await sendFeedbackEmail({
    kind,
    message,
    page: page === "" ? null : page,
    sender: session
      ? `${displayName(session.user)}${session.user.email ? ` <${session.user.email}>` : ""}`
      : "Visiteur non connecté",
  });

  return { message: "Message envoyé, merci. Il sera lu rapidement." };
}

export type StyleState = { error?: string; message?: string };

/**
 * Enregistre l'avatar et le cadre.
 *
 * L'évaluation est relancée juste avant : un cadre tout juste débloqué peut
 * être choisi sans attendre. La sélection est résolue côté serveur ; si le
 * cadre demandé n'est plus acquis ou a été désactivé, on retombe sur le
 * meilleur cadre débloqué, jamais sur une erreur. La base revérifie encore la
 * possession de la carte et l'appartenance du cadre au joueur.
 */
export async function saveProfileStyle(_prev: StyleState, formData: FormData): Promise<StyleState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnecte-toi." };

  const avatar = String(formData.get("avatar") ?? "").trim();
  const requested = String(formData.get("frame") ?? "").trim();

  const evaluation = await evaluateFrames(session.user.id);
  const stats = evaluation.stats ?? (await fetchFrameStats(session.supabase, session.user.id));
  const unlockedIds = stats
    ? [
        ...stats.unlocked.map((entry) => entry.frameId),
        ...evaluation.appliedIds,
      ]
    : [];
  const frame = stats
    ? resolveSelectedFrame(requested, unlockedIds, stats.disabled)
    : requested || "steel";

  const { error } = await session.supabase.rpc("set_profile_style", {
    p_avatar_card_id: avatar === "" ? null : avatar,
    p_frame: frame,
  });

  if (error) {
    if (error.message.includes("card_not_owned")) {
      return { error: "Tu ne possèdes pas cette carte : ouvre des boosters pour la débloquer." };
    }
    console.error("set_profile_style", error);
    return { error: "Impossible d'enregistrer ton profil. Réessaie dans un instant." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/profil");
  return { message: "Profil mis à jour." };
}

export type OpenPackResult =
  | {
      status: "ok";
      pack: string;
      cards: PurchaseCard[];
      stock: number;
      /** Solde bonus restant après l'ouverture. */
      bonus: number;
      anchor: string | null;
      serverNow: number;
    }
  | {
      status: "empty";
      message: string;
      stock: number;
      bonus: number;
      anchor: string | null;
    }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

/** Forme brute renvoyée par `open_pack()` (jsonb en base). */
type OpenPackPayload = {
  ok: boolean;
  reason?: string;
  pack?: string;
  cards?: RpcCard[];
  stock: number;
  anchor: string | null;
  bonus?: number;
  server_now?: string;
};

/** Traduction des refus de `open_pack()` en messages affichables. */
function refusedOpen(error: { message: string }): Exclude<OpenPackResult, { status: "ok" }> {
  // Pack sous le seuil de personnages : le serveur refuse, pas seulement
  // l'interface (un appel direct à la fonction n'y change rien).
  if (error.message.includes("pack_unavailable")) {
    return {
      status: "unavailable",
      message: "Ce booster n'a pas encore assez de personnages pour être ouvert.",
    };
  }
  // Pool vide : le catalogue n'a aucune carte active pour ce genre (ni de
  // repli possible). L'appelant affiche le message tel quel.
  if (error.message.includes("booster_empty")) {
    return {
      status: "unavailable",
      message: "Ce booster est momentanément vide : aucune carte jouable. Réessaie plus tard.",
    };
  }
  if (error.message.includes("concurrent_open")) {
    return { status: "error", message: "Ouverture déjà en cours : recharge la page." };
  }
  console.error("open_pack", error);
  return { status: "error", message: "Impossible d'ouvrir le booster. Réessaie dans un instant." };
}

export type OpenPacksResult =
  | {
      status: "ok";
      pack: string;
      /** Toutes les cartes tirées, dans l'ordre des boosters. */
      cards: PurchaseCard[];
      /** Boosters réellement ouverts (≤ demandé, selon le stock restant). */
      opened: number;
      /** Nombre demandé, après bornage entre 1 et le stock maximum. */
      requested: number;
      stock: number;
      /** Solde bonus restant après l'ouverture. */
      bonus: number;
      anchor: string | null;
      serverNow: number;
    }
  | {
      status: "empty";
      message: string;
      stock: number;
      bonus: number;
      anchor: string | null;
    }
  | { status: "error"; message: string }
  | { status: "unavailable"; message: string };

/**
 * Ouvre plusieurs boosters d'un coup (×1, ×5, ×10).
 *
 * Chaque booster passe par le même `open_pack()` qu'une ouverture simple : le
 * tirage, la consommation du stock et l'écriture en collection restent en base,
 * un par un. Le lot s'arrête proprement quand le stock tombe à zéro — les
 * boosters déjà ouverts sont conservés et renvoyés, jamais annulés.
 *
 * Le nombre est borné ici (1 à `BOOSTER_STOCK_MAX`) : le navigateur ne peut pas
 * demander davantage, et la base refuse de toute façon un stock insuffisant.
 */
export async function openPacks(packId: string, count = 1): Promise<OpenPacksResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const pack = getPack(packId);
  if (!pack) return { status: "error", message: "Ce booster n'existe pas." };

  const requested = Math.min(BOOSTER_STOCK_MAX, Math.max(1, Math.trunc(count) || 1));
  const cards: RpcCard[] = [];
  let opened = 0;
  let stock = 0;
  let bonus = 0;
  let anchor: string | null = null;
  let serverNow = Date.now();

  for (let index = 0; index < requested; index += 1) {
    const { data, error } = await session.supabase.rpc("open_pack", { p_slug: pack.id });

    if (error) {
      // Un refus au premier booster est une vraie erreur ; après quelques
      // ouvertures, on garde celles qui sont déjà en collection.
      if (opened === 0) return refusedOpen(error);
      break;
    }

    const payload = data as OpenPackPayload | null;

    if (!payload?.ok) {
      stock = payload?.stock ?? stock;
      bonus = payload?.bonus ?? bonus;
      anchor = payload?.anchor ?? anchor;

      if (opened === 0) {
        return {
          status: "empty",
          message: "Pas assez de boosters en stock : le prochain arrive dans quelques minutes.",
          stock,
          bonus,
          anchor,
        };
      }
      break;
    }

    opened += 1;
    cards.push(...(payload.cards ?? []));
    stock = payload.stock;
    bonus = payload.bonus ?? bonus;
    anchor = payload.anchor;
    if (payload.server_now) serverNow = new Date(payload.server_now).getTime();
  }

  if (opened === 0) {
    return {
      status: "empty",
      message: "Pas assez de boosters en stock : le prochain arrive dans quelques minutes.",
      stock,
      bonus,
      anchor,
    };
  }

  // Pas de `revalidatePath` ici : chaque revalidation renvoie l'arbre serveur
  // au navigateur, qui le réapplique pendant la révélation. L'overlay était
  // alors démonté au milieu de la déchirure, et le joueur retombait sur la
  // liste des boosters avec un booster consommé. Les pages de jeu sont
  // `force-dynamic` : elles se relisent à la navigation suivante, et la
  // révélation rafraîchit la page à sa fermeture (`router.refresh()`).

  // Les ouvertures sont déjà journalisées et mises en file par la base ;
  // l'évaluation immédiate évite d'attendre la tâche planifiée.
  await evaluateFrames(session.user.id);

  return {
    status: "ok",
    pack: pack.id,
    cards: mapCards(cards),
    opened,
    requested,
    stock,
    bonus,
    anchor,
    serverNow,
  };
}

/** Ouverture d'un seul booster — conserve l'API historique de l'accueil. */
export async function openPack(packId: string): Promise<OpenPackResult> {
  return openPacks(packId, 1);
}
