"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { currentOrigin } from "@/lib/origin";
import { REFERRAL_CONFIG, REFERRAL_PAGE } from "@/lib/referral/config";

/**
 * « J'ai activé l'A2F, revérifier ».
 *
 * Les jetons Discord ne sont pas conservés : la seule façon de relire
 * `mfa_enabled` est de redemander une connexion Discord (scope `identify`),
 * qui revient sur /auth/confirm. Le joueur ne quitte le site qu'un instant.
 */
export async function recheckDiscordMfa() {
  const { supabase, user } = await requireSession();

  const { data: allowed } = await supabase.rpc("referral_rate_hit", {
    p_key: `mfa:${user.id}`,
    p_limit: REFERRAL_CONFIG.mfaRateLimit.hits,
    p_window_seconds: REFERRAL_CONFIG.mfaRateLimit.windowSeconds,
  });

  if (allowed === false) {
    redirect(`${REFERRAL_PAGE}?mfa=limite`);
  }

  const origin = await currentOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: `${origin ?? ""}/auth/confirm?next=${REFERRAL_PAGE}&mfa=1`,
      scopes: "identify",
    },
  });

  if (error || !data.url) {
    console.error("recheckDiscordMfa", error);
    redirect(`${REFERRAL_PAGE}?mfa=echec`);
  }

  redirect(data.url);
}

/** Filet de sécurité : réévalue le parrainage sans redemander Discord. */
export async function refreshReferralStatus() {
  const { supabase } = await requireSession();
  await supabase.rpc("referral_reevaluate_self");
  revalidatePath(REFERRAL_PAGE);
}

/** Administration : approuver un parrainage « à examiner » (le paie). */
export async function approveReferral(formData: FormData) {
  const { supabase } = await requireSession();
  const id = Number(formData.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return;

  const { error } = await supabase.rpc("referral_admin_decide", {
    p_id: id,
    p_approve: true,
  });
  if (error) console.error("approveReferral", error);

  revalidatePath("/admin/parrainage");
}

/** Administration : refuser un parrainage non payé. */
export async function refuseReferral(formData: FormData) {
  const { supabase } = await requireSession();
  const id = Number(formData.get("id"));
  const reason = String(formData.get("reason") ?? "admin").slice(0, 200);
  if (!Number.isSafeInteger(id) || id <= 0) return;

  const { error } = await supabase.rpc("referral_admin_decide", {
    p_id: id,
    p_approve: false,
    p_reason: reason,
  });
  if (error) console.error("refuseReferral", error);

  revalidatePath("/admin/parrainage");
}
