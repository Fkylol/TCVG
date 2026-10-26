/**
 * Chasse stricte des visuels de carte.
 *
 * La chasse précédente acceptait toute image dont le nom de fichier citait le
 * personnage : « Croisé » a reçu une église, « Kirby » une photo de Jack Kirby,
 * « Luigi » une rue allemande. Ici, une image n'est acceptée que si sa source
 * prouve le personnage et la franchise :
 *
 *   1. Wiki de la franchise (Fandom) d'abord — c'est la source des artworks du
 *      jeu : la page doit porter exactement le nom du personnage, sur un domaine
 *      qui correspond à la franchise, ne pas être une homonymie ou une liste, et
 *      avoir une image principale. Confiance moyenne.
 *   2. Wikipédia / Wikidata seulement si le wiki n'a rien donné — l'entité de
 *      la carte doit être un personnage fictif (`Q95074` et sous-types) rattaché
 *      à la franchise (œuvre d'appartenance, personnage cité par la franchise,
 *      ou entité de la franchise). Le nom de la carte doit figurer dans les
 *      libellés. Confiance haute (nom exact) ou moyenne.
 *
 * La franchise est toujours présente dans la recherche et dans la validation.
 * Aucune carte n'est supprimée : le script écrit les visuels acceptés et un
 * rapport (`.images/strict.json`) plus les données de `/dev/image-audit`
 * (`src/data/image-audit.json`).
 *
 *   npm run images:strict
 *   npm run images:strict -- --apply     (écrit manifeste + base)
 */

import fs from "node:fs/promises";
import path from "node:path";

import { loadCards, loadManifest, saveManifest, type CardRow, type Portrait } from "./lib/cards";
import { openRunner } from "../lib/db-runner";
import { getJson } from "./lib/http";
import {
  fetchFacts,
  fetchFranchiseCharacters,
  fetchFranchiseWorks,
  fetchWorks,
  type EntityFacts,
} from "../popularity/lib/wikidata";
import { apiEndpoint, fandomHost, wikidataCandidates, type Candidate } from "./lib/sources";
import { assetName, dedupeKey, inspectImage } from "./lib/validate";
import { reportMarkdown, type StrictReport } from "./lib/report";
import {
  acceptFandomPage,
  acceptWikidataCharacter,
  hostMatchesFranchise,
  nameMatches,
  type Confidence,
  type FranchiseScope,
} from "./lib/strict";

const APPLY = process.argv.includes("--apply");
const REPORT = path.join(process.cwd(), ".images", "strict.json");
const AUDIT = path.join(process.cwd(), "src", "data", "image-audit.json");
const MARKDOWN = path.join(process.cwd(), "RAPPORT_IMAGES.md");
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/**
 * Objets et lieux photographiés sur Commons : statue, cosplay, rue, boutique.
 * Une photo de ce genre illustre l'entité sans être un visuel du personnage
 * (« Luigi » reçoit une rue de Wuppertal, « Knuckles » une statue au cinéma).
 */
const PHYSICAL = /statue|sculpture|cosplay|street|stra(?:ß|ss)e|kiosk|monument|memorial|figurine|plush|toy|mural|graffiti|fountain|exhibition|museum/i;

/** Catégories Commons d'un fichier, mémorisées pour la session. */
const categoryCache = new Map<string, string[]>();
async function commonsCategories(file: string): Promise<string[]> {
  const cached = categoryCache.get(file);
  if (cached) return cached;
  let categories: string[] = [];
  try {
    const data = await getJson<{
      query?: { pages?: Record<string, { categories?: { title?: string }[] }> };
    }>(
      `${COMMONS_API}?action=query&format=json&origin=*&prop=categories&cllimit=40&titles=${encodeURIComponent(`File:${file}`)}`,
    );
    const page = Object.values(data.query?.pages ?? {})[0];
    categories = (page?.categories ?? [])
      .map((category) => category.title?.replace(/^Category:/, "") ?? "")
      .filter(Boolean);
  } catch {
    categories = [];
  }
  categoryCache.set(file, categories);
  return categories;
}

/** Le fichier est-il une photo d'objet ou de lieu plutôt qu'un visuel ? */
async function depictsObjectOrPlace(file: string): Promise<boolean> {
  if (PHYSICAL.test(file)) return true;
  if (!file) return false;
  const categories = await commonsCategories(file);
  return categories.some((category) => PHYSICAL.test(category));
}

type SourceTried = { source: string; reason: string };

type Accepted = {
  url: string;
  source: Candidate["source"];
  sourceName: string;
  page: string;
  file: string;
  width: number;
  height: number;
  license?: string;
  credit?: string;
  confidence: Confidence;
  confidenceReason: string;
};

type CardResult = {
  id: string;
  name: string;
  franchise: string;
  status: "accepted" | "none";
  accepted?: Accepted;
  tried: SourceTried[];
};

type AuditEntry = {
  id: string;
  name: string;
  franchise: string;
  url: string;
  page: string;
  source: string;
  confidence: Confidence | "unverified";
  reason: string;
};

/**
 * Entités Wikidata par recherche plein texte, franchise incluse dans le terme.
 * `wbsearchentities` ne fait qu'une recherche par préfixe de libellé : « Tulin
 * Zelda » n'y renvoie rien. La recherche CirrusSearch de Wikidata, elle, lit
 * aussi les descriptions (« fictional character from… »).
 */
async function searchWikidataEntities(term: string, limit = 8): Promise<string[]> {
  try {
    const data = await getJson<{ query?: { search?: { title?: string }[] } }>(
      `https://www.wikidata.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=0&srlimit=${limit}&srsearch=${encodeURIComponent(term)}`,
    );
    return (data.query?.search ?? [])
      .map((hit) => hit.title ?? "")
      .filter((title) => /^Q\d+$/.test(title));
  } catch {
    return [];
  }
}

/** Exécute `fn` sur chaque élément, `limit` à la fois, en gardant l'ordre. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

type FranchiseRow = { slug: string; name: string; wikidata_id: string | null };

/** Périmètre Wikidata de chaque franchise : ancres, œuvres et personnages cités. */
async function buildScopes(rows: FranchiseRow[]): Promise<Map<string, FranchiseScope>> {
  const scopes = new Map<string, FranchiseScope>();
  for (const row of rows) {
    scopes.set(row.name, {
      name: row.name,
      anchors: row.wikidata_id ? [row.wikidata_id] : [],
      works: row.wikidata_id ? [row.wikidata_id] : [],
      characters: [],
    });
  }

  const anchors = [...scopes.values()].flatMap((scope) => scope.anchors);
  if (anchors.length === 0) return scopes;

  // Séries parentes : « Final Fantasy IX » remonte à « Final Fantasy ».
  const works = await fetchWorks(anchors);
  for (const scope of scopes.values()) {
    for (const id of [...scope.anchors]) {
      for (const parent of works.get(id)?.series ?? []) scope.anchors.push(parent);
    }
  }

  const allAnchors = [...new Set([...scopes.values()].flatMap((scope) => scope.anchors))];
  const franchiseWorks = await fetchFranchiseWorks(allAnchors);
  const franchiseCharacters = await fetchFranchiseCharacters(allAnchors);
  for (const scope of scopes.values()) {
    for (const id of scope.anchors) {
      for (const work of franchiseWorks.get(id) ?? []) scope.works.push(work);
      for (const character of franchiseCharacters.get(id) ?? []) scope.characters.push(character);
    }
    scope.works = [...new Set(scope.works)];
    scope.characters = [...new Set(scope.characters)];
  }
  return scopes;
}

/** Hôte Fandom de chaque franchise, voté par le manifeste puis vérifié. */
function hostByFranchise(
  manifest: { items: Record<string, { page?: string }> },
  cards: CardRow[],
): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const card of cards) {
    const page = manifest.items[card.id]?.page ?? "";
    const match = page.match(/^https:\/\/([^/]+\.fandom\.com)/);
    if (!match) continue;
    const counts = votes.get(card.franchise) ?? new Map<string, number>();
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    votes.set(card.franchise, counts);
  }
  const hosts = new Map<string, string>();
  for (const [franchise, counts] of votes) {
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (best && hostMatchesFranchise(best[0], franchise)) hosts.set(franchise, best[0]);
  }
  return hosts;
}

type FandomPage = { title: string; url: string; file: string; disambiguation: boolean };

/** Nom de recherche le plus court d'une carte (« Abhuva, la Sorcière » → « Abhuva »). */
function primaryName(name: string): string {
  return name.split(/[,(:–—]/)[0].trim();
}

/**
 * Page du wiki de la franchise portant exactement le nom du personnage.
 *
 * On ne cherche pas : on demande le titre exact. Le wiki répond avec son titre
 * normalisé (`Croisé`, `2B`) ; toute autre page est refusée. Le wikitexte est
 * lu uniquement pour repérer un bandeau d'homonymie.
 */
async function fandomExactPage(host: string, name: string): Promise<FandomPage | null> {
  const wiki = `https://${host}`;
  try {
    const data = await getJson<{
      query?: {
        pages?: Record<
          string,
          { title?: string; missing?: string; thumbnail?: { source: string }; revisions?: { slots?: { main?: { "*": string } } }[] }
        >;
      };
    }>(
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&redirects=1&prop=pageimages%7Crevisions&piprop=thumbnail&pithumbsize=900&rvprop=content&rvslots=main&titles=${encodeURIComponent(name)}`,
    );
    const page = Object.values(data.query?.pages ?? {})[0];
    if (!page || page.missing !== undefined || !page.title) return null;
    const text = page.revisions?.[0]?.slots?.main?.["*"] ?? "";
    return {
      title: page.title,
      url: page.thumbnail?.source ?? "",
      file: page.thumbnail?.source ? assetName(page.thumbnail.source) : "",
      disambiguation: /\{\{\s*(disambig|disambiguation|homonymie)/i.test(text),
    };
  } catch {
    return null;
  }
}

async function findImage(
  card: CardRow,
  scope: FranchiseScope,
  host: string | null,
  factsCache: Map<string, EntityFacts>,
  candidateIds: string[],
  searchNote: string,
  used: Map<string, string>,
): Promise<CardResult> {
  const tried: SourceTried[] = [];
  if (searchNote) tried.push({ source: "Wikidata (recherche)", reason: searchNote });

  const accept = async (candidate: Candidate, confidence: Confidence, reason: string): Promise<CardResult | null> => {
    const key = dedupeKey(candidate.url);
    if (used.has(key) && used.get(key) !== card.id) {
      tried.push({ source: candidate.sourceName, reason: "image déjà utilisée par une autre carte" });
      return null;
    }
    const file = candidate.file || assetName(candidate.url);
    if (candidate.source !== "fandom") {
      if (await depictsObjectOrPlace(file)) {
        tried.push({ source: candidate.sourceName, reason: `photo d'un objet ou d'un lieu (${file})` });
        return null;
      }
      // Une image Commons sans le nom du personnage ni dans son fichier ni dans
      // ses catégories illustre autre chose : « Charizard » a reçu la photo
      // d'un Pokémon Center, « Luigi » une rue de Wuppertal.
      const categories = await commonsCategories(file);
      const named =
        nameMatches(card.name, [file]) || categories.some((category) => nameMatches(card.name, [category]));
      if (!named) {
        tried.push({ source: candidate.sourceName, reason: `image sans lien avec ${card.name} (${file})` });
        return null;
      }
    }
    if (candidate.source === "fandom" && PHYSICAL.test(file)) {
      tried.push({ source: candidate.sourceName, reason: `visuel d'objet ou de lieu (${file})` });
      return null;
    }
    const verdict = await inspectImage(
      candidate.url,
      candidate.source === "fandom" ? { minSide: 240, minRatio: 0.3 } : {},
    );
    if (!verdict.ok) {
      tried.push({ source: candidate.sourceName, reason: verdict.reason });
      return null;
    }
    used.set(key, card.id);
    return {
      id: card.id,
      name: card.name,
      franchise: card.franchise,
      status: "accepted",
      accepted: {
        url: candidate.url,
        source: candidate.source,
        sourceName: candidate.sourceName,
        page: candidate.page,
        file: candidate.file || assetName(candidate.url),
        width: verdict.width,
        height: verdict.height,
        license: candidate.license,
        credit: candidate.credit,
        confidence,
        confidenceReason: reason,
      },
      tried,
    };
  };

  // 1. Wiki de la franchise d'abord : c'est là que vivent les artworks du jeu.
  //    Page portant exactement le nom du personnage, image principale.
  if (host) {
    const page = await fandomExactPage(host, card.name);
    if (!page) {
      tried.push({ source: host, reason: `aucune page « ${card.name} »` });
    } else {
      // Le titre demandé est exactement celui de la carte ; le wiki peut le
      // rediriger vers son titre canonique (« Aerith » → « Aerith
      // Gainsborough »). C'est cette page-là qui fait foi.
      const verdict = acceptFandomPage({
        title: card.name,
        cardName: card.name,
        host,
        franchiseName: card.franchise,
        disambiguation: page.disambiguation,
        hasLeadImage: Boolean(page.url),
      });
      if (!verdict.ok) {
        tried.push({ source: host, reason: verdict.reason });
      } else {
        const result = await accept(
          {
            url: page.url,
            source: "fandom",
            sourceName: host,
            page: `https://${host}/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
            file: page.file,
          },
          verdict.confidence,
          verdict.reason,
        );
        if (result) return result;
      }
    }
  } else {
    tried.push({ source: "Fandom", reason: "aucun wiki de franchise identifié" });
  }

  // 2. Wikipédia / Wikidata seulement si le wiki de la franchise n'a rien donné :
  //    entité de la carte (ou résultats de « personnage + franchise »),
  //    personnage fictif rattaché à la franchise, image principale P18.
  for (const id of candidateIds) {
    const facts = factsCache.get(id);
    if (!facts) {
      tried.push({ source: "Wikidata", reason: `entité ${id} illisible` });
      continue;
    }
    const verdict = acceptWikidataCharacter(facts, scope, card.name);
    if (!verdict.ok) {
      tried.push({ source: "Wikidata", reason: `${id} : ${verdict.reason}` });
      continue;
    }
    const images = await wikidataCandidates(id, card.name);
    if (images.length === 0) {
      tried.push({ source: "Wikidata", reason: `${id} : ${verdict.reason}, aucune image P18` });
      continue;
    }
    for (const image of images) {
      const result = await accept(image, verdict.confidence, `${verdict.reason} · ${verdict.confidence}`);
      if (result) return result;
    }
  }

  return { id: card.id, name: card.name, franchise: card.franchise, status: "none", tried };
}

async function persist(results: CardResult[]): Promise<void> {
  const runner = await openRunner();
  try {
    for (const result of results) {
      if (!result.accepted) continue;
      const quote = (value: string | undefined) => (value ? `'${value.replace(/'/g, "''")}'` : "null");
      const image = result.accepted;
      await runner.query(`
        update public.cards
           set image_url = ${quote(image.url)},
               image_source_name = ${quote(image.sourceName)},
               image_source_page = ${quote(image.page)},
               image_license = ${quote(image.license)},
               image_width = ${image.width},
               image_height = ${image.height},
               image_checked_at = now(),
               image_status = 'ok'
         where id = ${quote(result.id)}
      `);
    }
  } finally {
    await runner.close();
  }
}

async function main() {
  const cards = await loadCards();
  const manifest = await loadManifest();

  const runner = await openRunner();
  let franchises: FranchiseRow[];
  try {
    franchises = (await runner.query(
      `select slug, name, wikidata_id from public.franchises order by name`,
    )) as FranchiseRow[];
  } finally {
    await runner.close();
  }

  console.log(`→ ${cards.length} cartes · ${franchises.length} franchises`);
  console.log("→ périmètre Wikidata des franchises…");
  const scopes = await buildScopes(franchises);

  console.log("→ hôtes Fandom des franchises…");
  const hosts = hostByFranchise(manifest, cards);
  const hostFallback = new Map<string, string | null>();
  for (const card of cards) {
    if (hosts.has(card.franchise) || hostFallback.has(card.franchise)) continue;
    const host = await fandomHost(card.franchise);
    hostFallback.set(card.franchise, host && hostMatchesFranchise(host, card.franchise) ? host : null);
    if (hostFallback.get(card.franchise)) hosts.set(card.franchise, hostFallback.get(card.franchise)!);
  }
  console.log(`  ${hosts.size}/${franchises.length} franchise(s) avec un wiki`);

  // Entités candidates, puis faits lus en une seule passe : les requêtes
  // SPARQL par carte seraient dix fois plus longues et se feraient limiter.
  console.log("→ recherche des entités (franchise incluse dans le terme)…");
  const candidates = await mapLimit(cards, 8, async (card) => {
    if (card.wikidataId) return { ids: [card.wikidataId], note: "" };
    let ids = await searchWikidataEntities(`${card.name} ${card.franchise}`, 8);
    let term = `${card.name} ${card.franchise}`;
    const short = primaryName(card.name);
    if (ids.length === 0 && short && short !== card.name) {
      term = `${short} ${card.franchise}`;
      ids = await searchWikidataEntities(term, 8);
    }
    return { ids, note: `${ids.length} entité(s) pour « ${term} »` };
  });

  console.log("→ lecture des faits Wikidata…");
  const factsCache = new Map<string, EntityFacts>();
  const allIds = [...new Set(candidates.flatMap((entry) => entry.ids))];
  for (let index = 0; index < allIds.length; index += 200) {
    const batch = allIds.slice(index, index + 200);
    const facts = await fetchFacts(batch);
    for (const [id, entry] of facts) factsCache.set(id, entry);
    process.stdout.write(`  ${Math.min(index + 200, allIds.length)}/${allIds.length}\r`);
  }
  console.log(`  ${factsCache.size} entité(s) lue(s)`);

  const used = new Map<string, string>();

  console.log("→ recherche stricte…");
  let done = 0;
  const results = await mapLimit(cards, 4, async (card, index) => {
    const scope = scopes.get(card.franchise);
    const result = scope
      ? await findImage(
          card,
          scope,
          hosts.get(card.franchise) ?? null,
          factsCache,
          candidates[index].ids,
          candidates[index].note,
          used,
        )
      : {
          id: card.id,
          name: card.name,
          franchise: card.franchise,
          status: "none" as const,
          tried: [{ source: "Wikidata", reason: "franchise sans entité" }],
        };
    done += 1;
    if (done % 25 === 0) process.stdout.write(`  ${done}/${cards.length}\r`);
    return result;
  });

  const accepted = results.filter((result) => result.status === "accepted");
  const none = results.filter((result) => result.status === "none");

  // Manifeste : les visuels acceptés, plus les entrées antérieures non
  // remplacées (elles ne viennent pas de la chasse automatique).
  for (const result of accepted) {
    const image = result.accepted!;
    const entry: Portrait = {
      url: image.url,
      source: image.source,
      sourceName: image.sourceName,
      page: image.page,
      file: image.file,
      width: image.width,
      height: image.height,
      license: image.license,
      credit: image.credit,
      checkedAt: new Date().toISOString(),
      confidence: image.confidence,
    };
    manifest.items[result.id] = entry;
  }

  // Audit : images acceptées (confiance décroissante) puis visuels antérieurs
  // jamais revérifiés, pour que rien d'affiché n'échappe à la relecture.
  const audit: AuditEntry[] = [];
  const rank: Record<AuditEntry["confidence"], number> = { unverified: 0, medium: 1, high: 2 };
  for (const result of accepted) {
    const image = result.accepted!;
    audit.push({
      id: result.id,
      name: result.name,
      franchise: result.franchise,
      url: image.url,
      page: image.page,
      source: image.sourceName,
      confidence: image.confidence,
      reason: image.confidenceReason,
    });
  }
  for (const card of cards) {
    if (accepted.some((result) => result.id === card.id)) continue;
    const legacy = manifest.items[card.id];
    if (!legacy?.url) continue;
    audit.push({
      id: card.id,
      name: card.name,
      franchise: card.franchise,
      url: legacy.url,
      page: legacy.page ?? "",
      source: legacy.sourceName ?? legacy.source ?? "antérieur",
      confidence: "unverified",
      reason: "visuel antérieur, jamais revérifié",
    });
  }
  audit.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.name.localeCompare(b.name));

  const report: StrictReport = {
    generatedAt: new Date().toISOString(),
    total: cards.length,
    accepted: accepted.length,
    none: none.length,
    results,
  };

  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, `${JSON.stringify(report, null, 1)}\n`);
  await fs.writeFile(MARKDOWN, reportMarkdown(report));
  await fs.writeFile(
    AUDIT,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Visuels de carte : acceptés par la recherche stricte, puis visuels antérieurs non revérifiés.",
        total: cards.length,
        accepted: accepted.length,
        entries: audit,
      },
      null,
      1,
    )}\n`,
  );

  console.log(`✓ visuels acceptés : ${accepted.length}`);
  console.log(`  cartes sans visuel fiable : ${none.length}`);
  console.log(`  rapport : ${REPORT}`);
  console.log(`  audit   : ${AUDIT}`);
  console.log(`  lisible : ${MARKDOWN}`);

  const share = none.length / Math.max(cards.length, 1);
  console.log(`  part sans visuel : ${(share * 100).toFixed(1)} %`);

  if (!APPLY) {
    console.log("→ manifeste et base inchangés sans --apply.");
    return;
  }

  await saveManifest(manifest);
  await persist(accepted);
  console.log("✓ manifeste et base mis à jour");
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
