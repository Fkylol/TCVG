import type { SupabaseClient, User } from "@supabase/supabase-js";
import { displayName } from "@/lib/auth";
import { parseCardProfile, type CardProfile } from "@/lib/card-profile";
import type { Rarity } from "@/lib/cards";
import { toCardVariant, type CardVariant } from "@/lib/variants";

export type { CardProfile };

export type Profile = {
  username: string;
  /** Ancre d'accumulation du stock : dernier instant pris en compte. */
  lastBoosterAt: string | null;
  boostersOpened: number;
  /** Stock enregistré en base (le stock courant se projette avec l'ancre). */
  boosterStock: number;
  /** Boosters bonus (parrainage) : hors plafond, sans expiration. */
  bonusBoosters: number;
  /** Carte utilisée comme avatar, si le joueur en a choisi une. */
  avatarCardId: string | null;
  /** Cadre d'avatar débloqué (voir `lib/profile`). */
  frame: string;
  /** Solde de Pixels. Ne peut jamais être négatif (contrainte en base). */
  pixels: number;
};

export type CollectionRow = {
  cardId: string;
  quantity: number;
  /** Nombre de copies brillantes parmi `quantity`. */
  holoQuantity: number;
  /** Misprint de la première copie portant une variante, sinon `normal`. */
  variant: CardVariant;
  /** Carte retirée du catalogue : la collection la garde, sans son visuel. */
  retired: boolean;
  firstObtainedAt: string;
};

export async function getProfile(supabase: SupabaseClient, user: User): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "username, last_booster_at, boosters_opened, booster_stock, bonus_boosters, avatar_card_id, frame, pixels",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      username: displayName(user),
      lastBoosterAt: null,
      boostersOpened: 0,
      boosterStock: 0,
      bonusBoosters: 0,
      avatarCardId: null,
      frame: "steel",
      pixels: 0,
    };
  }

  return {
    username: data.username ?? displayName(user),
    lastBoosterAt: data.last_booster_at,
    boostersOpened: data.boosters_opened ?? 0,
    boosterStock: data.booster_stock ?? 0,
    bonusBoosters: data.bonus_boosters ?? 0,
    avatarCardId: (data.avatar_card_id as string | null) ?? null,
    frame: (data.frame as string | null) ?? "steel",
    pixels: (data.pixels as number | null) ?? 0,
  };
}

/** Valeurs de repli si `recycle_values` n'est pas encore lisible. */
const RECYCLE_FALLBACK: Record<Rarity, number> = { C: 1, UC: 2, R: 3, SR: 10, UR: 40, L: 150 };

/**
 * Valeur en Pixels d'une carte recyclée, par rareté. La table `recycle_values`
 * fait foi : les montants se règlent en base, sans redéploiement.
 */
export async function getRecycleValues(supabase: SupabaseClient): Promise<Record<Rarity, number>> {
  const { data, error } = await supabase.from("recycle_values").select("rarity, pixels");
  if (error) return { ...RECYCLE_FALLBACK };

  const values: Record<Rarity, number> = { ...RECYCLE_FALLBACK };
  for (const row of data ?? []) {
    const rarity = row.rarity as Rarity;
    const pixels = Number(row.pixels);
    if (rarity in values && Number.isFinite(pixels)) values[rarity] = pixels;
  }
  return values;
}
export type MarketQuote = {
  cardId: string;
  rarity: Rarity;
  holo: boolean;
  /** Prix conseillé, calculé sur les ventes récentes ou la base de rareté. */
  reference: number;
  min: number;
  max: number;
  /** Nombre de ventes prises en compte dans la fenêtre de calcul. */
  sales: number;
};

/** Fourchette de prix d'une carte, normale ou holo, décidée côté base. */
export async function getMarketQuote(
  supabase: SupabaseClient,
  cardId: string,
  holo: boolean,
): Promise<MarketQuote | null> {
  const { data, error } = await supabase.rpc("market_quote", {
    p_card_id: cardId,
    p_holo: holo,
  });
  if (error || !data) {
    console.error("market_quote", error);
    return null;
  }

  const payload = data as {
    card_id: string;
    rarity: Rarity;
    holo: boolean;
    reference: number;
    min: number;
    max: number;
    sales: number;
  };

  return {
    cardId: payload.card_id,
    rarity: payload.rarity,
    holo: payload.holo,
    reference: payload.reference,
    min: payload.min,
    max: payload.max,
    sales: payload.sales,
  };
}

export type MarketListing = {
  id: number;
  cardId: string;
  holo: boolean;
  price: number;
  status: "active" | "sold" | "cancelled";
  createdAt: string;
  soldAt: string | null;
  /** Commission prélevée, figée à la vente. */
  fee: number | null;
  /** Montant net reçu par le vendeur. */
  payout: number | null;
  sellerId: string;
  sellerName: string;
  /** Avatar et cadre du vendeur, pour le rendu groupé du marché. */
  sellerAvatarCardId: string | null;
  sellerFrame: string;
  mine: boolean;
  genres: string[];
  /** Échéance de l'annonce ; `null` pour une annonce sans date de fin. */
  expiresAt: string | null;
  /** Raison de l'annulation, quand l'annonce a été retirée ou a expiré. */
  cancelReason: "seller" | "expired" | "retired" | null;
};

/**
 * Balaie les annonces échues avant toute lecture du marché : la copie revient
 * au vendeur sans attendre une tâche planifiée. Tolérant à l'absence de la
 * migration 023 (le marché s'affiche alors sans expiration).
 */
async function sweepExpiredListings(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("market_expire_listings");
  if (error && error.code !== "PGRST202") {
    console.error("market_expire_listings", error);
  }
}

/** Annonces actives de tous les joueurs + toutes les annonces du joueur. */
export async function getMarketListings(supabase: SupabaseClient): Promise<MarketListing[]> {
  await sweepExpiredListings(supabase);

  const { data, error } = await supabase.rpc("market_listings");
  if (error) {
    console.error("market_listings", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    cardId: row.card_id as string,
    holo: Boolean(row.holo),
    price: Number(row.price_pixels),
    status: row.status as MarketListing["status"],
    createdAt: row.created_at as string,
    soldAt: (row.sold_at as string | null) ?? null,
    fee: row.fee_pixels == null ? null : Number(row.fee_pixels),
    payout: row.seller_payout == null ? null : Number(row.seller_payout),
    sellerId: row.seller_id as string,
    sellerName: (row.seller_username as string | null) ?? "Collectionneur",
    sellerAvatarCardId: (row.seller_avatar_card_id as string | null) ?? null,
    sellerFrame: (row.seller_frame as string | null) ?? "steel",
    mine: Boolean(row.mine),
    genres: (row.genres as string[] | null) ?? [],
    expiresAt: (row.expires_at as string | null) ?? null,
    cancelReason: (row.cancel_reason as MarketListing["cancelReason"]) ?? null,
  }));
}

export type CardPricePoint = {
  /** Jour de la vente, au format `AAAA-MM-JJ`. */
  day: string;
  /** Prix médian des copies normales vendues ce jour-là. */
  median: number;
  volume: number;
};

export type CardSale = { price: number; soldAt: string };

export type CheapestListing = { id: number; price: number; holo: boolean };

export type CardMarketStats = {
  median7: number | null;
  median30: number | null;
  sales30: number;
  /** Annonces actives (normales et holos). */
  offers: number;
  /** Prix de l'annonce la moins chère, toutes variantes confondues. */
  lowest: number | null;
  cheapest: CheapestListing | null;
  /** Prix médian par jour, sur 30 jours glissants. */
  points: CardPricePoint[];
  /** Huit dernières ventes de copies normales. */
  recent: CardSale[];
};

const EMPTY_MARKET_STATS: CardMarketStats = {
  median7: null,
  median30: null,
  sales30: 0,
  offers: 0,
  lowest: null,
  cheapest: null,
  points: [],
  recent: [],
};

/**
 * Cote d'une carte : médianes, ventes, annonces et séries pour le graphique.
 * Les ventes viennent des annonces vendues (`market_listings`), agrégées en
 * base par `card_market_stats()`. Si la migration n'est pas encore appliquée,
 * la fiche affiche un état vide au lieu de casser.
 */
export async function getCardMarketStats(
  supabase: SupabaseClient,
  cardId: string,
): Promise<CardMarketStats> {
  // Une annonce échue ne doit compter ni dans les offres ni dans le meilleur
  // prix : on balaie avant de lire la cote.
  await sweepExpiredListings(supabase);

  const { data, error } = await supabase.rpc("card_market_stats", { p_card_id: cardId });
  if (error || !data) {
    console.error("card_market_stats", error);
    return EMPTY_MARKET_STATS;
  }

  const payload = data as {
    median_7: number | null;
    median_30: number | null;
    sales_30: number;
    offers: number;
    lowest: number | null;
    best_listing: { id: number; price: number; holo: boolean } | null;
    points: { day: string; median: number; volume: number }[] | null;
    recent: { price: number; sold_at: string }[] | null;
  };

  return {
    median7: payload.median_7 ?? null,
    median30: payload.median_30 ?? null,
    sales30: payload.sales_30 ?? 0,
    offers: payload.offers ?? 0,
    lowest: payload.lowest ?? null,
    cheapest: payload.best_listing
      ? {
          id: Number(payload.best_listing.id),
          price: Number(payload.best_listing.price),
          holo: Boolean(payload.best_listing.holo),
        }
      : null,
    points: (payload.points ?? []).map((point) => ({
      day: point.day,
      median: Number(point.median),
      volume: Number(point.volume),
    })),
    recent: (payload.recent ?? []).map((sale) => ({
      price: Number(sale.price),
      soldAt: sale.sold_at,
    })),
  };
}

export type OrderBookSide = {
  /** Ordres actifs sur cette variante. */
  count: number;
  /** Prix maximum proposé, ou `null` si personne n'en cherche. */
  best: number | null;
};

export type CardOrderBook = {
  normal: OrderBookSide;
  holo: OrderBookSide;
  /** Les seuls ordres du joueur, pour lui montrer où il se situe. */
  mine: OrderBookSide;
};

const EMPTY_ORDER_BOOK: CardOrderBook = {
  normal: { count: 0, best: null },
  holo: { count: 0, best: null },
  mine: { count: 0, best: null },
};

/**
 * Carnet agrégé d'une carte : combien d'ordres d'achat et à quel prix maximum.
 * La fonction SQL ne renvoie aucune identité, seulement des chiffres.
 */
export async function getCardOrderBook(
  supabase: SupabaseClient,
  cardId: string,
): Promise<CardOrderBook> {
  const { data, error } = await supabase.rpc("market_orders", { p_card_id: cardId });
  if (error || !data) {
    console.error("market_orders", error);
    return EMPTY_ORDER_BOOK;
  }

  const payload = data as {
    normal?: { count?: number; best?: number | null };
    holo?: { count?: number; best?: number | null };
    mine?: { count?: number; best?: number | null };
  };

  const side = (value?: { count?: number; best?: number | null }): OrderBookSide => ({
    count: Number(value?.count ?? 0),
    best: value?.best == null ? null : Number(value.best),
  });

  return {
    normal: side(payload.normal),
    holo: side(payload.holo),
    mine: side(payload.mine),
  };
}

export type BuyOrder = {
  id: number;
  cardId: string;
  holo: boolean;
  /** Prix maximum accepté. */
  maxPrice: number;
  /** Pixels encore réservés pour cet ordre (0 une fois traité). */
  reserved: number;
  status: "active" | "filled" | "cancelled";
  createdAt: string;
  filledAt: string | null;
  cancelledAt: string | null;
  /** Prix réellement payé quand l'ordre a trouvé preneur. */
  paid: number | null;
};

/** Les ordres d'achat du joueur connecté, du plus récent au plus ancien. */
export async function getMyBuyOrders(supabase: SupabaseClient): Promise<BuyOrder[]> {
  const { data, error } = await supabase.rpc("my_buy_orders");
  if (error) {
    console.error("my_buy_orders", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    cardId: row.card_id as string,
    holo: Boolean(row.holo),
    maxPrice: Number(row.max_price),
    reserved: Number(row.reserved_pixels ?? 0),
    status: row.status as BuyOrder["status"],
    createdAt: row.created_at as string,
    filledAt: (row.filled_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    paid: row.paid == null ? null : Number(row.paid),
  }));
}

export type Notification = {
  id: number;
  kind:
    | "listing_sold"
    | "order_filled"
    | "listing_expired"
    | "wishlist_listing"
    | "swap_offer"
    | "swap_accepted"
    | "swap_declined"
    | "swap_expired"
    | "listing_cancelled"
    | "order_cancelled"
    | "referral_milestone"
    | "referral_pending"
    | "referral_paid"
    | "referral_refused"
    | "frame_unlocked";
  cardId: string | null;
  frameId: string | null;
  /** Texte libre des événements de parrainage (sinon reconstruit par la page). */
  message: string | null;
  /** Net de la vente, prix payé ou ancien prix selon l'événement. */
  amount: number | null;
  readAt: string | null;
  createdAt: string;
};

/** Dernières notifications du joueur, de la plus récente à la plus ancienne. */
export async function getNotifications(
  supabase: SupabaseClient,
  limit = 30,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, card_id, frame_id, amount, message, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Migration absente : la page affiche un état vide plutôt que de casser.
    console.error("notifications", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    kind: row.kind as Notification["kind"],
    cardId: (row.card_id as string | null) ?? null,
    frameId: (row.frame_id as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    amount: row.amount == null ? null : Number(row.amount),
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

/** Nombre de notifications non lues, pour la cloche du header. */
export async function getUnreadNotificationCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    if (error.code !== "PGRST205" && error.code !== "42P01") {
      console.error("notifications_count", error);
    }
    return 0;
  }

  return count ?? 0;
}

/**
 * Annonce de mise à jour des raretés, lue dans `game_config.rarity_update`.
 *
 * La clé n'est écrite que par `npm run rarity:apply`, et effacée par
 * `npm run rarity:rollback`. Elle est ignorée au-delà de sept jours : le
 * bandeau disparaît seul, sans tâche planifiée.
 */
export type RarityUpdate = { appliedAt: string; href: string; changed: number };

export async function getRarityUpdate(
  supabase: SupabaseClient,
  now = Date.now(),
): Promise<RarityUpdate | null> {
  const { data, error } = await supabase
    .from("game_config")
    .select("value")
    .eq("key", "rarity_update")
    .maybeSingle();

  if (error || !data?.value) return null;

  const value = data.value as { applied_at?: string; href?: string; changed?: number } | null;
  if (!value?.applied_at) return null;

  const appliedAt = new Date(value.applied_at).getTime();
  if (!Number.isFinite(appliedAt)) return null;

  const window = 7 * 24 * 60 * 60 * 1000;
  if (now - appliedAt > window) return null;

  return {
    appliedAt: value.applied_at,
    href: value.href ?? "/raretes",
    changed: Number(value.changed ?? 0),
  };
}

export type CardSaleEntry = { price: number; holo: boolean; soldAt: string };

export type CardSalesPage = {
  sales: CardSaleEntry[];
  /** Nombre total de ventes de la carte, pour savoir s'il reste des pages. */
  total: number;
};

/**
 * Historique complet des ventes d'une carte, du plus récent au plus ancien.
 * `trades` est immuable : c'est la source de vérité de la cote.
 */
export async function getCardSalesHistory(
  supabase: SupabaseClient,
  cardId: string,
  limit = 20,
  offset = 0,
): Promise<CardSalesPage> {
  const { data, error } = await supabase.rpc("card_sales_history", {
    p_card_id: cardId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    console.error("card_sales_history", error);
    return { sales: [], total: 0 };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    sales: rows.map((row) => ({
      price: Number(row.price),
      holo: Boolean(row.holo),
      soldAt: row.sold_at as string,
    })),
    total: rows.length > 0 ? Number(rows[0].total ?? rows.length) : 0,
  };
}

export type MarketTopCard = {
  cardId: string;
  count: number;
  volume: number;
  lowest: number;
  highest: number;
};

export type MarketOverview = {
  trades24h: number;
  volume24h: number;
  /** Commission détruite sur 24 h (puits à Pixels). */
  fees24h: number;
  trades7d: number;
  volume7d: number;
  /** Annonces actives non échues. */
  listings: number;
  orders: number;
  topCards: MarketTopCard[];
};

const EMPTY_OVERVIEW: MarketOverview = {
  trades24h: 0,
  volume24h: 0,
  fees24h: 0,
  trades7d: 0,
  volume7d: 0,
  listings: 0,
  orders: 0,
  topCards: [],
};

/** Volumes et activité du marché, agrégés en base (aucune identité exposée). */
export async function getMarketOverview(supabase: SupabaseClient): Promise<MarketOverview> {
  const { data, error } = await supabase.rpc("market_overview");
  if (error || !data) {
    console.error("market_overview", error);
    return EMPTY_OVERVIEW;
  }

  const payload = data as {
    trades_24h?: number;
    volume_24h?: number;
    fees_24h?: number;
    trades_7d?: number;
    volume_7d?: number;
    listings?: number;
    orders?: number;
    top_cards?: {
      card_id: string;
      count: number;
      volume: number;
      lowest: number;
      highest: number;
    }[];
  };

  return {
    trades24h: Number(payload.trades_24h ?? 0),
    volume24h: Number(payload.volume_24h ?? 0),
    fees24h: Number(payload.fees_24h ?? 0),
    trades7d: Number(payload.trades_7d ?? 0),
    volume7d: Number(payload.volume_7d ?? 0),
    listings: Number(payload.listings ?? 0),
    orders: Number(payload.orders ?? 0),
    topCards: (payload.top_cards ?? []).map((row) => ({
      cardId: row.card_id,
      count: Number(row.count),
      volume: Number(row.volume),
      lowest: Number(row.lowest),
      highest: Number(row.highest),
    })),
  };
}

export type BoosterChance = {
  slug: string;
  name: string;
  /** Cartes par paquet. */
  cards: number;
  /** Probabilité d'obtenir la carte dans un paquet (0 à 1). */
  chance: number;
};

/** Chance réelle d'obtenir une carte, booster par booster. */
export async function getCardBoosterChances(
  supabase: SupabaseClient,
  cardId: string,
): Promise<BoosterChance[]> {
  const { data, error } = await supabase.rpc("card_booster_chances", { p_card_id: cardId });
  if (error || !data) {
    console.error("card_booster_chances", error);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => ({
      slug: row.slug as string,
      name: row.name as string,
      cards: Number(row.cards),
      chance: Number(row.chance),
    }))
    .sort((a, b) => b.chance - a.chance);
}

/** La carte est-elle dans la liste d'envies du joueur ? */
export async function isCardWishlisted(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("wishlist")
    .select("card_id")
    .eq("user_id", userId)
    .eq("card_id", cardId)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

/**
 * Fiche éditoriale d'une carte, telle que la base la livre : `null` tant que
 * le joueur ne possède pas la carte. La fonction `card_profile()` ne renvoie
 * alors que `{ unlocked: false }` — aucun texte ne quitte le serveur.
 */
export async function getCardProfile(
  supabase: SupabaseClient,
  cardId: string,
): Promise<CardProfile | null> {
  const { data, error } = await supabase.rpc("card_profile", { p_card_id: cardId });

  if (error) {
    console.error("card_profile", error);
    return null;
  }

  return parseCardProfile(data);
}

/**
 * Nombre de joueurs qui ont la carte en envie. `null` sous trois envies : le
 * chiffre reste masqué pour ne pas exposer un intérêt individuel.
 */
export async function getCardWishlistCount(
  supabase: SupabaseClient,
  cardId: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("card_wishlist_count", { p_card_id: cardId });
  if (error) return null;
  return typeof data === "number" ? data : null;
}

/**
 * La carte est-elle encore au catalogue ?
 *
 * `null` quand la base ne connaît pas encore la carte (catalogue local en
 * avance sur le miroir `cards`) : on ne transforme pas une synchro en retard
 * en 404.
 */
export async function isCardActive(
  supabase: SupabaseClient,
  cardId: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("cards")
    .select("active")
    .eq("id", cardId)
    .maybeSingle();

  if (error) {
    console.error("cards_active", error);
    return null;
  }

  if (!data) return null;
  return Boolean(data.active);
}

export type WishlistRow = {
  cardId: string;
  createdAt: string;
  /** Le joueur possède déjà la carte (elle reste dans les envies). */
  quantity: number;
  /** Seuil d'alerte en Pixels ; `null` = toutes les annonces. */
  maxPrice: number | null;
};

/** Envies du joueur, de la plus récente à la plus ancienne. */
export async function getWishlist(
  supabase: SupabaseClient,
  userId: string,
): Promise<WishlistRow[]> {
  const { data, error } = await supabase
    .from("wishlist")
    .select("card_id, created_at, max_price")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("wishlist_list", error);
    return [];
  }

  const rows = (data ?? []) as {
    card_id: string;
    created_at: string;
    max_price: number | null;
  }[];
  if (rows.length === 0) return [];

  const { data: owned } = await supabase
    .from("collection")
    .select("card_id, quantity")
    .eq("user_id", userId)
    .in(
      "card_id",
      rows.map((row) => row.card_id),
    );

  const quantities = new Map(
    ((owned ?? []) as { card_id: string; quantity: number }[]).map((row) => [
      row.card_id,
      row.quantity,
    ]),
  );

  return rows.map((row) => ({
    cardId: row.card_id,
    createdAt: row.created_at,
    quantity: quantities.get(row.card_id) ?? 0,
    maxPrice: row.max_price == null ? null : Number(row.max_price),
  }));
}

/** Identifiants des cartes de `cardIds` déjà possédées par le joueur. */
export async function getOwnedCardIds(
  supabase: SupabaseClient,
  userId: string,
  cardIds: string[],
): Promise<Set<string>> {
  if (cardIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("collection")
    .select("card_id")
    .eq("user_id", userId)
    .in("card_id", cardIds);

  if (error) return new Set();
  return new Set((data ?? []).map((row) => row.card_id as string));
}

/** Genres du catalogue auxquels appartient une carte. */
export async function getCardGenres(
  supabase: SupabaseClient,
  cardId: string,
): Promise<GenreOption[]> {
  const { data, error } = await supabase
    .from("card_genres")
    .select("genres(slug, name)")
    .eq("card_id", cardId);

  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const genre = (row as { genres: GenreOption | GenreOption[] | null }).genres;
      return Array.isArray(genre) ? genre[0] : genre;
    })
    .filter((genre): genre is GenreOption => Boolean(genre));
}

export type GenreOption = { slug: string; name: string };

export async function getGenres(supabase: SupabaseClient): Promise<GenreOption[]> {
  const { data, error } = await supabase.from("genres").select("slug, name").order("name");
  if (error) {
    console.error("genres", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
  }));
}

export type DailyBonus = {
  /** Faux si le délai de 24 h n'est pas écoulé. */
  claimed: boolean;
  amount: number;
  /** Date du prochain bonus possible. */
  nextAt: string | null;
};

/**
 * Réclame le bonus de connexion quotidien (10 Pixels par 24 h).
 *
 * Le serveur décide : l'appel est sans effet si le délai n'est pas écoulé,
 * et deux requêtes simultanées ne peuvent pas créditer deux fois (verrou de
 * ligne dans `claim_daily_bonus`). Retourne `null` si la fonction n'est pas
 * encore déployée en base, pour ne pas casser l'affichage du solde.
 */
export async function claimDailyBonus(supabase: SupabaseClient): Promise<DailyBonus | null> {
  const { data, error } = await supabase.rpc("claim_daily_bonus");
  if (error || !data) return null;

  const result = data as { ok: boolean; amount?: number; next_at?: string | null };
  return {
    claimed: result.ok,
    amount: result.amount ?? 0,
    nextAt: result.next_at ?? null,
  };
}

export type BoosterState = {
  profile: Profile;
  /** Heure serveur : sert de référence au compte à rebours côté client. */
  serverNow: number;
};

/** État de la station de boosters, horloge serveur incluse. */
export async function getBoosterState(supabase: SupabaseClient, user: User): Promise<BoosterState> {
  const profile = await getProfile(supabase, user);
  return { profile, serverNow: Date.now() };
}

export async function getCollection(supabase: SupabaseClient, userId: string): Promise<CollectionRow[]> {
  const { data, error } = await supabase
    .from("collection")
    .select("card_id, quantity, holo_quantity, variant, first_obtained_at")
    .eq("user_id", userId)
    .order("first_obtained_at", { ascending: false });

  if (error) throw new Error(`Lecture de la collection impossible : ${error.message}`);

  const rows = (data ?? []) as {
    card_id: string;
    quantity: number;
    holo_quantity: number | null;
    variant: string | null;
    first_obtained_at: string;
  }[];

  // Le statut de retrait vit dans `cards`, pas dans la collection : une carte
  // retirée garde ses exemplaires, mais son visuel n'est plus servi. En cas
  // d'erreur, on considère les cartes actives : mieux vaut une image de trop
  // qu'une collection vidée par un incident.
  const retired = new Set<string>();
  const ids = rows.map((row) => row.card_id);
  if (ids.length > 0) {
    const { data: status, error: statusError } = await supabase
      .from("cards")
      .select("id, active")
      .in("id", ids);

    if (statusError) {
      console.error("cards_active", statusError);
    } else {
      for (const card of (status ?? []) as { id: string; active: boolean }[]) {
        if (card.active === false) retired.add(card.id);
      }
    }
  }

  return rows.map((row) => ({
    cardId: row.card_id,
    quantity: row.quantity,
    holoQuantity: row.holo_quantity ?? 0,
    variant: toCardVariant(row.variant),
    retired: retired.has(row.card_id),
    firstObtainedAt: row.first_obtained_at,
  }));
}

/**
 * Nombre de joueurs possédant chaque carte, compté en base par `card_owners()`.
 * En cas d'erreur (migration absente), on renvoie un objet vide : le verso
 * affiche un tiret plutôt que de casser la page.
 */
export async function getCardOwners(supabase: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("card_owners");

  if (error) {
    console.error("card_owners", error);
    return {};
  }

  const owners: Record<string, number> = {};
  for (const row of (data ?? []) as { card_id: string; owners: number }[]) {
    owners[row.card_id] = row.owners;
  }
  return owners;
}

export type PackStats = {
  /** Personnages actifs du pack : c'est le pool réellement utilisé au tirage. */
  poolSize: number;
  /** Seuil sous lequel le pack est « Bientôt disponible ». */
  minPoolSize: number;
  available: boolean;
  cardsCount: number;
  /** Chance d'obtenir au moins une carte de chaque rareté, calculée en base. */
  chances: Record<string, number>;
};

/**
 * Statistiques des 10 packs, calculées par `pack_stats()` en base : pool actif
 * réel, seuil de disponibilité et chances par rareté issues de la logique de
 * tirage. L'interface n'estime jamais ces valeurs elle-même.
 */
export async function getPackStats(
  supabase: SupabaseClient,
): Promise<Record<string, PackStats>> {
  const { data, error } = await supabase.rpc("pack_stats");

  if (error) {
    console.error("pack_stats", error);
    return {};
  }

  const stats: Record<string, PackStats> = {};
  for (const row of (data ?? []) as {
    slug: string;
    cards_count: number;
    pool_size: number;
    min_pool_size: number;
    available: boolean;
    chances: Record<string, number>;
  }[]) {
    stats[row.slug] = {
      poolSize: row.pool_size,
      minPoolSize: row.min_pool_size,
      available: row.available,
      cardsCount: row.cards_count,
      chances: row.chances ?? {},
    };
  }

  return stats;
}
