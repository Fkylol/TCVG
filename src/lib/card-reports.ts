/**
 * Signalements de carte, déposés depuis la collection.
 *
 * Un joueur signale ce qui cloche sur une carte qu'il possède (visuel cassé,
 * fiche fausse, rareté étrange…). Le signalement est écrit en base et relu dans
 * l'atelier local (`/atelier/signalements`), qui ouvre la carte à corriger.
 *
 * Aucune I/O ici : les règles servent au formulaire (bornes, libellés), à
 * l'action serveur qui enregistre, et aux tests.
 */

/** Motifs proposés, du plus fréquent au plus rare. */
export const REPORT_TOPICS = [
  { slug: "visuel", label: "Visuel", hint: "Image cassée, coupée, floue ou qui ne montre pas le personnage." },
  { slug: "fiche", label: "Fiche", hint: "Nom, accroche, biographie ou citation à corriger." },
  { slug: "rarete", label: "Rareté", hint: "La carte semble trop commune ou trop rare." },
  { slug: "autre", label: "Autre", hint: "Doublon, mauvaise franchise, faute de frappe…" },
] as const;

export type ReportTopic = (typeof REPORT_TOPICS)[number]["slug"];

export const REPORT_MIN = 5;
export const REPORT_MAX = 1000;

export function isReportTopic(value: string): value is ReportTopic {
  return REPORT_TOPICS.some((topic) => topic.slug === value);
}

export function reportTopicLabel(slug: string): string {
  return REPORT_TOPICS.find((topic) => topic.slug === slug)?.label ?? "Autre";
}

export type CleanReport =
  | { ok: true; topic: ReportTopic; message: string }
  | { ok: false; error: string };

/**
 * Vérifie un signalement avant écriture.
 *
 * Les erreurs sont rédigées pour être affichées telles quelles dans le
 * formulaire : elles disent ce qui manque, pas ce que le code attend.
 */
export function normalizeReport(input: { topic: string; message: string }): CleanReport {
  const topic = (input.topic ?? "").trim();
  const message = (input.message ?? "").replace(/\s+/g, " ").trim();

  if (!isReportTopic(topic)) return { ok: false, error: "Choisis ce qui cloche sur la carte." };
  if (message.length < REPORT_MIN) {
    return { ok: false, error: `Décris le problème en ${REPORT_MIN} caractères minimum.` };
  }
  if (message.length > REPORT_MAX) {
    return { ok: false, error: `Message trop long : ${REPORT_MAX} caractères maximum.` };
  }

  return { ok: true, topic, message };
}
