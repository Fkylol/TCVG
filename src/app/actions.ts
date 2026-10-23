"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { displayName, getSession } from "@/lib/auth";
import { sendFeedbackEmail } from "@/lib/email";
import { BOOSTER_STOCK_MAX, rollBooster } from "@/lib/game";
import type { Card } from "@/lib/cards";

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
      scopes: "identify email",
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
};

export type PurchaseResult =
  | { status: "ok"; cards: PurchaseCard[]; pixels: number }
  | { status: "insufficient"; pixels: number; price: number }
  | { status: "error"; message: string };

/**
 * Achat d'un booster en Pixels. Le tirage, le débit et la mise en collection
 * sont faits par `buy_booster()` en base : le client ne fournit qu'un slug.
 */
export async function buyBooster(slug: string): Promise<PurchaseResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { data, error } = await session.supabase.rpc("buy_booster", { p_slug: slug });

  if (error) {
    if (error.message.includes("genre_too_small")) {
      return { status: "error", message: "Ce booster n'a pas encore assez de cartes." };
    }
    if (error.message.includes("unknown_booster")) {
      return { status: "error", message: "Ce booster n'est plus disponible." };
    }
    console.error("buy_booster", error);
    return { status: "error", message: "Achat impossible. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    cards?: PurchaseCard[];
    pixels: number;
    price?: number;
    reason?: string;
  } | null;

  if (!payload?.ok) {
    if (payload?.reason === "insufficient_pixels") {
      return { status: "insufficient", pixels: payload.pixels, price: payload.price ?? 0 };
    }
    return { status: "error", message: "Achat impossible. Réessaie dans un instant." };
  }

  revalidatePath("/boosters");
  revalidatePath("/collection");

  return { status: "ok", cards: payload.cards ?? [], pixels: payload.pixels };
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
  | { status: "keep_one" }
  | { status: "not_owned" }
  | { status: "out_of_bounds"; min: number; max: number; reference: number }
  | { status: "too_many"; max: number }
  | { status: "error"; message: string };

/** Met une copie en vente. Prix, garde d'exemplaire et limite d'annonces sont
 *  validés par `create_listing()` en base. */
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
      case "keep_one":
        return { status: "keep_one" };
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

  return { status: "ok", id: Number(payload.id), price: payload.price ?? price };
}

export type BuyListingResult =
  | { status: "ok"; pixels: number; price: number; fee: number; cardId: string; holo: boolean }
  | { status: "insufficient"; pixels: number; price: number }
  | { status: "own" }
  | { status: "unavailable" }
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
      default:
        return { status: "error", message: "Achat impossible. Réessaie dans un instant." };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/marche");
  revalidatePath("/collection");
  if (payload.card_id) revalidatePath(`/card/${payload.card_id}`);

  return {
    status: "ok",
    pixels: payload.pixels ?? 0,
    price: payload.price ?? 0,
    fee: payload.fee ?? 0,
    cardId: payload.card_id ?? "",
    holo: Boolean(payload.holo),
  };
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

/** Enregistre l'avatar et le cadre. La validation (carte possédée, cadre
 *  débloqué) est faite par `set_profile_style()` côté base. */
export async function saveProfileStyle(_prev: StyleState, formData: FormData): Promise<StyleState> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnecte-toi." };

  const avatar = String(formData.get("avatar") ?? "").trim();
  const frame = String(formData.get("frame") ?? "steel").trim();

  const { error } = await session.supabase.rpc("set_profile_style", {
    p_avatar_card_id: avatar === "" ? null : avatar,
    p_frame: frame,
  });

  if (error) {
    if (error.message.includes("card_not_owned")) {
      return { error: "Tu ne possèdes pas cette carte : ouvre des boosters pour la débloquer." };
    }
    if (error.message.includes("frame_locked")) {
      return { error: "Ce cadre n'est pas encore débloqué." };
    }
    console.error("set_profile_style", error);
    return { error: "Impossible d'enregistrer ton profil. Réessaie dans un instant." };
  }

  revalidatePath("/", "layout");
  return { message: "Profil mis à jour." };
}

export type BoosterResult =
  | {
      status: "ok";
      cards: Card[];
      newIds: string[];
      opened: number;
      stock: number;
      anchor: string | null;
    }
  | { status: "empty"; message: string; stock: number; anchor: string | null }
  | { status: "error"; message: string };

/** Ouvre `count` boosters du stock (1 à 10), soit `count * 3` cartes. */
export async function openBoosters(count = 1): Promise<BoosterResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const wanted = Math.min(Math.max(1, Math.floor(count)), BOOSTER_STOCK_MAX);
  const cards = Array.from({ length: wanted }, () => rollBooster()).flat();

  const { data, error } = await session.supabase.rpc("open_boosters", {
    p_cards: cards.map((card) => card.id),
    p_count: wanted,
  });

  if (error) {
    console.error("open_boosters", error);
    return { status: "error", message: "Impossible d'ouvrir les boosters. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    opened?: number;
    stock: number;
    anchor: string | null;
    new_cards?: string[];
  } | null;

  if (!payload?.ok) {
    return {
      status: "empty",
      message: "Pas assez de boosters en stock.",
      stock: payload?.stock ?? 0,
      anchor: payload?.anchor ?? null,
    };
  }

  revalidatePath("/boosters");
  revalidatePath("/collection");

  return {
    status: "ok",
    cards,
    newIds: payload.new_cards ?? [],
    opened: payload.opened ?? wanted,
    stock: payload.stock,
    anchor: payload.anchor,
  };
}
