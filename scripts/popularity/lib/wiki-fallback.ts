/**
 * Étape 4 bis — importance d'un personnage dans le wiki de sa franchise.
 *
 * Pour les cartes sans correspondance Wikidata vérifiée, le score de repli ne
 * peut pas venir d'un article propre. On mesure alors deux traces laissées par
 * le personnage dans le wiki de sa franchise :
 *
 *   • le nombre de pages qui renvoient vers sa page (backlinks) ;
 *   • la taille de sa page.
 *
 * Chaque métrique est transformée par log10(1 + x), puis classée en percentile
 * **à l'intérieur de la même franchise** (jamais entre wikis différents). Le
 * rang interne vaut 0,6 × backlinks + 0,4 × taille. Le score final est calculé
 * par `computeScores` : 0,4 × popularité de la franchise + 0,6 × rang interne.
 *
 * Le wiki est cherché dans cet ordre : lien officiel Wikidata (`P856`), domaine
 * Fandom déduit du nom, puis recherche web publique. Une page n'est acceptée
 * que si son titre correspond au personnage ; aucune correspondance n'est
 * inventée. Si le wiki ou la page manque, la carte garde le repli historique
 * (0,3 × score de la franchise) et la raison est écrite dans le rapport.
 */

import { baseName, hostMatchesFranchise, nameMatches, normalize } from "../../images/lib/strict";
import { FALLBACK_WEIGHTS } from "../../../src/lib/rarity-distribution.config";
import type { CardEntry, Dataset, FallbackData, FranchiseEntry, WikiReference } from "./dataset";
import { wikiGet, wikiJson } from "./http";
import { fetchOfficialWebsites } from "./wikidata";
import { fandomHost } from "../../images/lib/sources";

const PER_SECOND = 8;

type SiteInfo = { query?: { general?: { sitename?: string } } };

function apiUrl(api: string, params: string): string {
  return `${api}${api.includes("?") ? "&" : "?"}${params}`;
}

/** L'API répond-elle réellement et expose-t-elle un wiki ? */
async function siteName(api: string): Promise<string | null> {
  try {
    const data = await wikiJson<SiteInfo>(
      apiUrl(api, "action=query&format=json&origin=*&meta=siteinfo&siprop=general"),
      { bucket: "fallback", perSecond: PER_SECOND, acceptStatus: [404] },
    );
    return data.query?.general?.sitename ?? null;
  } catch {
    return null;
  }
}

/** Points d'entrée MediaWiki possibles pour un site officiel. */
function officialApis(urls: string[]): string[] {
  const out = new Set<string>();
  for (const raw of urls) {
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      // Fandom sert son API à la racine ; les autres wikis MediaWiki souvent
      // sous /w/. On teste les deux, sans jamais deviner un titre de page.
      if (url.hostname.endsWith("fandom.com")) out.add(`${url.origin}/api.php`);
      out.add(`${url.origin}/api.php`);
      out.add(`${url.origin}/w/api.php`);
    } catch {
      // URL invalide dans Wikidata : ignorée.
    }
  }
  return [...out];
}

/** Hôtes cités par une recherche web, sans les sites qui ne sont pas des wikis. */
function hostsFromSearch(html: string): string[] {
  const targets = new Set<string>();
  for (const match of html.matchAll(/uddg=([^&"']+)/g)) {
    try {
      targets.add(decodeURIComponent(match[1]));
    } catch {
      // paramètre mal encodé : ignoré
    }
  }
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+/g)) targets.add(match[0]);

  const ignored = /(^|\.)(wikipedia|wikimedia|wikidata|google|duckduckgo|bing|reddit|youtube|facebook|twitter|x|amazon|github|archive|fandom)\./i;
  const hosts = new Set<string>();
  for (const target of targets) {
    try {
      const host = new URL(target).hostname.toLowerCase();
      if (host === "fandom.com" || host === "www.fandom.com") continue;
      if (ignored.test(host) && !host.endsWith(".fandom.com")) continue;
      if (!host.includes(".") || host.length > 80) continue;
      // Un wiki public a presque toujours « wiki » dans son domaine ; Fandom
      // est reconnu par son suffixe. Le test d'API tranche ensuite.
      if (!host.endsWith(".fandom.com") && !host.includes("wiki")) continue;
      hosts.add(host);
    } catch {
      // lien de redirection illisible : ignoré
    }
  }
  return [...hosts].slice(0, 6);
}

async function searchWikiHosts(franchise: string): Promise<string[]> {
  const query = `"${franchise}" wiki`;
  try {
    const response = await wikiGet(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { bucket: "web", perSecond: 2 },
    );
    if (response.status !== 200) return [];
    return hostsFromSearch(response.body);
  } catch {
    return [];
  }
}

/** Essaie un hôte en `/api.php` puis `/w/api.php`. */
async function probeHost(host: string, source: WikiReference["source"]): Promise<WikiReference | null> {
  for (const path of ["/api.php", "/w/api.php"]) {
    const api = `https://${host}${path}`;
    if (await siteName(api)) return { host, api, source };
  }
  return null;
}

const DISCOVERY = new Map<string, WikiReference | null>();

/**
 * Wiki de la franchise : officiel d'abord, puis Fandom déduit du nom, puis
 * recherche web. Le résultat est mémorisé pour la session et dans le jeu de
 * données (`franchise.wiki`).
 */
export async function discoverWiki(
  franchise: FranchiseEntry,
  officialUrls: string[],
  refresh = false,
): Promise<WikiReference | null> {
  if (!refresh && franchise.wiki !== undefined) return franchise.wiki;
  if (!refresh && DISCOVERY.has(franchise.id)) return DISCOVERY.get(franchise.id) ?? null;

  let found: WikiReference | null = null;

  for (const api of officialApis(officialUrls)) {
    if (await siteName(api)) {
      found = { host: new URL(api).hostname, api, source: "official" };
      break;
    }
  }

  if (!found) {
    const host = await fandomHost(franchise.name);
    if (host && hostMatchesFranchise(host, franchise.name)) {
      found = await probeHost(host, "fandom");
    }
  }

  if (!found) {
    for (const host of await searchWikiHosts(franchise.name)) {
      const candidate = await probeHost(host, "search");
      if (candidate) {
        found = candidate;
        break;
      }
    }
  }

  franchise.wiki = found;
  DISCOVERY.set(franchise.id, found);
  return found;
}

type PageInfo = {
  title: string;
  length?: number;
  missing?: string;
  pageprops?: Record<string, unknown>;
};

type InfoPayload = {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<string, PageInfo>;
  };
};

type SearchPayload = { query?: { search?: { title: string }[] } };

function pagesOf(payload: InfoPayload): PageInfo[] {
  return Object.values(payload.query?.pages ?? {});
}

async function pageInfo(api: string, title: string): Promise<PageInfo | null> {
  try {
    const payload = await wikiJson<InfoPayload>(
      apiUrl(
        api,
        `action=query&format=json&origin=*&redirects=1&prop=info%7Cpageprops&ppprop=disambiguation&titles=${encodeURIComponent(title)}`,
      ),
      { bucket: "fallback", perSecond: PER_SECOND, acceptStatus: [404] },
    );
    const page = pagesOf(payload)[0];
    if (!page || page.missing !== undefined) return null;
    return page;
  } catch {
    return null;
  }
}

async function searchTitles(api: string, term: string): Promise<string[]> {
  try {
    const payload = await wikiJson<SearchPayload>(
      apiUrl(
        api,
        `action=query&format=json&origin=*&list=search&srnamespace=0&srlimit=10&srsearch=${encodeURIComponent(term)}`,
      ),
      { bucket: "fallback", perSecond: PER_SECOND, acceptStatus: [404] },
    );
    return (payload.query?.search ?? []).map((hit) => hit.title);
  } catch {
    return [];
  }
}

/** Une page de personnage acceptable : titre concordant, pas d'homonymie. */
function acceptablePage(page: PageInfo, cardName: string): boolean {
  if (page.missing !== undefined) return false;
  if (page.pageprops && "disambiguation" in page.pageprops) return false;
  if (/\(disambiguation\)$/i.test(page.title) || /\(homonymie\)$/i.test(page.title)) return false;
  if (/^(category|file|template|list of)\b/i.test(page.title)) return false;
  return nameMatches(cardName, [page.title]);
}

/**
 * Page du personnage sur le wiki : titre exact d'abord, puis résultats de
 * recherche filtrés par le nom. La première page qui répond et dont le titre
 * correspond est retenue.
 */
export async function findCharacterPage(
  api: string,
  cardName: string,
): Promise<{ page: PageInfo; title: string } | null> {
  const exact = await pageInfo(api, cardName);
  if (exact && acceptablePage(exact, cardName)) return { page: exact, title: exact.title };

  const titles = await searchTitles(api, cardName);
  const ordered = [...new Set(titles)]
    .filter((title) => nameMatches(cardName, [title]))
    .sort((a, b) => {
      const exactA = normalize(baseName(a)) === normalize(cardName) ? 0 : 1;
      const exactB = normalize(baseName(b)) === normalize(cardName) ? 0 : 1;
      return exactA - exactB || a.length - b.length || a.localeCompare(b, "en");
    });

  for (const title of ordered) {
    if (normalize(title) === normalize(cardName) && exact) continue;
    const page = await pageInfo(api, title);
    if (page && acceptablePage(page, cardName)) return { page, title: page.title };
  }
  return null;
}

type BacklinksPayload = {
  query?: { backlinks?: { title: string }[] };
  continue?: { blcontinue?: string };
};

/**
 * Nombre de pages (namespace principal) qui renvoient vers la page.
 * Plafonné à 10 000 pour borner le temps de réponse ; le drapeau `capped` est
 * conservé dans les données pour ne pas présenter un minorant comme exact.
 */
export async function countBacklinks(api: string, title: string): Promise<{ count: number; capped: boolean }> {
  let count = 0;
  let continuation: string | undefined;
  let pages = 0;
  do {
    const suffix = continuation ? `&blcontinue=${encodeURIComponent(continuation)}` : "";
    const payload = await wikiJson<BacklinksPayload>(
      apiUrl(
        api,
        `action=query&format=json&origin=*&list=backlinks&bltitle=${encodeURIComponent(title)}&blnamespace=0&bllimit=max${suffix}`,
      ),
      { bucket: "fallback", perSecond: PER_SECOND, acceptStatus: [404] },
    );
    count += payload.query?.backlinks?.length ?? 0;
    continuation = payload.continue?.blcontinue;
    pages += 1;
  } while (continuation && pages < 20);
  return { count, capped: Boolean(continuation) };
}

/** Percentiles avec rangs moyens pour les ex aequo, de 0 à 1. */
export function percentileRanks(values: Map<string, number>): Map<string, number> {
  const sorted = [...values]
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => a.value - b.value || a.id.localeCompare(b.id, "en", { numeric: true }));
  const out = new Map<string, number>();
  const n = sorted.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(sorted[0].id, 1);
    return out;
  }

  let start = 0;
  while (start < n) {
    let end = start + 1;
    while (end < n && sorted[end].value === sorted[start].value) end += 1;
    const percentile = (start + end - 1) / 2 / (n - 1);
    for (let index = start; index < end; index += 1) out.set(sorted[index].id, percentile);
    start = end;
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function emptyFallback(reason: string, wikiHost: string | null = null): FallbackData {
  return {
    method: "franchise",
    wikiHost,
    page: null,
    backlinks: null,
    pageSize: null,
    backlinksPercentile: null,
    pageSizePercentile: null,
    withinFranchiseScore: null,
    reason,
  };
}

async function inspectCard(card: CardEntry, wiki: WikiReference): Promise<FallbackData> {
  const found = await findCharacterPage(wiki.api, card.name);
  if (!found) {
    return emptyFallback(`page introuvable sur ${wiki.host}`, wiki.host);
  }

  const backlinks = await countBacklinks(wiki.api, found.title).catch(() => null);
  const info = found.page;
  if (!backlinks || info.length === undefined) {
    return emptyFallback(
      `mesures incomplètes sur ${wiki.host} (page « ${found.title} »)`,
      wiki.host,
    );
  }

  return {
    method: "wiki",
    wikiHost: wiki.host,
    page: found.title,
    backlinks: backlinks.count,
    pageSize: info.length,
    backlinksPercentile: null,
    pageSizePercentile: null,
    withinFranchiseScore: null,
    reason: `page « ${found.title} » de ${wiki.host} (${backlinks.count} liens, ${info.length} octets)${backlinks.capped ? " — backlinks plafonnés à 10 000" : ""}`,
  };
}

/**
 * Complète le jeu de données en place : découverte des wikis, mesures des
 * pages, percentiles internes. Retourne un récapitulatif pour le rapport.
 */
export async function enrichFallbacks(
  dataset: Dataset,
  options: { refresh?: boolean; log?: (line: string) => void } = {},
): Promise<{ cards: number; withWiki: number; withoutWiki: number; withoutPage: number }> {
  const log = options.log ?? (() => undefined);
  const pending = dataset.cards.filter((card) => card.matchStatus !== "auto");
  if (pending.length === 0) return { cards: 0, withWiki: 0, withoutWiki: 0, withoutPage: 0 };

  const groups = new Map<string, CardEntry[]>();
  for (const card of pending) {
    const list = groups.get(card.franchiseId) ?? [];
    list.push(card);
    groups.set(card.franchiseId, list);
  }

  const qids = [...groups.keys()]
    .map((id) => dataset.franchises.find((franchise) => franchise.id === id)?.wikidataId)
    .filter((qid): qid is string => Boolean(qid));
  const official = await fetchOfficialWebsites(qids);

  let withWiki = 0;
  let withoutWiki = 0;
  let withoutPage = 0;

  for (const [franchiseId, cards] of groups) {
    const franchise = dataset.franchises.find((entry) => entry.id === franchiseId);
    if (!franchise) {
      for (const card of cards) card.fallback = emptyFallback("franchise absente du jeu de données");
      withoutWiki += cards.length;
      continue;
    }

    const wiki = await discoverWiki(
      franchise,
      (franchise.wikidataId ? official.get(franchise.wikidataId) : undefined) ?? [],
      options.refresh,
    );
    if (!wiki) {
      for (const card of cards) card.fallback = emptyFallback("wiki de la franchise introuvable");
      withoutWiki += cards.length;
      log(`  ${franchise.name} : wiki introuvable (${cards.length} carte(s))`);
      continue;
    }

    withWiki += cards.length;
    let misses = 0;
    await mapLimit(cards, 4, async (card) => {
      const previous = card.fallback;
      if (!options.refresh && previous && previous.wikiHost === wiki.host) {
        const measured =
          previous.method === "wiki" &&
          previous.page &&
          previous.backlinks !== null &&
          previous.pageSize !== null;
        const knownMiss =
          previous.method === "franchise" &&
          /page introuvable|mesures incomplètes/.test(previous.reason);
        if (measured || knownMiss) return;
      }
      card.fallback = await inspectCard(card, wiki);
      if (card.fallback.method !== "wiki") misses += 1;
    });
    withoutPage += misses;

    const measured = cards.filter(
      (card) =>
        card.fallback?.method === "wiki" &&
        card.fallback.backlinks !== null &&
        card.fallback.pageSize !== null,
    );
    const backlinksRanks = percentileRanks(
      new Map(measured.map((card) => [card.id, Math.log10(1 + (card.fallback!.backlinks ?? 0))])),
    );
    const sizeRanks = percentileRanks(
      new Map(measured.map((card) => [card.id, Math.log10(1 + (card.fallback!.pageSize ?? 0))])),
    );

    for (const card of measured) {
      const backlinks = backlinksRanks.get(card.id) ?? 0;
      const size = sizeRanks.get(card.id) ?? 0;
      const internal =
        Math.round(
          (backlinks * FALLBACK_WEIGHTS.backlinks + size * FALLBACK_WEIGHTS.pageSize) * 10000,
        ) / 100;
      card.fallback!.backlinksPercentile = Math.round(backlinks * 10000) / 10000;
      card.fallback!.pageSizePercentile = Math.round(size * 10000) / 10000;
      card.fallback!.withinFranchiseScore = internal;
    }

    log(
      `  ${franchise.name} : ${cards.length} carte(s), ${measured.length} page(s) mesurée(s) sur ${wiki.host}`,
    );
  }

  return { cards: pending.length, withWiki, withoutWiki, withoutPage };
}
