import type { SupabaseClient, User } from "@supabase/supabase-js";
import { displayName } from "@/lib/auth";
import type { Rarity } from "@/lib/cards";

export type Profile = {
  username: string;
  /** Ancre d'accumulation du stock : dernier instant pris en compte. */
  lastBoosterAt: string | null;
  boostersOpened: number;
  /** Stock enregistré en base (le stock courant se projette avec l'ancre). */
  boosterStock: number;
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
  firstObtainedAt: string;
};

export async function getProfile(supabase: SupabaseClient, user: User): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "username, last_booster_at, boosters_opened, booster_stock, avatar_card_id, frame, pixels",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return {
      username: displayName(user),
      lastBoosterAt: null,
      boostersOpened: 0,
      boosterStock: 0,
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
    avatarCardId: (data.avatar_card_id as string | null) ?? null,
    frame: (data.frame as string | null) ?? "steel",
    pixels: (data.pixels as number | null) ?? 0,
  };
}

/** Valeurs de repli si `recycle_values` n'est pas encore lisible. */
const RECYCLE_FALLBACK: Record<Rarity, number> = { C: 1, R: 3, SR: 10, UR: 40, L: 150 };

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
  mine: boolean;
  genres: string[];
};

/** Annonces actives de tous les joueurs + toutes les annonces du joueur. */
export async function getMarketListings(supabase: SupabaseClient): Promise<MarketListing[]> {
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
    mine: Boolean(row.mine),
    genres: (row.genres as string[] | null) ?? [],
  }));
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
    .select("card_id, quantity, holo_quantity, first_obtained_at")
    .eq("user_id", userId)
    .order("first_obtained_at", { ascending: false });

  if (error) throw new Error(`Lecture de la collection impossible : ${error.message}`);

  return (data ?? []).map((row) => ({
    cardId: row.card_id as string,
    quantity: row.quantity as number,
    holoQuantity: (row.holo_quantity as number | null) ?? 0,
    firstObtainedAt: row.first_obtained_at as string,
  }));
}

export type BoosterOffer = {
  slug: string;
  name: string;
  pricePixels: number;
  cardsCount: number;
  /** Genre du booster, ou null pour le Mix. */
  genre: string | null;
  /** Cartes pouvant sortir de ce booster. */
  poolSize: number;
  /** Poids par rareté (somme libre : l'affichage calcule les pourcentages). */
  rates: Record<string, number>;
  available: boolean;
  /** Raison du grisé, quand le booster n'est pas achetable. */
  unavailableReason: string | null;
};

/**
 * Catalogue de la boutique : un booster Mix, un par genre assez fourni, et
 * les genres trop petits pour mériter un booster (affichés grisés).
 * Les prix, taux et seuils viennent de la base, jamais du code.
 */
export async function getBoosterCatalog(supabase: SupabaseClient): Promise<BoosterOffer[]> {
  const [typesResult, genresResult, configResult] = await Promise.all([
    supabase
      .from("booster_types")
      .select("slug, name, price_pixels, cards_count, drop_rates, genre_id")
      .eq("active", true),
    supabase.from("genre_card_counts").select("id, slug, name, cards"),
    supabase.from("game_config").select("key, value").in("key", [
      "booster_drop_rates",
      "booster_genre_min_cards",
    ]),
  ]);

  if (typesResult.error || genresResult.error) {
    console.error("getBoosterCatalog", typesResult.error ?? genresResult.error);
    return [];
  }

  const config = new Map(
    (configResult.data ?? []).map((row) => [row.key as string, row.value as unknown]),
  );
  const defaultRates = (config.get("booster_drop_rates") as Record<string, number> | undefined) ?? {};
  const minCards = Number(config.get("booster_genre_min_cards") ?? 20);

  const genres = (genresResult.data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    cards: (row.cards as number | null) ?? 0,
  }));

  const types = typesResult.data ?? [];

  const offers: BoosterOffer[] = [];
  for (const type of types) {
    const genre = genres.find((g) => g.id === type.genre_id) ?? null;
    offers.push({
      slug: type.slug as string,
      name: type.name as string,
      pricePixels: type.price_pixels as number,
      cardsCount: type.cards_count as number,
      genre: genre?.name ?? null,
      poolSize: genre ? genre.cards : genres.reduce((sum, g) => sum + g.cards, 0),
      rates: (type.drop_rates as Record<string, number> | null) ?? defaultRates,
      available: true,
      unavailableReason: null,
    });
  }

  // Genres sans booster : grisés, avec le compte qui manque pour l'ouvrir.
  for (const genre of genres) {
    if (genre.cards >= minCards) continue;
    if (offers.some((offer) => offer.genre === genre.name)) continue;

    offers.push({
      slug: `genre-${genre.slug}`,
      name: `Booster ${genre.name}`,
      pricePixels: 0,
      cardsCount: 5,
      genre: genre.name,
      poolSize: genre.cards,
      rates: {},
      available: false,
      unavailableReason: `${genre.cards} carte${genre.cards > 1 ? "s" : ""} sur ${minCards} requises`,
    });
  }

  return offers.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.genre === null) return -1;
    if (b.genre === null) return 1;
    return b.poolSize - a.poolSize;
  });
}
