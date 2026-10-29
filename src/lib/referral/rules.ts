import { REFERRAL_CONFIG, siteOrigin } from "@/lib/referral/config";

/**
 * Règles pures du parrainage : aucune base, aucun réseau.
 *
 * La vérité d'un statut reste en base (`public.evaluate_referral`) ; ce module
 * sert à l'affichage et aux tests. Il décrit exactement les mêmes décisions :
 * voie immédiate ou différée, plafonds, proximité, consommation des boosters.
 */

export type ReferralStatus =
  | "en_cours"
  | "eligible"
  | "en_attente"
  | "a_examiner"
  | "paye"
  | "refuse";

export type ReferralPath = "immediat" | "differe";

/** Statuts qui occupent une place dans le plafond « en cours ». */
export const ACTIVE_STATUSES: ReferralStatus[] = [
  "en_cours",
  "eligible",
  "en_attente",
  "a_examiner",
];

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  en_cours: "En cours",
  eligible: "Seuil atteint",
  en_attente: "En attente",
  a_examiner: "À examiner",
  paye: "Payé",
  refuse: "Refusé",
};

/** Empêche les tableurs d'interpréter les données de l'export comme des formules. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** L'alphabet évite les caractères confondus (0/O, 1/I/l). */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function isValidReferralCode(code: string | null | undefined): code is string {
  if (!code) return false;
  if (code.length !== REFERRAL_CONFIG.codeLength) return false;
  return [...code].every((char) => CODE_ALPHABET.includes(char));
}

export function normalizeReferralCode(code: string | null | undefined): string | null {
  const value = code?.trim().toUpperCase();
  return isValidReferralCode(value) ? value : null;
}

export function inviteUrl(code: string, origin = siteOrigin()): string {
  return `${origin.replace(/\/$/, "")}/invite/${code}`;
}

/** Date d'obtention d'un identifiant Discord (snowflake), en jours d'âge. */
export function discordAccountAgeDays(discordId: string, now = Date.now()): number | null {
  if (!/^\d{15,25}$/.test(discordId)) return null;
  // 1420070400000 = 1er janvier 2015, origine des snowflakes Discord.
  const createdAt = Number(BigInt(discordId) >> BigInt(22)) + 1_420_070_400_000;
  if (!Number.isFinite(createdAt) || createdAt <= 0) return null;
  return Math.max(0, Math.floor((now - createdAt) / 86_400_000));
}

export type PathContext = {
  /** A2F confirmée par Discord à la dernière vérification. */
  mfaEnabled: boolean;
  /** Le parrain et le filleul partagent la même empreinte d'IP. */
  sameIp: boolean;
  /** Âge du compte Discord, `null` si l'identifiant est illisible. */
  discordAccountAgeDays: number | null;
};

/** Contraintes qui imposent la voie différée même avec l'A2F. */
export function forcedDeferral(context: PathContext): {
  forced: boolean;
  reasons: ("same_ip" | "discord_too_recent")[];
} {
  const reasons: ("same_ip" | "discord_too_recent")[] = [];

  if (context.sameIp) reasons.push("same_ip");

  const minAge = REFERRAL_CONFIG.discordMinAccountAgeDays;
  if (minAge > 0) {
    if (context.discordAccountAgeDays === null) reasons.push("discord_too_recent");
    else if (context.discordAccountAgeDays < minAge) reasons.push("discord_too_recent");
  }

  return { forced: reasons.length > 0, reasons };
}

/** Voie retenue à l'atteinte du seuil : immédiate seulement si l'A2F est active. */
export function choosePath(context: PathContext): ReferralPath {
  if (!context.mfaEnabled) return "differe";
  return forcedDeferral(context).forced ? "differe" : "immediat";
}

/** Date de paiement différé : seuil + délai. */
export function deferredEligibleAt(milestoneAt: Date): Date {
  return new Date(milestoneAt.getTime() + REFERRAL_CONFIG.delayDays * 86_400_000);
}

/**
 * Le paiement doit-il partir maintenant ?
 *
 * - voie immédiate : dès le seuil, A2F confirmée ;
 * - voie différée : à `eligible_at` ;
 * - A2F activée pendant l'attente : immédiat, sans attendre la date.
 */
export function isPaymentDue(
  state: { status: ReferralStatus; path: ReferralPath | null; eligibleAt: Date | null; mfaEnabled: boolean },
  now = new Date(),
): boolean {
  if (state.status === "paye" || state.status === "refuse") return false;
  if (state.status === "a_examiner") return false;
  if (state.mfaEnabled && state.path === "immediat") return true;
  if (state.mfaEnabled && state.path === "differe") {
    // L'A2F vient d'être confirmée : la voie immédiate s'applique.
    return true;
  }
  return state.eligibleAt !== null && state.eligibleAt.getTime() <= now.getTime();
}

/** Nombre de jours distincts de connexion entre deux instants. */
export function activityDaysBetween(days: string[], from: Date, to: Date): number {
  return [...new Set(days)].filter((day) => {
    const value = new Date(`${day}T00:00:00Z`).getTime();
    return value >= startOfDay(from).getTime() && value <= startOfDay(to).getTime();
  }).length;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Plafonds du parrain. */
export function capState(
  counts: { paid: number; active: number },
  config = REFERRAL_CONFIG,
): { canBePaid: boolean; canLink: boolean } {
  return {
    canBePaid: counts.paid < config.maxPaidPerReferrer,
    canLink: counts.active < config.maxPendingPerReferrer,
  };
}

/** Progression « 12 / 20 ouverts ». */
export function openingsProgress(
  openings: number,
  required: number = REFERRAL_CONFIG.requiredOpenings,
): { openings: number; required: number; remaining: number; percent: number; done: boolean } {
  const safe = Math.max(0, Math.trunc(openings));
  return {
    openings: safe,
    required,
    remaining: Math.max(0, required - safe),
    percent: required > 0 ? Math.min(100, Math.round((safe / required) * 100)) : 100,
    done: safe >= required,
  };
}

/**
 * Consommation d'un lot : le stock normal d'abord, puis le solde bonus.
 * Un lot plus grand que le total n'ouvre que ce qui est disponible.
 */
export function planOpenings(
  stock: number,
  bonus: number,
  count: number,
): { stock: number; bonus: number; opened: number } {
  const availableStock = Math.max(0, Math.trunc(stock));
  const availableBonus = Math.max(0, Math.trunc(bonus));
  const wanted = Math.max(0, Math.trunc(count));
  const opened = Math.min(wanted, availableStock + availableBonus);
  const fromStock = Math.min(opened, availableStock);

  return {
    stock: availableStock - fromStock,
    bonus: availableBonus - (opened - fromStock),
    opened,
  };
}

/** Fin de conservation d'une empreinte (90 jours par défaut). */
export function fingerprintCutoff(now = new Date(), days = REFERRAL_CONFIG.fingerprintRetentionDays): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Un parrainage payé ou refusé ne bouge plus. */
export function isFinalStatus(status: ReferralStatus): boolean {
  return status === "paye" || status === "refuse";
}

/** Garde d'idempotence du paiement : un seul passage par parrainage. */
export function claimPayment(status: ReferralStatus): boolean {
  return status === "eligible" || status === "en_attente" || status === "a_examiner";
}

export type LinkRefusal =
  | "self_referral"
  | "not_new_account"
  | "already_referred"
  | "referrer_suspended"
  | "discord_missing"
  | "same_discord"
  | "pending_cap";

/**
 * Un parrainage ne se crée qu'à la première inscription : compte neuf, filleul
 * jamais parrainé, parrain actif et comptes Discord distincts.
 */
export function linkDecision(context: {
  referrerId: string;
  referredId: string;
  referrerSuspended: boolean;
  referrerDiscordId: string | null;
  referredDiscordId: string | null;
  accountAgeMinutes: number;
  alreadyReferred: boolean;
  pendingCount: number;
}): { ok: true } | { ok: false; reason: LinkRefusal } {
  if (context.referrerId === context.referredId) return { ok: false, reason: "self_referral" };
  if (context.alreadyReferred) return { ok: false, reason: "already_referred" };
  if (context.accountAgeMinutes > REFERRAL_CONFIG.newAccountWindowMinutes) {
    return { ok: false, reason: "not_new_account" };
  }
  if (context.referrerSuspended) return { ok: false, reason: "referrer_suspended" };
  if (!context.referrerDiscordId || !context.referredDiscordId) {
    return { ok: false, reason: "discord_missing" };
  }
  if (context.referrerDiscordId === context.referredDiscordId) {
    return { ok: false, reason: "same_discord" };
  }
  if (!capState({ paid: 0, active: context.pendingCount }).canLink) {
    return { ok: false, reason: "pending_cap" };
  }
  return { ok: true };
}

export type PaymentContext = {
  status: ReferralStatus;
  paidCount: number;
  referrerSuspended: boolean;
  referredSuspended: boolean;
  discordLinked: boolean;
  discordIdUnchanged: boolean;
  sameIp: boolean;
  sharedIpCount: number;
  signupsLast24h: number;
};

/**
 * Conditions vérifiées juste avant un paiement. `blocked` empêche le paiement,
 * `review` l'envoie à l'examen manuel : aucun détail n'est montré au joueur.
 */
export function paymentBlockers(context: PaymentContext): {
  blocked: string[];
  review: boolean;
} {
  const blocked: string[] = [];

  if (!claimPayment(context.status)) blocked.push("already_final");
  if (context.referrerSuspended) blocked.push("referrer_suspended");
  if (context.referredSuspended) blocked.push("referred_suspended");
  if (!context.discordLinked) blocked.push("discord_unlinked");
  if (!context.discordIdUnchanged) blocked.push("discord_changed");
  if (!capState({ paid: context.paidCount, active: 0 }).canBePaid) {
    blocked.push("paid_cap");
  }

  const review =
    context.sharedIpCount >= REFERRAL_CONFIG.sameIpReviewThreshold ||
    context.signupsLast24h > REFERRAL_CONFIG.signupBurstThreshold;

  return { blocked, review };
}

/** Raisons internes des refus, traduites en message joueur sans détail. */
export function refusalMessage(): string {
  return "Les conditions du parrainage ne sont plus réunies. Les boosters n'ont pas été attribués.";
}

/** Message affiché au filleul selon la voie. */
export function referredGuidance(
  state: { mfaEnabled: boolean; path: ReferralPath | null; eligibleAt: Date | null },
  formatter: (date: Date) => string,
): string {
  if (state.mfaEnabled) {
    return "Ton A2F est active : tes boosters arrivent dès que le seuil est atteint.";
  }
  if (state.path === "differe" && state.eligibleAt) {
    return `Active l'A2F sur Discord pour recevoir tes boosters tout de suite ; sinon ils arrivent le ${formatter(
      state.eligibleAt,
    )}.`;
  }
  return "Active l'A2F sur Discord pour recevoir tes boosters tout de suite ; sinon ils arrivent après le délai de vérification.";
}
