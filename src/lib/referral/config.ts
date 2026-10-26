/**
 * Parrainage — tous les réglages au même endroit.
 *
 * Les valeurs font foi côté base : la migration 046 les reçoit en paramètres
 * par défaut (`public.referral_config()`), et les pages les lisent pour
 * l'affichage. Modifier un chiffre ici ne suffit donc pas : il faut aussi
 * changer la valeur correspondante dans la migration ou la fonction SQL.
 * C'est volontaire — un plafond ne doit jamais dépendre du navigateur.
 */
export const REFERRAL_CONFIG = {
  /** Boosters bonus reçus par le parrain et par le filleul. */
  rewardBoosters: 3,
  /** Boosters à ouvrir par le filleul avant de débloquer la récompense. */
  requiredOpenings: 20,
  /** Délai de la voie différée (sans A2F), en jours. */
  delayDays: 7,
  /** Parrainages payés maximum par parrain. */
  maxPaidPerReferrer: 20,
  /** Parrainages en cours maximum par parrain (au-delà, le filleul n'est plus rattaché). */
  maxPendingPerReferrer: 50,
  /** Jours distincts de connexion exigés pendant l'attente (0 = désactivé). */
  activeDaysRequiredDelayed: 3,
  /** Durée du cookie de parrainage. */
  cookieDays: 30,
  /** Âge minimum du compte Discord, en jours (0 = contrôle désactivé). */
  discordMinAccountAgeDays: 0,
  /** Conservation des empreintes d'IP et d'agent utilisateur. */
  fingerprintRetentionDays: 90,
  /** Nombre de filleuls partageant une empreinte avant examen manuel. */
  sameIpReviewThreshold: 3,
  /** Inscriptions parrainées maximum d'un parrain sur la fenêtre ci-dessous. */
  signupBurstThreshold: 5,
  signupBurstWindowHours: 24,
  /** Un compte est « nouveau » s'il a été créé il y a moins de cette durée. */
  newAccountWindowMinutes: 15,
  /** Longueur du code de parrainage. */
  codeLength: 8,
  /** Parrainages traités par exécution de la tâche planifiée. */
  cronBatchSize: 100,
  /** Limite de débit sur /invite/<code>. */
  inviteRateLimit: { hits: 30, windowSeconds: 60 },
  /** Limite de débit sur la revérification de l'A2F. */
  mfaRateLimit: { hits: 10, windowSeconds: 300 },
} as const;

/** Cookie first-party déposé par /invite/<code>. */
export const REFERRAL_COOKIE = "tcvg_invite";

/** Page de suivi du parrainage. */
export const REFERRAL_PAGE = "/parrainage";

/** Page d'aide Discord sur l'authentification à deux facteurs. */
export const DISCORD_MFA_HELP = "https://support.discord.com/hc/fr/articles/219576828";

/** Origine publique du site, utilisée dans les liens d'invitation. */
export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcvg.fun").replace(/\/$/, "");
}
