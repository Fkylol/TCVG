import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase n'est pas configuré. Copie .env.example vers .env.local et renseigne " +
        "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir README).",
    );
  }

  return { url, anonKey };
}

/** Client Supabase lié aux cookies de la requête (Server Components, Actions, Route Handlers). */
export async function createClient() {
  // `cookies()` d'abord : la route devient dynamique, et la vérification des
  // variables d'environnement n'intervient qu'à l'exécution (pas au build).
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Écriture impossible depuis un Server Component : le refresh de session
          // est géré par les Server Actions et les Route Handlers.
        }
      },
    },
  });
}
