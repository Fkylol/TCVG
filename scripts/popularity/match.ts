/**
 * Étape 2 — correspondance automatique personnage / entité Wikidata.
 *
 * Pour chaque carte : recherche d'entités par nom (en, fr, ja, es, de, pt),
 * puis, en second recours, « nom + franchise ». Chaque candidat est noté sur
 * le barème du cahier des charges (nom exact 0,40 · personnage fictif 0,20 ·
 * lien avec la franchise 0,30 · article Wikipédia 0,10). Un candidat n'est
 * retenu qu'au-dessus du seuil ET avec l'écart minimal sur le deuxième.
 *
 *   npm run popularity:match            (conserve les correspondances auto, réinterroge les replis)
 *   npm run popularity:match -- --fresh (oublie le jeu de données local et réapparie tout)
 *
 * Aucune donnée n'est inventée : un candidat sans preuve reste à 0, un
 * personnage sans correspondance passe en `aucun` (règle de repli à l'étape 4).
 */

import {
  chooseMatch,
  nameVariants,
  normalizeName,
  scoreMatch,
  type MatchChoice,
  type MatchFacts,
  type MatchScore,
} from "../../src/lib/popularity";
import { LANGUAGES, MATCH_MARGIN, MATCH_THRESHOLD } from "../../src/lib/rarity-distribution.config";
import {
  datasetPath,
  loadDataset,
  loadSources,
  saveDataset,
  type CardEntry,
  type Dataset,
  type FranchiseEntry,
} from "./lib/dataset";
import { netStats, netSummary } from "./lib/http";
import {
  entityIdsForTitles,
  fetchArticleTitles,
  fetchCharacterWorks,
  fetchFacts,
  fetchFranchiseCharacters,
  fetchFranchiseWorks,
  fetchWorks,
  searchEntities,
  searchWikipediaArticles,
  type EntityFacts,
  type WorkFacts,
} from "./lib/wikidata";

const FRESH = process.argv.includes("--fresh");

/** Nom court et normalisé, pour repérer une franchise citée dans un texte. */
function cites(text: string, franchise: string): boolean {
  const needle = normalizeName(franchise);
  if (needle.length < 4) return false;
  const haystack = ` ${normalizeName(text)} `;
  return haystack.includes(` ${needle} `);
}

/**
 * La franchise porte-t-elle le nom du personnage (« Sonic », « Kirby ») ?
 * Dans ce cas, un titre ou une description qui cite la franchise ne prouve
 * rien : c'est le nom du personnage lui-même qui apparaît.
 */
function selfTitled(franchiseName: string, cardName: string): boolean {
  const franchise = normalizeName(franchiseName);
  if (franchise.length < 4) return true;
  return ` ${normalizeName(cardName)} `.includes(` ${franchise} `);
}

/** Exécute `fn` sur chaque élément, `limit` à la fois, en gardant l'ordre. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

type FranchiseAnchor = {
  entry: FranchiseEntry;
  /** Entités qui représentent la franchise (elle-même et sa série). */
  anchors: Set<string>;
  /** Œuvres de la franchise (`P179`). */
  works: Set<string>;
  /** Personnages cités par la franchise (`P674`). */
  characters: Set<string>;
};

/**
 * Franchise → entité Wikidata. On n'accepte qu'un libellé exact (ou le titre du
 * jeu de base quand la franchise porte un sous-titre) et un type plausible :
 * jeu vidéo, série de jeux, franchise, univers de fiction.
 */
async function resolveFranchises(franchises: FranchiseEntry[]): Promise<Map<string, FranchiseAnchor>> {
  const searches = await mapLimit(franchises, 8, async (franchise) => {
    const hits = new Map<string, string>();
    for (const lang of ["en", "fr"]) {
      for (const hit of await searchEntities(franchise.name, lang, 8)) hits.set(hit.id, hit.label);
    }
    return [...hits.keys()].slice(0, 20);
  });

  const all = searches.flat();
  const facts = await fetchFacts(all);
  const franchiseTitles = await fetchArticleTitles(all);

  const evaluate = (
    franchise: FranchiseEntry,
    ids: string[],
    pool: Map<string, EntityFacts>,
  ): { id: string; score: number; label: string } | null => {
    const wanted = normalizeName(franchise.name);
    let best: { id: string; score: number; label: string } | null = null;

    for (const qid of ids) {
      const fact = pool.get(qid);
      if (!fact) continue;
      if (!(fact.isVideoGame || fact.isSeries || fact.isFranchise || fact.isUniverse)) continue;

      // Libellé ou titre d'article : les deux nomment l'œuvre.
      const labels = [
        ...fact.labels,
        ...Object.values(franchiseTitles.get(qid) ?? {}),
      ].map(normalizeName);
      const exact = labels.includes(wanted);
      // « Clair Obscur » → « Clair Obscur: Expedition 33 » : le titre du jeu de
      // base commence par le nom de la franchise.
      const prefixed = labels.some((label) => label.startsWith(`${wanted}:`) || label.startsWith(`${wanted} `));
      if (!exact && !prefixed) continue;

      // Un jeu isolé et sa série portent souvent le même libellé (« God of
      // War ») : la série, la franchise ou l'univers passent devant, sinon les
      // œuvres rattachées à la série ne sont jamais reconnues.
      const umbrella = fact.isSeries || fact.isFranchise || fact.isUniverse ? 0.2 : 0;
      const score = (exact ? 1 : 0.6) + umbrella + Math.min(fact.sitelinks, 60) / 100;
      if (!best || score > best.score) best = { id: qid, score, label: fact.labels[0] ?? qid };
    }
    return best;
  };

  // Quelques lots SPARQL reviennent vides sous charge : une franchise sans
  // entité est revérifiée seule, sur un lot minuscule, avant d'être déclarée
  // introuvable.
  const missing = franchises.filter((franchise) => {
    const index = franchises.indexOf(franchise);
    return !evaluate(franchise, searches[index], facts);
  });
  if (missing.length) {
    console.log(`→ ${missing.length} franchise(s) revérifiée(s) individuellement…`);
    for (const franchise of missing) {
      const index = franchises.indexOf(franchise);
      const retry = await fetchFacts(searches[index]);
      for (const [id, fact] of retry) facts.set(id, fact);
    }
  }

  const anchors = new Map<string, FranchiseAnchor>();
  franchises.forEach((franchise, index) => {
    const best = evaluate(franchise, searches[index], facts);

    const entry: FranchiseEntry = {
      ...franchise,
      wikidataId: best?.id ?? null,
      confidence: best ? (best.score >= 1 ? 1 : 0.7) : 0,
      notes: best
        ? [`entité ${best.id} « ${best.label} »`]
        : ["aucune entité de type jeu, série, franchise ou univers trouvée"],
    };
    anchors.set(franchise.id, {
      entry,
      anchors: new Set(best ? [best.id] : []),
      works: new Set(),
      characters: new Set(),
    });
  });

  // Séries parentes (Final Fantasy IX → Final Fantasy) et œuvres rattachées.
  const ids = [...anchors.values()].flatMap((anchor) => [...anchor.anchors]);
  const series = await fetchWorks(ids);
  for (const anchor of anchors.values()) {
    for (const id of [...anchor.anchors]) {
      for (const parent of series.get(id)?.series ?? []) anchor.anchors.add(parent);
    }
  }

  const parents = [...new Set([...anchors.values()].flatMap((anchor) => [...anchor.anchors]))];
  const franchiseWorks = await fetchFranchiseWorks(parents);
  const franchiseCharacters = await fetchFranchiseCharacters(parents);
  for (const anchor of anchors.values()) {
    for (const id of anchor.anchors) {
      for (const work of franchiseWorks.get(id) ?? []) anchor.works.add(work);
      for (const character of franchiseCharacters.get(id) ?? []) anchor.characters.add(character);
      // L'entité de la franchise est elle-même une œuvre de la franchise.
      anchor.works.add(id);
    }
  }

  return anchors;
}

type CardCandidates = { card: CardEntry; ids: Set<string>; terms: string[] };

async function collectCandidates(cards: CardEntry[]): Promise<CardCandidates[]> {
  type Job = { card: CardEntry; lang: string; term: string };
  const jobs: Job[] = [];

  for (const card of cards) {
    nameVariants(card.name).forEach((term, index) => {
      const langs = index === 0 ? LANGUAGES : ["en", "fr"];
      for (const lang of langs) jobs.push({ card, lang, term });
    });
  }

  const perCard = new Map<string, CardCandidates>();
  for (const card of cards) perCard.set(card.id, { card, ids: new Set<string>(), terms: [] });

  let done = 0;
  await mapLimit(jobs, 8, async (job) => {
    const hits = await searchEntities(job.term, job.lang);
    const entry = perCard.get(job.card.id)!;
    for (const hit of hits) entry.ids.add(hit.id);
    if (!entry.terms.includes(`${job.lang}:${job.term}`)) entry.terms.push(`${job.lang}:${job.term}`);
    done += 1;
    if (done % 250 === 0) process.stdout.write(`  ${done}/${jobs.length} recherches\r`);
  });

  return cards.map((card) => perCard.get(card.id)!);
}

/**
 * Second recours : « nom + franchise » cherché cette fois sur Wikipédia, langue
 * par langue. `wbsearchentities` ne fait pas de recherche plein texte (deux
 * mots n'y renvoient rien) : la recherche d'articles est le seul moyen de
 * trouver « Freya (God of War) » ou « Hunter (Spyro) ». Les titres trouvés sont
 * ensuite résolus en identifiants Wikidata ; aucun titre n'est deviné.
 */
async function secondaryCandidates(entries: CardCandidates[]): Promise<void> {
  type Job = { entry: CardCandidates; lang: string; term: string };
  const jobs: Job[] = [];
  for (const entry of entries) {
    for (const term of [`${entry.card.name} ${entry.card.franchiseName}`, entry.card.name]) {
      for (const lang of LANGUAGES) jobs.push({ entry, lang, term });
    }
  }

  /** Titres trouvés par tâche, et titres à résoudre par langue. */
  const found = new Map<Job, string[]>();
  const perLang = new Map<string, Set<string>>();

  await mapLimit(jobs, 8, async (job) => {
    const titles = await searchWikipediaArticles(job.term, job.lang, 5);
    found.set(job, titles);
    const set = perLang.get(job.lang) ?? new Set<string>();
    for (const title of titles) set.add(title);
    perLang.set(job.lang, set);
    const label = `${job.lang}:wp:${job.term}`;
    if (!job.entry.terms.includes(label)) job.entry.terms.push(label);
  });

  // Résolution titre → identifiant, langue par langue, puis rattachement à la
  // carte qui avait réellement essayé ce terme.
  const resolved = new Map<string, string>();
  for (const [lang, set] of perLang) {
    for (const [title, qid] of await entityIdsForTitles(lang, [...set])) {
      resolved.set(`${lang}\u0000${title}`, qid);
    }
  }

  for (const [job, titles] of found) {
    for (const title of titles) {
      const qid = resolved.get(`${job.lang}\u0000${title}`);
      if (qid) job.entry.ids.add(qid);
    }
  }
}

function factsFor(
  fact: EntityFacts,
  anchor: FranchiseAnchor | undefined,
  card: CardEntry,
  titles: Map<string, Record<string, string>>,
): MatchFacts {
  const franchiseName = card.franchiseName;
  const articleTitles = Object.values(titles.get(fact.id) ?? {});
  // Le libellé d'une entité ne prouve jamais le lien avec sa franchise :
  // « Onsoku no Sonic » contient « Sonic » sans appartenir à la série Sonic.
  const mentionsFranchise =
    !selfTitled(franchiseName, card.name) &&
    (fact.descriptions.some((description) => cites(description, franchiseName)) ||
      articleTitles.some((title) => cites(title, franchiseName)));

  return {
    id: fact.id,
    labels: fact.labels,
    descriptions: fact.descriptions,
    articleTitles,
    isFictionalCharacter: fact.isFictionalCharacter,
    hasWikipediaArticle: fact.sitelinks > 0,
    inFranchiseWork: anchor ? fact.works.some((work) => anchor.works.has(work)) : false,
    listedByFranchise: anchor ? anchor.characters.has(fact.id) : false,
    mentionsFranchise,
    rejected: fact.isDisambiguation || fact.isList || fact.isWork || fact.isVideoGame,
    sitelinks: fact.sitelinks,
  };
}

function scoreCard(
  card: CardEntry,
  ids: Set<string>,
  facts: Map<string, EntityFacts>,
  anchor: FranchiseAnchor | undefined,
  titles: Map<string, Record<string, string>>,
): { scores: MatchScore[]; choice: MatchChoice } {
  const scores = [...ids]
    .map((id) => facts.get(id))
    .filter((fact): fact is EntityFacts => Boolean(fact))
    .map((fact) => scoreMatch(factsFor(fact, anchor, card, titles), card.name));
  return { scores, choice: chooseMatch(scores) };
}

/** Ajoute les nouvelles entités et leurs œuvres au cache de session. */
async function enrich(
  ids: string[],
  facts: Map<string, EntityFacts>,
  works: Map<string, WorkFacts>,
  anchors: Map<string, FranchiseAnchor>,
): Promise<Map<string, Record<string, string>>> {
  const fresh = ids.filter((id) => !facts.has(id));
  if (fresh.length === 0) return new Map();

  const extraFacts = await fetchFacts(fresh);
  for (const [id, fact] of extraFacts) facts.set(id, fact);

  // `P1441` seul rate beaucoup de fiches : on complète avec `P1080` / `P170`.
  const characterWorks = await fetchCharacterWorks(fresh);
  for (const [id, list] of characterWorks) {
    const fact = facts.get(id);
    if (!fact) continue;
    for (const work of list) if (!fact.works.includes(work)) fact.works.push(work);
  }

  const workIds = [...new Set([...extraFacts.values()].flatMap((fact) => fact.works))];
  const extraWorks = await fetchWorks(workIds);
  for (const [id, work] of extraWorks) {
    works.set(id, work);
    for (const parent of work.series) {
      for (const anchor of anchors.values()) anchor.anchors.add(parent);
    }
  }

  return fetchArticleTitles(fresh);
}

async function main() {
  const started = Date.now();
  const sources = await loadSources();

  let dataset: Dataset;
  let previousCards = new Map<string, CardEntry>();
  let previousFranchises = new Map<string, FranchiseEntry>();
  if (!FRESH) {
    try {
      dataset = await loadDataset();
      previousCards = new Map(dataset.cards.map((card) => [card.id, card]));
      previousFranchises = new Map(dataset.franchises.map((franchise) => [franchise.id, franchise]));
    } catch {
      dataset = {
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        franchises: [],
        cards: [],
      };
    }
  } else {
    dataset = {
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      franchises: [],
      cards: [],
    };
  }

  // Les correspondances automatiques déjà obtenues ne sont pas repayées : on
  // ne réinterroge que les cartes nouvelles ou en repli. Les cartes supprimées
  // (sans image) disparaissent d'elles-mêmes, `sources` ne les contient plus.
  const kept = new Map<string, CardEntry>();
  const todo: CardEntry[] = [];
  for (const card of sources.cards) {
    const old = previousCards.get(card.id);
    if (!FRESH && old?.matchStatus === "auto") {
      kept.set(card.id, {
        ...old,
        name: card.name,
        universe: card.universe,
        rarity: card.rarity,
        number: card.number,
        franchiseId: card.franchiseId,
        franchiseSlug: card.franchiseSlug,
        franchiseName: card.franchiseName,
        rarityOverride: card.rarityOverride,
        rarityLocked: card.rarityLocked,
        fallback: null,
      });
    } else {
      todo.push(card);
    }
  }
  dataset.cards = sources.cards.map((card) => kept.get(card.id) ?? card);

  console.log(
    `→ cartes : ${sources.cards.length}, franchises : ${sources.franchises.length} · ${kept.size} correspondance(s) auto conservée(s), ${todo.length} à apparier`,
  );

  console.log("→ franchises : recherche des entités…");
  const anchors = await resolveFranchises(sources.franchises);
  dataset.franchises = sources.franchises.map((franchise) => anchors.get(franchise.id)!.entry);
  for (const franchise of dataset.franchises) {
    const old = previousFranchises.get(franchise.id);
    if (old?.wiki !== undefined) franchise.wiki = old.wiki;
  }

  console.log("→ candidats : recherche par nom…");
  const candidates = await collectCandidates(todo);

  console.log("→ faits Wikidata…");
  const facts = await fetchFacts([...new Set(candidates.flatMap((entry) => [...entry.ids]))]);
  const titles = await fetchArticleTitles([...facts.keys()]);
  const characterWorks = await fetchCharacterWorks([...facts.keys()]);
  for (const [id, list] of characterWorks) {
    const fact = facts.get(id);
    if (!fact) continue;
    for (const work of list) if (!fact.works.includes(work)) fact.works.push(work);
  }
  const works = await fetchWorks([...new Set([...facts.values()].flatMap((fact) => fact.works))]);

  const anchorOf = (card: CardEntry) => anchors.get(card.franchiseId);

  // Premier passage.
  const results = new Map<string, MatchChoice>();
  for (const entry of candidates) {
    results.set(
      entry.card.id,
      scoreCard(entry.card, entry.ids, facts, anchorOf(entry.card), titles).choice,
    );
  }

  const rejected = candidates.filter((entry) => !results.get(entry.card.id)!.accepted);
  console.log(`→ second recours pour ${rejected.length} carte(s)…`);
  if (rejected.length) {
    await secondaryCandidates(rejected);
    const extraTitles = await enrich(
      [...new Set(rejected.flatMap((entry) => [...entry.ids]))],
      facts,
      works,
      anchors,
    );
    for (const [id, perLang] of extraTitles) titles.set(id, perLang);
    for (const entry of rejected) {
      results.set(
        entry.card.id,
        scoreCard(entry.card, entry.ids, facts, anchorOf(entry.card), titles).choice,
      );
    }
  }

  // Écriture du jeu de données.
  for (const entry of candidates) {
    const choice = results.get(entry.card.id)!;
    const best = choice.best;
    const fact = best ? facts.get(best.id) : undefined;
    const card: CardEntry = { ...entry.card };

    if (best && fact && choice.accepted) {
      card.wikidataId = best.id;
      card.matchStatus = "auto";
      card.matchConfidence = best.score;
      card.sitelinksCount = fact.sitelinks;
      card.matchNotes = {
        attempts: entry.terms.slice(0, 14),
        chosen: `${best.id} — ${fact.labels[0] ?? "?"} (${fact.descriptions[0] ?? "sans description"})`,
        runnerUp: choice.second ? `${choice.second.id} (${choice.second.score})` : undefined,
        evidence: best.reasons,
        notes: [
          `retenu avec ${best.score} (seuil ${MATCH_THRESHOLD}, écart minimal ${MATCH_MARGIN})`,
          ...(choice.second ? [`écart avec le deuxième : ${(best.score - choice.second.score).toFixed(3)}`] : []),
          ...(fact.isWork || fact.isVideoGame ? ["candidat écarté mais retenu : type œuvre"] : []),
        ],
      };
    } else {
      card.wikidataId = null;
      card.matchStatus = "aucun";
      card.matchConfidence = best?.score ?? 0;
      card.sitelinksCount = null;
      card.matchNotes = {
        attempts: entry.terms.slice(0, 14),
        chosen: best ? `${best.id} (refusé)` : undefined,
        runnerUp: choice.second ? `${choice.second.id} (${choice.second.score})` : undefined,
        evidence: best?.reasons,
        notes: [
          best
            ? `meilleur candidat à ${best.score} : sous le seuil de ${MATCH_THRESHOLD} ou trop proche du suivant`
            : "aucun candidat de type personnage",
          ...(fact?.isWork || fact?.isVideoGame ? ["candidat écarté : œuvre ou jeu, pas un personnage"] : []),
          ...(fact?.isDisambiguation ? ["candidat écarté : page d'homonymie"] : []),
          ...(fact?.isList ? ["candidat écarté : page de liste"] : []),
        ],
      };
    }

    const index = dataset.cards.findIndex((item) => item.id === card.id);
    if (index >= 0) dataset.cards[index] = card;
    else dataset.cards.push(card);
  }

  console.log("→ titres d'articles des entités retenues…");
  const franchiseTitles = await fetchArticleTitles([
    ...new Set(dataset.franchises.filter((franchise) => franchise.wikidataId).map((franchise) => franchise.wikidataId!)),
  ]);

  for (const card of dataset.cards) {
    if (card.wikidataId) card.wikipediaTitles = titles.get(card.wikidataId) ?? {};
  }
  for (const franchise of dataset.franchises) {
    if (franchise.wikidataId) {
      franchise.wikipediaTitles = franchiseTitles.get(franchise.wikidataId) ?? {};
    }
  }

  await saveDataset(dataset);

  const auto = dataset.cards.filter((card) => card.matchStatus === "auto").length;
  console.log(
    `\n✓ ${auto}/${dataset.cards.length} cartes appariées (${Math.round((auto / dataset.cards.length) * 1000) / 10} %)`,
  );
  console.log(`  franchises résolues : ${dataset.franchises.filter((franchise) => franchise.wikidataId).length}/${dataset.franchises.length}`);
  console.log(`  ${netSummary()} — ${((Date.now() - started) / 1000).toFixed(0)} s`);
  console.log(`  jeu de données : ${datasetPath()}`);
  console.log(`  requêtes en cache : ${netStats.cached}`);
  await sources.close();
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/popularity/match.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
