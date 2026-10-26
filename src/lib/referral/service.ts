import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERRAL_CONFIG } from "@/lib/referral/config";
import type { ReferralPath, ReferralStatus } from "@/lib/referral/rules";

/**
 * Côté serveur du parrainage : empreintes, A2F Discord, lecture du tableau de
 * bord. Aucune de ces fonctions n'est appelée depuis un composant client.
 */

/** Sel des empreintes : sans lui, aucune empreinte n'est écrite. */
function hashSalt(): string | null {
  return process.env.REFERRAL_HASH_SALT?.trim() || null;
}

/** HMAC-SHA256 d'une valeur (IP ou agent utilisateur). */
export function hashFingerprint(value: string | null | undefined): string | null {
  const salt = hashSalt();
  const clean = value?.trim();
  if (!salt || !clean) return null;
  return createHmac("sha256", salt).update(clean).digest("hex");
}

/** IP du client derrière le proxy (Cloudflare, Vercel, Next). */
export function clientIp(request: Request): string | null {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value =
    headers.get("cf-connecting-ip") ??
    forwarded ??
    headers.get("x-real-ip") ??
    null;
  return value && value.length <= 64 ? value : null;
}

/** Empreintes de la requête, prêtes pour `record_fingerprint`. */
export function requestFingerprints(request: Request): { ip: string | null; ua: string | null } {
  return {
    ip: hashFingerprint(clientIp(request)),
    ua: hashFingerprint(request.headers.get("user-agent")),
  };
}

/** Enregistre les empreintes d'une connexion (réservé au service_role). */
export async function rememberFingerprint(
  userId: string,
  request: Request,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const { ip, ua } = requestFingerprints(request);
  if (!ip && !ua) return;

  const { error } = await admin.rpc("record_fingerprint", {
    p_user_id: userId,
    p_ip_hash: ip,
    p_ua_hash: ua,
  });
  if (error) console.error("record_fingerprint", error);
}

export type DiscordIdentity = {
  id: string;
  username: string | null;
  mfaEnabled: boolean | null;
};

/**
 * Lit le profil Discord avec le jeton fourni par la connexion OAuth.
 * Scope `identify` uniquement : ni e-mail, ni serveurs, ni messages.
 */
export async function fetchDiscordIdentity(accessToken: string): Promise<DiscordIdentity | null> {
  if (!accessToken) return null;

  try {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("discord_me", response.status);
      return null;
    }

    const data = (await response.json()) as {
      id?: unknown;
      username?: unknown;
      mfa_enabled?: unknown;
    };

    if (typeof data.id !== "string") return null;

    return {
      id: data.id,
      username: typeof data.username === "string" ? data.username : null,
      mfaEnabled: typeof data.mfa_enabled === "boolean" ? data.mfa_enabled : null,
    };
  } catch (error) {
    console.error("discord_me", (error as Error).message);
    return null;
  }
}

/**
 * Enregistre l'état A2F lu chez Discord, puis réévalue un éventuel parrainage.
 * Une valeur absente n'est jamais enregistrée : le compte reste « sans A2F »
 * sans être sanctionné.
 */
export async function storeDiscordMfa(
  userId: string,
  mfaEnabled: boolean | null,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin || mfaEnabled === null) return;

  // Enregistre la valeur, journalise la vérification et réévalue le parrainage
  // (l'A2F peut débloquer un paiement immédiat).
  const { error } = await admin.rpc("referral_record_mfa", {
    p_user_id: userId,
    p_enabled: mfaEnabled,
  });
  if (error) console.error("referral_record_mfa", error);
}

/** Marque la connexion du jour (jours d'activité pendant l'attente). */
export async function recordActivityDay(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("record_activity_day");
  if (error) console.error("record_activity_day", error);
}

export type ReferralOverviewRow = {
  id: number;
  username: string;
  status: ReferralStatus;
  createdAt: string;
  milestoneReachedAt: string | null;
  eligibleAt: string | null;
  paidAt: string | null;
  path: ReferralPath | null;
  openings: number;
};

export type ReferralInvited = {
  referrer: string;
  status: ReferralStatus;
  path: ReferralPath | null;
  eligibleAt: string | null;
  paidAt: string | null;
  openings: number;
  discordLinked: boolean;
};

export type ReferralOverview = {
  code: string;
  bonusBoosters: number;
  mfaEnabled: boolean;
  mfaCheckedAt: string | null;
  discordLinked: boolean;
  requiredOpenings: number;
  rewardBoosters: number;
  delayDays: number;
  maxPaid: number;
  maxPending: number;
  paid: number;
  active: number;
  /** Invitations non rattachées (plafond en cours), sur 30 jours. */
  missed: number;
  referrals: ReferralOverviewRow[];
  invited: ReferralInvited | null;
};

/** Tableau de bord du joueur connecté, ou `null` si la migration manque. */
export async function getReferralOverview(
  supabase: SupabaseClient,
): Promise<ReferralOverview | null> {
  const { data, error } = await supabase.rpc("referral_overview");
  if (error || !data) {
    console.error("referral_overview", error);
    return null;
  }

  const payload = data as Record<string, unknown>;
  if (payload.ok !== true) return null;

  const rows = Array.isArray(payload.referrals) ? payload.referrals : [];
  const invited = payload.invited as Record<string, unknown> | null | undefined;

  return {
    code: typeof payload.code === "string" ? payload.code : "",
    bonusBoosters: Number(payload.bonus_boosters ?? 0),
    mfaEnabled: payload.mfa_enabled === true,
    mfaCheckedAt: (payload.mfa_checked_at as string | null) ?? null,
    discordLinked: payload.discord_linked === true,
    requiredOpenings: Number(payload.required_openings ?? REFERRAL_CONFIG.requiredOpenings),
    rewardBoosters: Number(payload.reward_boosters ?? REFERRAL_CONFIG.rewardBoosters),
    delayDays: Number(payload.delay_days ?? REFERRAL_CONFIG.delayDays),
    maxPaid: Number(payload.max_paid ?? REFERRAL_CONFIG.maxPaidPerReferrer),
    maxPending: Number(payload.max_pending ?? REFERRAL_CONFIG.maxPendingPerReferrer),
    paid: Number(payload.paid ?? 0),
    active: Number(payload.active ?? 0),
    missed: Number(payload.missed ?? 0),
    referrals: rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: Number(item.id),
        username: String(item.username ?? "Joueur"),
        status: item.status as ReferralStatus,
        createdAt: String(item.created_at ?? ""),
        milestoneReachedAt: (item.milestone_reached_at as string | null) ?? null,
        eligibleAt: (item.eligible_at as string | null) ?? null,
        paidAt: (item.paid_at as string | null) ?? null,
        path: (item.path as ReferralPath | null) ?? null,
        openings: Number(item.openings ?? 0),
      };
    }),
    invited: invited
      ? {
          referrer: String(invited.referrer ?? "Ton parrain"),
          status: invited.status as ReferralStatus,
          path: (invited.path as ReferralPath | null) ?? null,
          eligibleAt: (invited.eligible_at as string | null) ?? null,
          paidAt: (invited.paid_at as string | null) ?? null,
          openings: Number(invited.openings ?? 0),
          discordLinked: invited.discord_linked === true,
        }
      : null,
  };
}

export type ReferralReferredAvatar = {
  referralId: number;
  avatarCardId: string | null;
  frame: string;
};

/** Avatars des filleuls, en une requête (RLS : uniquement les siens). */
export async function getReferralReferredAvatars(
  supabase: SupabaseClient,
): Promise<Map<number, ReferralReferredAvatar>> {
  const { data, error } = await supabase.rpc("referral_referred_avatars");
  if (error || !Array.isArray(data)) return new Map();

  return new Map(
    (data as Record<string, unknown>[]).map((row) => [
      Number(row.referral_id),
      {
        referralId: Number(row.referral_id),
        avatarCardId: (row.avatar_card_id as string | null) ?? null,
        frame: (row.frame as string | null) ?? "steel",
      },
    ]),
  );
}

export type ReferralPreview = { code: string; username: string } | null;

/** Vérifie un code d'invitation sans session (page /invite et bandeau). */
export async function previewReferralCode(
  supabase: SupabaseClient,
  code: string | null | undefined,
): Promise<ReferralPreview> {
  if (!code) return null;

  const { data, error } = await supabase.rpc("referral_preview", { p_code: code });
  if (error || !data) return null;

  const payload = data as { ok?: boolean; code?: string; username?: string };
  if (payload.ok !== true || !payload.code || !payload.username) return null;

  return { code: payload.code, username: payload.username };
}

export type ReferralAdminRow = {
  id: number;
  referrer: string;
  referred: string;
  createdAt: string;
  status: ReferralStatus;
  path: ReferralPath | null;
  flags: Record<string, unknown>;
  eligibleAt: string | null;
  paidAt: string | null;
  refusedReason: string | null;
  openings: number;
  mfa: boolean;
  discordLinked: boolean;
};

export type ReferralAdminReport = {
  counts: Record<string, number>;
  rows: ReferralAdminRow[];
};

/** Liste d'administration (RPC protégé par `is_admin()`). */
export async function getReferralAdminReport(
  supabase: SupabaseClient,
  status: string | null,
): Promise<ReferralAdminReport | null> {
  const { data, error } = await supabase.rpc("referral_admin_report", { p_status: status });
  if (error || !data) {
    console.error("referral_admin_report", error);
    return null;
  }

  const payload = data as Record<string, unknown>;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    counts: (payload.counts as Record<string, number>) ?? {},
    rows: rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        id: Number(item.id),
        referrer: String(item.referrer ?? "?"),
        referred: String(item.referred ?? "?"),
        createdAt: String(item.created_at ?? ""),
        status: item.status as ReferralStatus,
        path: (item.path as ReferralPath | null) ?? null,
        flags: (item.flags as Record<string, unknown>) ?? {},
        eligibleAt: (item.eligible_at as string | null) ?? null,
        paidAt: (item.paid_at as string | null) ?? null,
        refusedReason: (item.refused_reason as string | null) ?? null,
        openings: Number(item.openings ?? 0),
        mfa: item.mfa === true,
        discordLinked: item.discord_linked === true,
      };
    }),
  };
}
