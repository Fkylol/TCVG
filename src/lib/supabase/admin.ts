import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase serveur, avec la clé de service : il contourne la RLS.
 *
 * Réservé aux tâches de fond (liaison Discord, notification privée) : jamais
 * importé par un composant client. Sans `SUPABASE_SERVICE_ROLE_KEY`, la
 * fonction renvoie `null` et l'appelant se contente de ne rien envoyer.
 */
export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
