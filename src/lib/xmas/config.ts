/**
 * Fenêtre de l'overlay de Noël.
 *
 * Comme Halloween, la fenêtre est évaluée à Paris côté navigateur : un joueur
 * à l'étranger ne voit pas la neige une journée d'avance.
 */

export const XMAS_START = { month: 12, day: 1 } as const;
export const XMAS_END = { month: 1, day: 5 } as const;
export const XMAS_TIME_ZONE = "Europe/Paris";

/** Jour civil à Paris, sans dépendre du fuseau du serveur ou du navigateur. */
export function parisDay(date: Date): { month: number; day: number } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: XMAS_TIME_ZONE,
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { month, day };
}

/** Vrai du 1er décembre au 5 janvier inclus, à Paris. */
export function isXmasActive(date: Date = new Date()): boolean {
  const { month, day } = parisDay(date);
  return (
    (month === XMAS_START.month && day >= XMAS_START.day) ||
    (month === XMAS_END.month && day <= XMAS_END.day)
  );
}
