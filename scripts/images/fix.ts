/**
 * Étape 1 → 5 du chantier images : trouver une vraie image pour chaque carte,
 * puis supprimer celles qui n'en ont aucune.
 *
 * Déroulé :
 *   1. `images:check` fournit l'état de départ (cache disque, reprise possible).
 *   2. Pour chaque carte sans image valide : agrandissement de la vignette
 *      existante, puis Wikidata (P18 → Commons), puis le wiki de la franchise
 *      (Fandom), puis Wikipédia (`pageimages`).
 *   3. Chaque candidat passe les règles de l'étape 3 (200, type image,
 *      ≥ 300 px, rapport 0,4–2,5, nom de fichier, hotlink avec le Referer du
 *      site, pas de doublon).
 *   4. Recherche complète sans résultat → « à supprimer ». Erreur réseau,
 *      403 ou 429 → « à retenter », trois passes avec attente croissante.
 *   5. Garde-fous a–d, puis suppression en une transaction (annonces, ordres,
 *      collections, envies, genres, fiches), restitution des Pixels réservés.
 *
 *   npm run images:fix              (recherche + écriture des images, sans supprimer)
 *   npm run images:fix -- --apply   (supprime aussi les cartes sans image)
 *   npm run images:fix -- --apply --yes
 *
 * Rien n'est supprimé sans `--apply` ; rien n'est supprimé si un garde-fou
 * échoue. Aucune image n'est téléchargée sur disque : seule l'URL est gardée.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { loadCards, loadManifest, saveManifest, type CardRow } from "./lib/cards";
import {
  fandomCandidates,
  fandomHost,
  wikidataCandidates,
  wikipediaCandidates,
  wikipediaFileCandidates,
  type Candidate,
} from "./lib/sources";
import { assetName, dedupeKey, inspectImage, namesCharacter, type Verdict } from "./lib/validate";
import { runCheck, type CheckEntry } from "./check";

const APPLY = process.argv.includes("--apply");
const YES = process.argv.includes("--yes");
const REPORT = path.join(process.cwd(), ".images", "fix.json");

/** Hôte Fandom le plus fréquent d'une franchise, d'après le manifeste. */
function hostByFranchise(manifest: { items: Record<string, { sourceName?: string; source?: string; page?: string }> }, entries: CheckEntry[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    const item = manifest.items[entry.id];
    const page = item?.page ?? "";
    const match = page.match(/^https:\/\/([^/]+\.fandom\.com)/);
    if (!match) continue;
    const counts = votes.get(entry.franchise) ?? new Map<string, number>();
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    votes.set(entry.franchise, counts);
  }
  const chosen = new Map<string, string>();
  for (const [franchise, counts] of votes) {
    const best = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (best) chosen.set(franchise, best[0]);
  }
  return chosen;
}

/** Source d'un visuel déjà enregistré, ramenée aux trois sources connues. */
function normalizeSource(source: string | undefined): Candidate["source"] {
  return source === "wikipedia" || source === "wikidata" ? source : "fandom";
}

/** Variantes d'agrandissement d'une URL de vignette Fandom. */
function biggerVariants(url: string): string[] {
  const out: string[] = [];
  if (/scale-to-width-down\/\d+/.test(url)) out.push(url.replace(/scale-to-width-down\/\d+/, "scale-to-width-down/1000"));
  if (url.includes("/revision/latest")) out.push(url.replace(/\/revision\/latest.*/, "/revision/latest"));
  return out;
}

type ExistingImage = {
  url?: string;
  source?: string;
  sourceName?: string;
  page?: string;
  file?: string;
  license?: string;
  credit?: string;
};

type Result = {
  id: string;
  name: string;
  franchise: string;
  outcome: "kept" | "found" | "to-delete" | "retry";
  candidate?: Candidate & { width: number; height: number };
  reason: string;
  tried: string[];
};

function isNetworkFailure(verdict: Verdict): boolean {
  return /réseau|HTTP (403|429|5\d\d)|type non image/i.test(verdict.reason) || verdict.status >= 500;
}

async function findForCard(
  card: CardRow,
  franchiseHosts: Map<string, string>,
  used: Map<string, string>,
  existing: ExistingImage | null,
): Promise<Result> {
  const tried: string[] = [];
  const candidates: Candidate[] = [];

  // 1. La même image, servie plus grand (Fandom accepte la largeur demandée).
  //    La provenance existante est conservée : c'est le même fichier, seule la
  //    largeur demandée change, et le nom de fichier est relisible dans l'URL.
  if (existing?.url) {
    for (const url of biggerVariants(existing.url)) {
      candidates.push({
        url,
        source: normalizeSource(existing.source),
        sourceName: existing.sourceName ?? "vignette agrandie",
        page: existing.page ?? "",
        file: existing.file || assetName(url),
        license: existing.license,
        credit: existing.credit,
      });
    }
  }

  // 2. Wikidata (P18 → Commons).
  if (card.wikidataId) {
    candidates.push(...(await wikidataCandidates(card.wikidataId, card.name)));
  }

  // 3. Wiki de la franchise.
  const host = franchiseHosts.get(card.franchise) ?? (await fandomHost(card.franchise));
  if (host) candidates.push(...(await fandomCandidates(host, card.name)));
  else tried.push(`aucun wiki Fandom pour ${card.franchise}`);

  // 4. Wikipédia : image principale puis fichiers de l'article portant le nom
  //    (les visuels fair use ne sortent pas de `pageimages`).
  candidates.push(...(await wikipediaCandidates(card.name, card.franchise, ["en", "fr"])));
  candidates.push(...(await wikipediaFileCandidates(card.name, card.franchise, ["en", "fr"])));

  let networkSeen = false;
  for (const candidate of candidates) {
    // Une image dont le nom de fichier ne cite pas le personnage est écartée :
    // c'est ainsi qu'une photo de pont suisse a illustré « Maflon ». Seule
    // Wikidata (P18 sur l'entité du personnage) fait exception.
    if (candidate.source !== "wikidata" && !namesCharacter(candidate.url, card.name)) {
      tried.push(`nom absent du fichier · ${candidate.url}`);
      continue;
    }
    const key = dedupeKey(candidate.url);
    if (used.has(key) && used.get(key) !== card.id) {
      tried.push(`doublon ${candidate.url}`);
      continue;
    }
    const verdict = await inspectImage(candidate.url);
    if (verdict.ok) {
      return {
        id: card.id,
        name: card.name,
        franchise: card.franchise,
        outcome: "found",
        candidate: { ...candidate, width: verdict.width, height: verdict.height },
        reason: "image trouvée",
        tried,
      };
    }
    if (isNetworkFailure(verdict)) networkSeen = true;
    tried.push(`${verdict.reason} · ${candidate.url}`);
  }

  return {
    id: card.id,
    name: card.name,
    franchise: card.franchise,
    outcome: networkSeen ? "retry" : "to-delete",
    reason: networkSeen
      ? "recherche impossible (réseau/403/429) — carte conservée"
      : "aucune image valide après recherche complète",
    tried,
  };
}

async function persistImage(id: string, candidate: Candidate, width: number, height: number): Promise<void> {
  const { openRunner } = await import("../lib/db-runner");
  const runner = await openRunner();
  try {
    const quote = (value: string | undefined) => (value ? `'${value.replace(/'/g, "''")}'` : "null");
    await runner.query(`
      update public.cards
         set image_url = ${quote(candidate.url)},
             image_source_name = ${quote(candidate.sourceName)},
             image_source_page = ${quote(candidate.page)},
             image_license = ${quote(candidate.license)},
             image_width = ${width},
             image_height = ${height},
             image_checked_at = now(),
             image_status = 'ok'
       where id = ${quote(id)}
    `);
  } finally {
    await runner.close();
  }
}

async function main() {
  console.log("→ vérification de départ…");
  const entries = await runCheck();
  const cards = await loadCards();
  const manifest = await loadManifest();
  const byId = new Map(cards.map((card) => [card.id, card]));
  const franchiseHosts = hostByFranchise(manifest, entries);

  // Les images déjà valides sont réservées : une image ne sert qu'à un personnage.
  const used = new Map<string, string>();
  for (const entry of entries) {
    if (entry.ok && entry.url) used.set(dedupeKey(entry.url), entry.id);
  }

  // Une image valide mais dont le fichier ne cite pas le personnage est
  // reprise elle aussi : elle illustre probablement autre chose.
  const broken = entries.filter(
    (entry) => !entry.ok || (entry.url && !namesCharacter(entry.url, entry.name)),
  );
  console.log(`→ ${broken.length} carte(s) sans image valide à traiter`);

  const results: Result[] = [];
  let done = 0;
  for (const entry of broken) {
    const card = byId.get(entry.id);
    if (!card) continue;
    const result = await findForCard(card, franchiseHosts, used, manifest.items[card.id] ?? null);
    if (result.candidate) {
      used.set(dedupeKey(result.candidate.url), card.id);
      manifest.items[card.id] = {
        url: result.candidate.url,
        source: result.candidate.source,
        sourceName: result.candidate.sourceName,
        page: result.candidate.page,
        file: result.candidate.file,
        width: result.candidate.width,
        height: result.candidate.height,
        license: result.candidate.license,
        credit: result.candidate.credit,
        checkedAt: new Date().toISOString(),
      };
      await persistImage(card.id, result.candidate, result.candidate.width, result.candidate.height);
    }
    results.push(result);
    done += 1;
    if (done % 10 === 0) process.stdout.write(`  ${done}/${broken.length}\r`);
  }

  await saveManifest(manifest);

  // Deuxième et troisième passes pour les cartes « à retenter ».
  for (let pass = 2; pass <= 3; pass += 1) {
    const retry = results.filter((result) => result.outcome === "retry");
    if (retry.length === 0) break;
    console.log(`→ passe ${pass} : ${retry.length} carte(s) à retenter (attente ${pass * 5} s)`);
    await new Promise((resolve) => setTimeout(resolve, pass * 5000));
    for (const previous of retry) {
      const card = byId.get(previous.id);
      if (!card) continue;
      const result = await findForCard(card, franchiseHosts, used, manifest.items[card.id] ?? null);
      if (result.candidate) {
        used.set(dedupeKey(result.candidate.url), card.id);
        manifest.items[card.id] = {
          url: result.candidate.url,
          source: result.candidate.source,
          sourceName: result.candidate.sourceName,
          page: result.candidate.page,
          file: result.candidate.file,
          width: result.candidate.width,
          height: result.candidate.height,
          license: result.candidate.license,
          credit: result.candidate.credit,
          checkedAt: new Date().toISOString(),
        };
        await persistImage(card.id, result.candidate, result.candidate.width, result.candidate.height);
      }
      const index = results.findIndex((item) => item.id === previous.id);
      if (index >= 0) results[index] = result;
    }
    await saveManifest(manifest);
  }

  const found = results.filter((result) => result.outcome === "found");
  const retry = results.filter((result) => result.outcome === "retry");
  const toDelete = results.filter((result) => result.outcome === "to-delete");

  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(
    REPORT,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), total: entries.length, found, retry, toDelete }, null, 1)}\n`,
  );

  console.log(`✓ images trouvées : ${found.length}`);
  console.log(`  à retenter      : ${retry.length}`);
  console.log(`  à supprimer     : ${toDelete.length}`);
  console.log(`  rapport         : ${REPORT}`);

  if (!APPLY) {
    console.log("→ rien n'est supprimé sans --apply.");
    return;
  }
  if (!YES) {
    console.log("→ suppression refusée sans --yes.");
    return;
  }

  await deleteCards(toDelete, entries.length);
}

async function deleteCards(toDelete: Result[], total: number): Promise<void> {
  const { DELETE_GUARDRAILS } = await import("./lib/deletion");
  const { openRunner } = await import("../lib/db-runner");
  const runner = await openRunner();
  try {
    const snapshot = (await fs.readdir(path.join(process.cwd(), ".snapshots")).catch(() => [])).sort().pop();
    const guards = await DELETE_GUARDRAILS(runner, toDelete, total, Boolean(snapshot));
    for (const guard of guards) {
      console.log(`${guard.ok ? "✓" : "✗"} ${guard.label} — ${guard.detail}`);
    }
    if (guards.some((guard) => !guard.ok && guard.blocking)) {
      console.log("✗ garde-fou bloquant : aucune suppression.");
      return;
    }
    const ids = toDelete.map((result) => result.id);
    const { planDeletion, DELETE_SQL } = await import("./lib/deletion");
    const plan = planDeletion(ids);
    console.log(`→ transaction : ${plan.length} étapes pour ${ids.length} carte(s)`);
    await runner.query(DELETE_SQL(ids));
    const orphans = await runner.query(`
      select 'collection' as table_name, count(*)::int as n from public.collection c
       where not exists (select 1 from public.cards k where k.id = c.card_id)
      union all
      select 'market_listings', count(*)::int from public.market_listings l
       where not exists (select 1 from public.cards k where k.id = l.card_id)
      union all
      select 'buy_orders', count(*)::int from public.buy_orders o
       where not exists (select 1 from public.cards k where k.id = o.card_id)
      union all
      select 'wishlist', count(*)::int from public.wishlist w
       where not exists (select 1 from public.cards k where k.id = w.card_id)
      union all
      select 'card_genres', count(*)::int from public.card_genres g
       where not exists (select 1 from public.cards k where k.id = g.card_id)
    `);
    console.log(`✓ suppression appliquée : ${ids.length} carte(s)`);
    console.log(`  orphelins : ${orphans.map((row) => `${row.table_name}=${row.n}`).join(" · ")}`);
  } finally {
    await runner.close();
  }
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/images/fix.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
