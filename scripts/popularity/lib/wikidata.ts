/**
 * Requêtes Wikidata utilisées par le chantier « rareté par popularité ».
 *
 * Deux API, toutes deux en lecture seule :
 *   • `wbsearchentities` — trouver des entités candidates par nom ;
 *   • SPARQL — lire types, œuvres, personnages et nombre de langues.
 *   • `wbgetentities` avec `sitefilter` — titres d'articles exacts, par langue.
 *
 * Aucun texte d'article n'est téléchargé : uniquement des identifiants, des
 * titres et des nombres.
 */

import { LANGUAGES } from "../../../src/lib/rarity-distribution.config";
import { wikiJson } from "./http";

const API = "https://www.wikidata.org/w/api.php";
const SPARQL = "https://query.wikidata.org/sparql";

/** Wikipédia par langue, pour le second recours « nom + franchise ». */
export function wikipediaApi(lang: string): string {
  return `https://${lang}.wikipedia.org/w/api.php`;
}

const LANG_FILTER = LANGUAGES.map((lang) => `"${lang}"`).join(", ");

/** Classes Wikidata utilisées par le barème. */
export const CLASSES = {
  fictionalCharacter: "Q95074",
  disambiguation: "Q4167410",
  list: "Q13406463",
  work: "Q386724",
  videoGame: "Q7889",
  videoGameSeries: "Q7058673",
  mediaFranchise: "Q196600",
  fictionalUniverse: "Q559618",
  televisionSeries: "Q5398426",
  filmSeries: "Q24856",
} as const;

export type SearchHit = { id: string; label: string; description: string; match: string };

/** Recherche d'entités par nom, dans une langue donnée. */
export async function searchEntities(term: string, lang: string, limit = 10): Promise<SearchHit[]> {
  const url =
    `${API}?action=wbsearchentities&format=json&origin=*&type=item&limit=${limit}` +
    `&language=${encodeURIComponent(lang)}&uselang=${encodeURIComponent(lang)}&search=${encodeURIComponent(term)}`;

  const payload = await wikiJson<{
    search?: { id: string; label?: string; description?: string; match?: { text?: string; type?: string } }[];
  }>(url, { bucket: "api", perSecond: 20, acceptStatus: [404] });

  return (payload.search ?? []).map((hit) => ({
    id: hit.id,
    label: hit.label ?? "",
    description: hit.description ?? "",
    match: hit.match?.text ?? hit.match?.type ?? "",
  }));
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function values(qids: string[]): string {
  return qids.map((qid) => `wd:${qid}`).join(" ");
}

async function sparql<T = Record<string, { value: string }>>(query: string): Promise<T[]> {
  const url = `${SPARQL}?format=json&query=${encodeURIComponent(query)}`;
  const payload = await wikiJson<{ results?: { bindings?: T[] } }>(url, {
    bucket: "sparql",
    perSecond: 2,
  });
  return payload.results?.bindings ?? [];
}

/** Faits bruts sur une entité Wikidata. */
export type EntityFacts = {
  id: string;
  labels: string[];
  descriptions: string[];
  sitelinks: number;
  works: string[];
  isFictionalCharacter: boolean;
  isDisambiguation: boolean;
  isList: boolean;
  isWork: boolean;
  isVideoGame: boolean;
  isSeries: boolean;
  isFranchise: boolean;
  isUniverse: boolean;
};

type TypeRow = { item: { value: string }; type: { value: string } };
type WorkRow = { item: { value: string }; workItem: { value: string } };

/**
 * Ascendants (`P279`) d'une classe Wikidata, mémorisés pour la session.
 * Les requêtes `EXISTS { ?item wdt:P31/wdt:P279* … }` sont trop lentes sur de
 * gros lots : on lit les types une fois, puis on remonte la hiérarchie ici.
 */
const ancestors = new Map<string, Set<string>>();

function shortId(value: string): string {
  return value.split("/").pop()!;
}

async function ensureAncestors(types: string[]): Promise<void> {
  const missing = [...new Set(types.map(shortId))].filter((type) => !ancestors.has(type));
  if (missing.length === 0) return;

  for (const type of missing) ancestors.set(type, new Set());

  const answered = new Set<string>();
  for (const group of chunks(missing, 100)) {
    const rows = await sparql<{ type: { value: string }; ancestor: { value: string } }>(
      `SELECT ?type ?ancestor WHERE {
         VALUES ?type { ${values(group)} }
         ?type wdt:P279+ ?ancestor .
       }`,
    );
    for (const row of rows) {
      const type = shortId(row.type.value);
      answered.add(type);
      ancestors.get(type)?.add(shortId(row.ancestor.value));
    }
  }

  // Un lot revenu vide ou tronqué laisserait des types sans hiérarchie : la
  // classe « personnage fictif » ne serait alors jamais reconnue. Les types
  // sans réponse sont redemandés seuls, un par un (une classe racine répond
  // légitimement vide).
  const silent = missing.filter((type) => !answered.has(type));
  if (silent.length <= 50) {
    for (const type of silent) {
      const rows = await sparql<{ ancestor: { value: string } }>(
        `SELECT ?ancestor WHERE { wd:${type} wdt:P279+ ?ancestor . }`,
      );
      for (const row of rows) ancestors.get(type)?.add(shortId(row.ancestor.value));
    }
  }
}

/** Le type (ou l'un de ses ancêtres) est-il `root` ? */
function hasAncestor(type: string, root: string): boolean {
  const id = shortId(type);
  return id === root || Boolean(ancestors.get(id)?.has(root));
}

/** Liens de site qui ne sont pas des Wikipédia linguistiques. */
const NON_WIKIPEDIA = new Set([
  "commonswiki",
  "specieswiki",
  "metawiki",
  "incubatorwiki",
  "sourceswiki",
  "mediawikiwiki",
  "wikidatawiki",
  "outreachwiki",
  "foundationwiki",
]);

export type EntityInfo = { labels: string[]; descriptions: string[]; sitelinks: number };

/**
 * Libellés, alias, descriptions et nombre de Wikipédia linguistiques, lus par
 * `wbgetentities` (50 identifiants par requête, réponse complète).
 */
export async function fetchEntityInfo(qids: string[]): Promise<Map<string, EntityInfo>> {
  const info = new Map<string, EntityInfo>();
  const languages = LANGUAGES.join("|");

  for (const group of chunks([...new Set(qids)], 50)) {
    const url =
      `${API}?action=wbgetentities&format=json&origin=*` +
      `&props=labels%7Caliases%7Cdescriptions%7Csitelinks&languages=${languages}` +
      `&ids=${group.join("|")}`;
    const payload = await wikiJson<{
      entities?: Record<
        string,
        {
          labels?: Record<string, { value: string }>;
          aliases?: Record<string, { value: string }[]>;
          descriptions?: Record<string, { value: string }>;
          sitelinks?: Record<string, unknown>;
        }
      >;
    }>(url, { bucket: "api", perSecond: 20, acceptStatus: [404] });

    for (const [qid, entity] of Object.entries(payload.entities ?? {})) {
      const labels = Object.values(entity.labels ?? {}).map((label) => label.value);
      const aliases = Object.values(entity.aliases ?? {}).flatMap((list) => list.map((alias) => alias.value));
      const descriptions = Object.values(entity.descriptions ?? {}).map((description) => description.value);
      const sitelinks = Object.keys(entity.sitelinks ?? {}).filter(
        (site) => site !== "commonswiki" && !NON_WIKIPEDIA.has(site) && site.endsWith("wiki"),
      ).length;
      info.set(qid, { labels: [...labels, ...aliases], descriptions, sitelinks });
    }
  }

  return info;
}

/**
 * Récupère les faits de plusieurs entités : libellés et alias (6 langues),
 * descriptions, nombre de langues, types et œuvres d'appartenance.
 */
export async function fetchFacts(qids: string[]): Promise<Map<string, EntityFacts>> {
  const facts = new Map<string, EntityFacts>();
  const unique = [...new Set(qids.filter((qid) => /^Q\d+$/.test(qid)))];

  const blank = (id: string): EntityFacts => ({
    id,
    labels: [],
    descriptions: [],
    sitelinks: 0,
    works: [],
    isFictionalCharacter: false,
    isDisambiguation: false,
    isList: false,
    isWork: false,
    isVideoGame: false,
    isSeries: false,
    isFranchise: false,
    isUniverse: false,
  });

  const typesByItem = new Map<string, string[]>();
  const worksByItem = new Map<string, string[]>();

  // Libellés, alias, descriptions et nombre de langues : lus par l'API
  // `wbgetentities`, qui répond complet. Une requête SPARQL interrompue
  // renvoie un résultat partiel sans erreur : des libellés manquaient (« Final
  // Fantasy IX » n'avait que son libellé japonais), et le nom exact ne
  // correspondait plus. Les classes (`P31`) restent en SPARQL, par petits lots
  // vérifiés.
  const info = await fetchEntityInfo(unique);
  for (const [id, data] of info) {
    const entry = facts.get(id) ?? blank(id);
    entry.labels = [...new Set([...entry.labels, ...data.labels])];
    entry.descriptions = [...new Set([...entry.descriptions, ...data.descriptions])];
    entry.sitelinks = Math.max(entry.sitelinks, data.sitelinks);
    facts.set(id, entry);
  }

  const readTypes = async (group: string[]): Promise<void> => {
    const rows = await sparql<TypeRow>(
      `SELECT ?item ?type WHERE {
         VALUES ?item { ${values(group)} }
         ?item wdt:P31 ?type .
       }`,
    );
    for (const row of rows) {
      const id = shortId(row.item.value);
      const list = typesByItem.get(id) ?? [];
      const type = shortId(row.type.value);
      if (!list.includes(type)) list.push(type);
      typesByItem.set(id, list);
    }
  };

  for (const group of chunks(unique, 25)) await readTypes(group);

  // Un lot muet est redemandé par paquets minuscules : un item sans classe
  // reste sans classe, mais une requête tronquée est rattrapée.
  const silentTypes = unique.filter((id) => !typesByItem.has(id)).slice(0, 400);
  if (silentTypes.length) {
    for (const group of chunks(silentTypes, 4)) await readTypes(group);
  }

  for (const group of chunks(unique, 100)) {
    const workRows = await sparql<WorkRow>(
      `SELECT ?item ?workItem WHERE {
         VALUES ?item { ${values(group)} }
         ?item wdt:P1441 ?workItem .
       }`,
    );
    for (const row of workRows) {
      const id = shortId(row.item.value);
      const list = worksByItem.get(id) ?? [];
      const work = shortId(row.workItem.value);
      if (!list.includes(work)) list.push(work);
      worksByItem.set(id, list);
    }
  }

  await ensureAncestors([...typesByItem.values()].flat());

  for (const qid of unique) {
    const entry = facts.get(qid) ?? blank(qid);
    const types = typesByItem.get(qid) ?? [];
    entry.works = worksByItem.get(qid) ?? [];
    entry.isFictionalCharacter = types.some((type) => hasAncestor(type, CLASSES.fictionalCharacter));
    entry.isDisambiguation = types.some((type) => hasAncestor(type, CLASSES.disambiguation));
    entry.isList = types.some((type) => hasAncestor(type, CLASSES.list));
    entry.isWork = types.some((type) => hasAncestor(type, CLASSES.work));
    entry.isVideoGame = types.some((type) => hasAncestor(type, CLASSES.videoGame));
    entry.isSeries = types.some((type) => hasAncestor(type, CLASSES.videoGameSeries));
    entry.isFranchise = types.some((type) => hasAncestor(type, CLASSES.mediaFranchise));
    entry.isUniverse = types.some((type) => hasAncestor(type, CLASSES.fictionalUniverse));
    facts.set(qid, entry);
  }

  return facts;
}

export type WorkFacts = { id: string; labels: string[]; series: string[] };

/** Libellés et séries (`P179`) des œuvres citées par les candidats. */
export async function fetchWorks(qids: string[]): Promise<Map<string, WorkFacts>> {
  const works = new Map<string, WorkFacts>();
  const unique = [...new Set(qids)];
  for (const group of chunks(unique, 100)) {
    const rows = await sparql<{ work: { value: string }; label?: { value: string }; series?: { value: string } }>(
      `SELECT ?work ?label ?series WHERE {
         VALUES ?work { ${values(group)} }
         OPTIONAL { ?work rdfs:label ?label . FILTER(lang(?label) IN (${LANG_FILTER})) }
         OPTIONAL { ?work wdt:P179 ?series }
       }`,
    );
    for (const row of rows) {
      const id = row.work.value.split("/").pop()!;
      const entry = works.get(id) ?? { id, labels: [], series: [] };
      if (row.label?.value) entry.labels.push(row.label.value);
      const series = row.series?.value?.split("/").pop();
      if (series && !entry.series.includes(series)) entry.series.push(series);
      works.set(id, entry);
    }
  }
  return works;
}

export type CharacterWorkFacts = {
  /** Œuvres d'appartenance : `P1441`, plus `P1080`/`P170` en secours. */
  works: string[];
};

/**
 * Œuvres d'appartenance d'un personnage, au-delà de `P1441` seul : beaucoup
 * de fiches anciennes n'ont que `P1080` (dans l'œuvre) ou `P170`. Sans cela,
 * le lien avec la franchise n'est jamais prouvé et la correspondance échoue.
 */
export async function fetchCharacterWorks(qids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const unique = [...new Set(qids)];
  for (const group of chunks(unique, 60)) {
    const rows = await sparql<{ item: { value: string }; work: { value: string } }>(
      `SELECT DISTINCT ?item ?work WHERE {
         VALUES ?item { ${values(group)} }
         { ?item wdt:P1441 ?work } UNION { ?item wdt:P1080 ?work } UNION { ?item wdt:P170 ?work }
       }`,
    );
    for (const row of rows) {
      const id = shortId(row.item.value);
      const work = shortId(row.work.value);
      const list = map.get(id) ?? [];
      if (!list.includes(work)) list.push(work);
      map.set(id, list);
    }
  }
  return map;
}

/** Personnages cités par une franchise (`P674`), par identifiant de franchise. */
export async function fetchFranchiseCharacters(franchiseQids: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  for (const group of chunks([...new Set(franchiseQids)], 40)) {
    const rows = await sparql<{ franchise: { value: string }; character: { value: string } }>(
      `SELECT ?franchise ?character WHERE {
         VALUES ?franchise { ${values(group)} }
         ?franchise wdt:P674 ?character .
       }`,
    );
    for (const row of rows) {
      const franchise = row.franchise.value.split("/").pop()!;
      const character = row.character.value.split("/").pop()!;
      const set = map.get(franchise) ?? new Set<string>();
      set.add(character);
      map.set(franchise, set);
    }
  }
  return map;
}

/** Œuvres rattachées à une franchise (`P179`), par identifiant de franchise. */
export async function fetchFranchiseWorks(franchiseQids: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  for (const group of chunks([...new Set(franchiseQids)], 40)) {
    const rows = await sparql<{ franchise: { value: string }; work: { value: string } }>(
      `SELECT ?franchise ?work WHERE {
         VALUES ?franchise { ${values(group)} }
         ?work wdt:P179 ?franchise .
       }`,
    );
    for (const row of rows) {
      const franchise = row.franchise.value.split("/").pop()!;
      const work = row.work.value.split("/").pop()!;
      const set = map.get(franchise) ?? new Set<string>();
      set.add(work);
      map.set(franchise, set);
    }
  }
  return map;
}

/**
 * Sites officiels (`P856`) d'une liste d'entités, par identifiant.
 *
 * Sert uniquement à trouver le wiki de la franchise quand aucun domaine
 * Fandom ne correspond : un site officiel qui expose une API MediaWiki est une
 * source de première main. Aucune URL n'est inventée à partir du nom.
 */
export async function fetchOfficialWebsites(qids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const group of chunks([...new Set(qids)], 100)) {
    const rows = await sparql<{ item: { value: string }; website: { value: string } }>(
      `SELECT ?item ?website WHERE {
         VALUES ?item { ${values(group)} }
         ?item wdt:P856 ?website .
       }`,
    );
    for (const row of rows) {
      const item = shortId(row.item.value);
      const list = map.get(item) ?? [];
      if (!list.includes(row.website.value)) list.push(row.website.value);
      map.set(item, list);
    }
  }
  return map;
}

/**
 * Recherche plein texte sur Wikipédia (second recours du cahier des charges :
 * « recherche Wikipédia nom + franchise »). Seuls les titres sont lus, jamais
 * le texte des articles.
 */
export async function searchWikipediaArticles(
  term: string,
  lang: string,
  limit = 5,
): Promise<string[]> {
  const url =
    `${wikipediaApi(lang)}?action=query&format=json&list=search&srnamespace=0&srlimit=${limit}` +
    `&srsearch=${encodeURIComponent(term)}`;
  const payload = await wikiJson<{ query?: { search?: { title: string }[] } }>(url, {
    bucket: "wikipedia",
    perSecond: 20,
    acceptStatus: [404],
  });
  return (payload.query?.search ?? []).map((hit) => hit.title);
}

/**
 * Identifiants Wikidata correspondant à des titres d'articles, par langue.
 * `wbgetentities` accepte jusqu'à 50 titres ; un titre absent de la réponse
 * n'a pas d'entité (redirection ou page sans élément).
 */
export async function entityIdsForTitles(
  lang: string,
  titles: string[],
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const group of chunks([...new Set(titles)], 40)) {
    const url =
      `${API}?action=wbgetentities&format=json&origin=*&props=sitelinks&sitefilter=${lang}wiki` +
      `&sites=${lang}wiki&titles=${encodeURIComponent(group.join("|"))}`;
    const payload = await wikiJson<{
      entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>;
    }>(url, { bucket: "api", perSecond: 20, acceptStatus: [404] });
    for (const [qid, entity] of Object.entries(payload.entities ?? {})) {
      if (qid.startsWith("-")) continue;
      const title = entity.sitelinks?.[`${lang}wiki`]?.title;
      if (title) found.set(title, qid);
    }
  }
  return found;
}

/**
 * Titres d'articles Wikipédia exacts, lus dans les sitelinks de l'entité.
 * Aucun titre n'est deviné : absent du résultat = pas d'article.
 */
export async function fetchArticleTitles(qids: string[]): Promise<Map<string, Record<string, string>>> {
  const titles = new Map<string, Record<string, string>>();
  const sites = LANGUAGES.map((lang) => `${lang}wiki`).join("|");
  const unique = [...new Set(qids)];

  for (const group of chunks(unique, 50)) {
    const url =
      `${API}?action=wbgetentities&format=json&origin=*&props=sitelinks&sitefilter=${sites}` +
      `&ids=${group.join("|")}`;
    const payload = await wikiJson<{
      entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>;
    }>(url, { bucket: "api", perSecond: 20 });

    for (const [qid, entity] of Object.entries(payload.entities ?? {})) {
      const perLang: Record<string, string> = {};
      for (const [site, link] of Object.entries(entity.sitelinks ?? {})) {
        const lang = site.replace(/wiki$/, "");
        if ((LANGUAGES as readonly string[]).includes(lang)) perLang[lang] = link.title;
      }
      titles.set(qid, perLang);
    }
  }

  return titles;
}
