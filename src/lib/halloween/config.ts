/**
 * Fenêtre et réglages de l'overlay Halloween.
 *
 * La fenêtre est évaluée dans le fuseau du site (Europe/Paris), côté serveur
 * comme côté navigateur : un joueur à l'étranger ne voit pas l'overlay une
 * journée d'avance. `force` sert uniquement aux tests (env ou développement).
 */

export const HALLOWEEN_START = { month: 10, day: 15 } as const;
export const HALLOWEEN_END = { month: 11, day: 2 } as const;
export const HALLOWEEN_TIME_ZONE = "Europe/Paris";
export const HALLOWEEN_BOOSTER_NAME = "Booster d'Halloween";
export const HALLOWEEN_COOLDOWN_MS = 60 * 60 * 1000;

/** Jour civil à Paris, sans dépendre du fuseau du serveur ou du navigateur. */
export function parisDay(date: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: HALLOWEEN_TIME_ZONE,
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { month, day };
}

/** Vrai du 15 octobre au 2 novembre inclus, à Paris. */
export function isHalloweenActive(date: Date = new Date()): boolean {
  const { month, day } = parisDay(date);
  const value = month * 100 + day;
  return value >= HALLOWEEN_START.month * 100 + HALLOWEEN_START.day &&
    value <= HALLOWEEN_END.month * 100 + HALLOWEEN_END.day;
}

/** Le paramètre `force` n'ouvre la route qu'en développement ou sur opt-in. */
export function halloweenForceAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.HALLOWEEN_FORCE === "1";
}
