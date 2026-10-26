/**
 * Réglages de L'Agora — un seul endroit à changer.
 *
 * Le nom du chat, les langues et les valeurs de repli vivent ici. Les limites
 * qui doivent être appliquées côté base (débit, capacité, rétention) sont
 * doublées dans `game_config` : c'est la base qui fait foi (migration 031),
 * ces constantes servent au rendu et aux messages d'erreur.
 */

/** Nom du chat communautaire. Changer cette ligne suffit pour tout renommer. */
export const APP_CHAT_NAME = "L'Agora";

export type ChatLanguage = "fr" | "en" | "es" | "int";

export type ChatLanguageInfo = {
  key: ChatLanguage;
  label: string;
  /** Nom court affiché sur les onglets. */
  short: string;
  /** Phrase d'accueil du groupe. */
  tagline: string;
};

export const CHAT_LANGUAGES: ChatLanguageInfo[] = [
  { key: "fr", label: "Français", short: "FR", tagline: "Le salon francophone" },
  { key: "en", label: "English", short: "EN", tagline: "The English room" },
  { key: "es", label: "Español", short: "ES", tagline: "La sala en español" },
  { key: "int", label: "International", short: "INT", tagline: "Toutes les langues" },
];

export const CHAT_LANGUAGE_KEYS = CHAT_LANGUAGES.map((language) => language.key);

export function isChatLanguage(value: string | null | undefined): value is ChatLanguage {
  return CHAT_LANGUAGE_KEYS.includes((value ?? "") as ChatLanguage);
}

export function chatLanguageInfo(language: ChatLanguage): ChatLanguageInfo {
  return CHAT_LANGUAGES.find((item) => item.key === language) ?? CHAT_LANGUAGES[0];
}

/** Valeurs de repli : miroir des réglages `chat_*` de `game_config`. */
export const CHAT_DEFAULTS = {
  historyPage: 50,
  retentionDays: 7,
  rateSeconds: 3,
  ratePerMinute: 20,
  maxAnnouncements: 3,
  announcementMinutes: 30,
  unlockBoosters: 20,
  unlockHours: 24,
} as const;

/** Longueur maximale d'un message, en caractères. */
export const MAX_CHAT_BODY = 300;

/** Motifs de signalement proposés dans le menu d'un message. */
export const REPORT_REASONS = [
  { key: "spam", label: "Spam ou publicité" },
  { key: "harassment", label: "Harcèlement" },
  { key: "inappropriate", label: "Contenu inapproprié" },
  { key: "scam", label: "Arnaque" },
  { key: "other", label: "Autre" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["key"];

/** Durées de mise au silence proposées à la modération (minutes, `null` = définitif). */
export const MUTE_CHOICES = [
  { minutes: 10, label: "10 minutes" },
  { minutes: 60, label: "1 heure" },
  { minutes: 1440, label: "24 heures" },
  { minutes: null, label: "Définitif" },
] as const;

/** Libellé d'un salon : « Français · Salon 2 ». */
export function chatRoomLabel(language: ChatLanguage, number: number): string {
  return `${chatLanguageInfo(language).label} · Salon ${number}`;
}

/**
 * Heure d'un message, stable entre serveur et client.
 *
 * Le fuseau est fixé (Europe/Paris) pour que le rendu serveur et l'hydratation
 * donnent exactement la même chaîne, quel que soit le fuseau du visiteur.
 */
export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** Date et heure complètes, fuseau fixe : même rendu serveur et client. */
export function formatChatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

/** « 12 min », « 1 h 05 » : temps restant avant l'expiration d'une annonce. */
export function formatRemaining(expiresAt: string, now = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "expirée";

  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}
