import type { SupabaseClient, User } from "@supabase/supabase-js";
import { displayName } from "@/lib/auth";
import { BOOSTER_COOLDOWN_MS } from "@/lib/game";

export type Profile = {
  username: string;
  lastBoosterAt: string | null;
  boostersOpened: number;
};

export type CollectionRow = {
  cardId: string;
  quantity: number;
  firstObtainedAt: string;
};

export async function getProfile(supabase: SupabaseClient, user: User): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, last_booster_at, boosters_opened")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { username: displayName(user), lastBoosterAt: null, boostersOpened: 0 };
  }

  return {
    username: data.username ?? displayName(user),
    lastBoosterAt: data.last_booster_at,
    boostersOpened: data.boosters_opened ?? 0,
  };
}

export type BoosterState = {
  profile: Profile;
  /** Fin du cooldown (ISO), ou null si aucun booster n'a encore été ouvert. */
  nextAt: string | null;
  /** Heure serveur : sert de référence au compte à rebours côté client. */
  serverNow: number;
};

/** État de la station de boosters, horloge serveur incluse. */
export async function getBoosterState(supabase: SupabaseClient, user: User): Promise<BoosterState> {
  const profile = await getProfile(supabase, user);
  const serverNow = Date.now();
  const nextAt = profile.lastBoosterAt
    ? new Date(new Date(profile.lastBoosterAt).getTime() + BOOSTER_COOLDOWN_MS).toISOString()
    : null;

  return { profile, nextAt, serverNow };
}

export async function getCollection(supabase: SupabaseClient, userId: string): Promise<CollectionRow[]> {
  const { data, error } = await supabase
    .from("collection")
    .select("card_id, quantity, first_obtained_at")
    .eq("user_id", userId)
    .order("first_obtained_at", { ascending: false });

  if (error) throw new Error(`Lecture de la collection impossible : ${error.message}`);

  return (data ?? []).map((row) => ({
    cardId: row.card_id as string,
    quantity: row.quantity as number,
    firstObtainedAt: row.first_obtained_at as string,
  }));
}
