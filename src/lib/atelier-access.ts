import { notFound, redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSession, type Session } from "@/lib/auth";

/** La base décide des accès à partir d'identifiants de compte, jamais du pseudo. */
export async function canUseAtelier(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_atelier");
  return !error && data === true;
}

/** En développement l'atelier utilise la connexion de maintenance locale. */
export async function atelierSession(): Promise<Session | null> {
  if (process.env.NODE_ENV !== "production") return null;

  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await canUseAtelier(session.supabase))) notFound();
  return session;
}

export const ATELIER_LOCAL = process.env.NODE_ENV !== "production";
