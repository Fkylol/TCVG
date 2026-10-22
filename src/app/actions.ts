"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { rollBooster } from "@/lib/game";
import type { Card } from "@/lib/cards";

export type FormState = { error?: string; message?: string };

const USERNAME_PATTERN = /^[\p{L}0-9_-]{3,20}$/u;

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (lower.includes("already registered") || lower.includes("already been registered"))
    return "Un compte existe déjà avec cet email.";
  if (lower.includes("password should be")) return "Le mot de passe doit faire au moins 8 caractères.";
  if (lower.includes("rate limit")) return "Trop de tentatives, réessaie dans une minute.";
  if (lower.includes("unable to validate email")) return "Adresse email invalide.";
  return message;
}

async function currentOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return undefined;
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Pseudo : 3 à 20 caractères, lettres, chiffres, tiret ou underscore." };
  }
  if (!email.includes("@")) return { error: "Adresse email invalide." };
  if (password.length < 8) return { error: "Le mot de passe doit faire au moins 8 caractères." };

  const supabase = await createClient();
  const origin = await currentOrigin();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });

  if (error) return { error: translateAuthError(error.message) };

  if (!data.session) {
    return {
      message:
        "Compte créé. Vérifie ta boîte mail et clique sur le lien de confirmation, puis connecte-toi.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/boosters");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email et mot de passe requis." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translateAuthError(error.message) };

  revalidatePath("/", "layout");
  redirect("/boosters");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export type BoosterResult =
  | { status: "ok"; cards: Card[]; newIds: string[]; nextAt: string }
  | { status: "cooldown"; message: string; nextAt: string | null }
  | { status: "error"; message: string };

export async function openBooster(): Promise<BoosterResult> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Session expirée : reconnecte-toi." };

  const { supabase } = session;
  const cards = rollBooster();

  const { data, error } = await supabase.rpc("open_booster", {
    p_cards: cards.map((card) => card.id),
  });

  if (error) {
    console.error("open_booster", error);
    return { status: "error", message: "Impossible d'ouvrir le booster. Réessaie dans un instant." };
  }

  const payload = data as {
    ok: boolean;
    next_booster_at: string | null;
    new_cards?: string[];
  } | null;

  if (!payload?.ok) {
    return {
      status: "cooldown",
      message: "Le prochain booster n'est pas encore prêt.",
      nextAt: payload?.next_booster_at ?? null,
    };
  }

  revalidatePath("/boosters");
  revalidatePath("/collection");

  return {
    status: "ok",
    cards,
    newIds: payload.new_cards ?? [],
    nextAt: payload.next_booster_at as string,
  };
}
