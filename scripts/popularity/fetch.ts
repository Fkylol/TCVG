/**
 * Étape 3 — pages vues, via l'API publique de Wikimedia.
 *
 * Pour chaque article retenu à l'étape 2 : redirection résolue, puis pages
 * vues mensuelles, agent « user » (trafic humain), accès « all-access », sur
 * les 12 derniers mois complets. On ne garde que la médiane par langue.
 *
 *   npm run popularity:fetch
 *
 * Les mois sans donnée ne sont pas remplacés par des zéros : la médiane porte
 * sur les mois réellement observés. Un article absent renvoie 404, ce qui
 * signifie « pas de données », pas une erreur.
 */

import { LANGUAGES, PAGEVIEW_MONTHS } from "../../src/lib/rarity-distribution.config";
import { loadDataset, saveDataset, type Dataset } from "./lib/dataset";
import { netSummary, wikiJson } from "./lib/http";

type TitlesPayload = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, { title: string; missing?: string }>;
  };
};

/** Dernier mois complet et premier mois de la fenêtre. */
export function monthWindow(now = new Date()): { start: string; end: string; months: string[] } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const months: string[] = [];
  const cursor = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (PAGEVIEW_MONTHS - 1), 1));
  for (let index = 0; index < PAGEVIEW_MONTHS; index += 1) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const start = `${months[0]}01`;
  const endStamp = `${months[months.length - 1]}${String(end.getUTCDate()).padStart(2, "0")}`;
  return { start, end: endStamp, months };
}

/**
 * Résout les redirections d'un lot de titres sur un wiki, pour interroger les
 * pages vues sur le titre cible. Les titres absents sont écartés.
 */
async function resolveTitles(lang: string, titles: string[]): Promise<Map<string, string | null>> {
  const resolved = new Map<string, string | null>();
  if (titles.length === 0) return resolved;

  const batch = titles.slice(0, 50);
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1` +
    `&prop=info&titles=${batch.map((title) => encodeURIComponent(title)).join("|")}`;

  const payload = await wikiJson<TitlesPayload>(url, { bucket: "api", perSecond: 20 });
  const query = payload.query ?? {};

  const chain = new Map<string, string>();
  for (const entry of [...(query.normalized ?? []), ...(query.redirects ?? [])]) {
    chain.set(entry.from, entry.to);
  }
  const missing = new Set(
    Object.values(query.pages ?? {})
      .filter((page) => page.missing !== undefined)
      .map((page) => page.title),
  );

  const follow = (title: string): string | null => {
    let current = title;
    const seen = new Set<string>();
    while (chain.has(current) && !seen.has(current)) {
      seen.add(current);
      current = chain.get(current)!;
    }
    return missing.has(current) ? null : current;
  };

  for (const title of batch) resolved.set(title, follow(title));
  return resolved;
}

/** Médiane d'une liste de nombres (0 si vide). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

type PageviewPayload = { items?: { timestamp: string; views: number }[] };

async function monthlyViews(lang: string, title: string, start: string, end: string): Promise<number[] | null> {
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia` +
    `/all-access/user/${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${start}/${end}`;

  const result = await wikiJson<PageviewPayload>(url, {
    bucket: "rest",
    perSecond: 20,
    acceptStatus: [404],
  }).catch(() => null);

  if (!result?.items?.length) return null;
  return result.items.map((item) => item.views);
}

/** Pages vues médianes par langue pour une liste de titres. */
export async function pageviewsByLanguage(
  titles: Record<string, string> | null,
  window: { start: string; end: string },
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!titles) return out;

  for (const lang of LANGUAGES) {
    const title = titles[lang];
    if (!title) continue;
    const views = await monthlyViews(lang, title, window.start, window.end);
    if (!views) continue;
    const value = median(views);
    if (value > 0) out[lang] = value;
  }
  return out;
}

async function main() {
  const dataset: Dataset = await loadDataset();
  const window = monthWindow();
  dataset.window = { from: window.start, to: window.end };
  console.log(`→ fenêtre : ${window.months[0]} → ${window.months[window.months.length - 1]} (12 mois complets)`);

  // 1. Redirections, langue par langue, sur tous les titres retenus.
  const titlesByLang = new Map<string, Set<string>>();
  for (const entry of [...dataset.cards, ...dataset.franchises]) {
    for (const [lang, title] of Object.entries(entry.wikipediaTitles ?? {})) {
      const set = titlesByLang.get(lang) ?? new Set<string>();
      set.add(title);
      titlesByLang.set(lang, set);
    }
  }

  const redirects = new Map<string, string | null>();
  for (const [lang, titles] of titlesByLang) {
    const list = [...titles];
    for (let index = 0; index < list.length; index += 50) {
      const batch = list.slice(index, index + 50);
      const resolved = await resolveTitles(lang, batch);
      for (const [from, to] of resolved) redirects.set(`${lang}|${from}`, to);
    }
    console.log(`  ${lang} : ${list.length} titres vérifiés`);
  }

  const rewrite = (entry: { wikipediaTitles: Record<string, string> | null }) => {
    if (!entry.wikipediaTitles) return null;
    const out: Record<string, string> = {};
    for (const [lang, title] of Object.entries(entry.wikipediaTitles)) {
      const target = redirects.get(`${lang}|${title}`);
      if (target) out[lang] = target;
    }
    return out;
  };

  // 2. Pages vues, article par article.
  let done = 0;
  for (const card of dataset.cards) {
    if (card.matchStatus !== "auto") continue;
    const titles = rewrite(card);
    card.wikipediaTitles = titles && Object.keys(titles).length ? titles : card.wikipediaTitles;
    const views = await pageviewsByLanguage(card.wikipediaTitles, window);
    card.pageviews = Object.keys(views).length ? views : null;
    card.pageviewsTotal = Object.values(views).reduce((sum, value) => sum + value, 0);
    done += 1;
    if (done % 20 === 0) process.stdout.write(`  ${done} cartes\r`);
  }

  for (const franchise of dataset.franchises) {
    const titles = rewrite(franchise);
    franchise.wikipediaTitles = titles && Object.keys(titles).length ? titles : franchise.wikipediaTitles;
    const views = await pageviewsByLanguage(franchise.wikipediaTitles, window);
    franchise.pageviews = Object.keys(views).length ? views : null;
    franchise.pageviewsTotal = Object.values(views).reduce((sum, value) => sum + value, 0);
  }

  await saveDataset(dataset);

  const cardsWithViews = dataset.cards.filter((card) => card.pageviewsTotal).length;
  const franchisesWithViews = dataset.franchises.filter((franchise) => franchise.pageviewsTotal).length;
  console.log(
    `\n✓ pages vues : ${cardsWithViews}/${dataset.cards.length} cartes, ${franchisesWithViews}/${dataset.franchises.length} franchises`,
  );
  console.log(`  ${netSummary()}`);
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/popularity/fetch.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
