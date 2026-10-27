import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, Session, SupabaseClient } from "@supabase/supabase-js";
import { evaluateFrames } from "@/lib/frames";
import { REFERRAL_COOKIE } from "@/lib/referral/config";
import {
  fetchDiscordIdentity,
  recordActivityDay,
  rememberFingerprint,
  storeDiscordMfa,
} from "@/lib/referral/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Retour OAuth Discord (et confirmation d'e-mail historique).
 *
 * En plus d'ouvrir la session, ce passage :
 *   • enregistre les empreintes salées d'IP et d'agent utilisateur ;
 *   • lit `mfa_enabled` avec le scope `identify` et le conserve ;
 *   • marque le jour de connexion (activité pendant l'attente) ;
 *   • crée le parrainage si un cookie d'invitation est présent et que le compte
 *     vient d'être créé. Un compte existant ne peut jamais être parrainé.
 */
async function afterSignIn(
  supabase: SupabaseClient,
  session: Session,
  request: NextRequest,
): Promise<void> {
  const user = session.user;
  if (!user) return;

  try {
    // Avant la création du parrainage : la comparaison d'IP en dépend.
    await rememberFingerprint(user.id, request);
    await recordActivityDay(supabase);
    // La connexion du jour peut révéler un cadre (Assidu, etc.).
    await evaluateFrames(user.id);

    if (session.provider_token) {
      const identity = await fetchDiscordIdentity(session.provider_token);
      if (identity?.mfaEnabled !== null && identity?.mfaEnabled !== undefined) {
        await storeDiscordMfa(user.id, identity.mfaEnabled);
      }
    }

    const store = await cookies();
    const invite = store.get(REFERRAL_COOKIE)?.value;
    if (!invite) return;

    const { data, error } = await supabase.rpc("referral_create", { p_code: invite });
    if (error) {
      console.error("referral_create", error);
      return;
    }

    const result = data as { ok?: boolean; reason?: string } | null;
    if (result?.ok !== true && result?.reason !== "already_referred") {
      console.warn("referral_create refusé", result?.reason);
    }

    // Le cookie a rempli son rôle : il ne resservira pas à la prochaine connexion.
    store.delete(REFERRAL_COOKIE);
  } catch (error) {
    // Un souci de parrainage ne doit jamais empêcher la connexion.
    console.error("afterSignIn", (error as Error).message);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/boosters";
  const target = `${origin}${next.startsWith("/") ? next : "/boosters"}`;

  const supabase = await createClient();

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (data.session) await afterSignIn(supabase, data.session, request);
      return NextResponse.redirect(target);
    }
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.session) await afterSignIn(supabase, data.session, request);
      return NextResponse.redirect(target);
    }
    // Le motif exact n'est pas montré au joueur, mais reste dans les journaux :
    // sans lui, un échec de connexion Discord était impossible à diagnostiquer.
    console.error("auth_confirm echange", error.message);
  }

  // Un deuxième onglet (ou navigateur) peut avoir déjà ouvert la session :
  // inutile de renvoyer le joueur vers l'écran de connexion.
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user) return NextResponse.redirect(target);

  return NextResponse.redirect(`${origin}/login?erreur=confirmation`);
}
