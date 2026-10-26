"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase du navigateur.
 *
 * Il partage les cookies de session avec le serveur (`@supabase/ssr`) : la
 * même identité, donc les mêmes policies RLS, que les Server Actions. Utilisé
 * pour l'abonnement Realtime et la reprise des messages manqués.
 *
 * Créé une seule fois : plusieurs abonnements Realtime sur le même client
 * partagent la même connexion.
 */
let client: SupabaseClient | null = null;
let attempted = false;

export function getBrowserSupabase(): SupabaseClient | null {
  if (attempted) return client;
  attempted = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  client = createBrowserClient(url, anonKey);
  return client;
}
