import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CONFIG, REFERRAL_COOKIE } from "@/lib/referral/config";
import { normalizeReferralCode } from "@/lib/referral/rules";
import { hashFingerprint, clientIp } from "@/lib/referral/service";
import { createClient } from "@/lib/supabase/server";

/**
 * Lien d'invitation : https://tcvg.fun/invite/<code>.
 *
 * Le code est vérifié côté serveur, puis déposé dans un cookie first-party
 * (HttpOnly, 30 jours). La page d'accueil lit ce cookie pour afficher « X
 * t'invite sur TCVG » ; le parrainage n'est créé qu'à la première connexion
 * Discord du filleul, dans /auth/confirm.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: rawCode } = await params;
  const origin = new URL(request.url).origin;
  const code = normalizeReferralCode(rawCode);

  if (!code) {
    return NextResponse.redirect(`${origin}/?invite=inconnu`);
  }

  const supabase = await createClient();

  // Limite de débit par empreinte d'IP (ou globale si le sel n'est pas réglé).
  const rateKey = `invite:${hashFingerprint(clientIp(request)) ?? "global"}`;
  const { data: allowed } = await supabase.rpc("referral_rate_hit", {
    p_key: rateKey,
    p_limit: REFERRAL_CONFIG.inviteRateLimit.hits,
    p_window_seconds: REFERRAL_CONFIG.inviteRateLimit.windowSeconds,
  });

  if (allowed === false) {
    return NextResponse.redirect(`${origin}/?invite=trop`);
  }

  const { data } = await supabase.rpc("referral_preview", { p_code: code });
  const preview = data as { ok?: boolean } | null;
  if (preview?.ok !== true) {
    return NextResponse.redirect(`${origin}/?invite=inconnu`);
  }

  const store = await cookies();
  store.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFERRAL_CONFIG.cookieDays * 86_400,
  });

  return NextResponse.redirect(`${origin}/?invite=1`);
}
