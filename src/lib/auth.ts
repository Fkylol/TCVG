import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Session = Awaited<ReturnType<typeof getSession>>;

export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { supabase, user };
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export function displayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};

  // `username` pour l'inscription maison ; `user_name` / `full_name` pour les
  // fournisseurs OAuth (Discord, Google…).
  for (const key of ["username", "user_name", "full_name", "name"] as const) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return user.email?.split("@")[0] ?? "Collectionneur";
}
