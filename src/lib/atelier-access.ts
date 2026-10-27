import { notFound, redirect } from "next/navigation";

import { getSession, type Session } from "@/lib/auth";

/**
 * Comptes autorisés dans l'atelier.
 *
 * L'atelier ne suit pas le rôle d'administration : il est tenu nommément par
 * le propriétaire et les deux responsables du catalogue. Un administrateur du
 * marché n'y entre pas, et ces comptes n'ont pas besoin d'être administrateurs
 * pour y travailler.
 *
 * En minuscules : les pseudos viennent de la base et sont comparés sans tenir
 * compte de la casse.
 */
export const ATELIER_USERNAMES = ["fkyzu", "deathsky74", "asperge"] as const;

/** Vrai quand ce pseudo fait partie des deux comptes de l'atelier. */
export function canUseAtelier(username: string | null | undefined): boolean {
  if (!username) return false;
  return (ATELIER_USERNAMES as readonly string[]).includes(username.trim().toLowerCase());
}

/**
 * Accès à l'atelier.
 *
 * En ligne, l'atelier n'est ouvert qu'aux deux comptes nommés : sans session,
 * on renvoie vers la connexion ; avec une session d'un autre joueur, la page
 * n'existe pas (aucune indication qu'elle existe). La session renvoyée sert
 * aussi à lire les signalements avec ses propres droits.
 *
 * En développement, l'atelier reste l'outil local : pas de compte à ouvrir, et
 * la base est lue par la connexion de maintenance (`.env`). On renvoie alors
 * `null` pour que les lectures prennent cette voie.
 */
export async function atelierSession(): Promise<Session | null> {
  if (process.env.NODE_ENV !== "production") return null;

  const session = await getSession();
  if (!session) redirect("/login");

  const { data, error } = await session.supabase
    .from("profiles")
    .select("username")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !canUseAtelier(data?.username as string | null)) notFound();
  return session;
}

/** Vrai quand l'atelier tourne sur la machine de développement. */
export const ATELIER_LOCAL = process.env.NODE_ENV !== "production";
