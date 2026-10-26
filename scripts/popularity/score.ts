/**
 * Étape 4 — score de popularité 0–100.
 *
 *   log10(1 + pages vues totales) et log10(1 + nombre de langues), chacun en
 *   rang percentile parmi les personnages, puis 70 / 30 (voir
 *   `rarity-distribution.config.ts`).
 *
 * Les cartes sans correspondance suivent la règle de repli : 0,4 × popularité
 * de leur franchise + 0,6 × rang interne au wiki de la franchise (voir
 * `lib/wiki-fallback.ts`). Sans wiki ou sans page : 30 % du score de franchise.
 *
 * Écrit aussi le résultat en base : c'est l'étape qui persiste les colonnes de
 * l'étape 1 (correspondance, pages vues, score). Aucune rareté n'est touchée.
 *
 *   npm run popularity:score
 */

import { loadDataset, saveDataset } from "./lib/dataset";
import { computeScores } from "./lib/compute";
import { enrichFallbacks } from "./lib/wiki-fallback";
import { netSummary } from "./lib/http";
import { openRunner, type Runner } from "../lib/db-runner";

const REFRESH_FALLBACK = process.argv.includes("--refresh-fallback");

/** Littéral jsonb sûr, quel que soit le contenu (apostrophes, accolades…). */
function jsonbLiteral(value: unknown): string {
  const payload = JSON.stringify(value ?? null);
  let tag = "pop";
  while (payload.includes(`$${tag}$`)) tag += "x";
  return `$${tag}$${payload}$${tag}$::jsonb`;
}

function textLiteral(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

async function persist(runner: Runner, cards: DB[], franchises: DBF[]) {
  for (let index = 0; index < cards.length; index += 100) {
    const chunk = cards.slice(index, index + 100);
    const rows = chunk
      .map(
        (card) =>
          `(${textLiteral(card.id)}, ${textLiteral(card.wikidataId)}, ${jsonbLiteral(card.titles)}, ` +
          `${card.confidence === null ? "null" : card.confidence}, ${textLiteral(card.status)}, ` +
          `${jsonbLiteral(card.notes)}, ${jsonbLiteral(card.pageviews)}, ` +
          `${card.sitelinks === null ? "null" : card.sitelinks}, ` +
          `${card.score === null ? "null" : card.score}, now())`,
      )
      .join(",\n");

    await runner.query(`
      update public.cards as c
         set wikidata_id = v.wikidata_id,
             wikipedia_titles = v.wikipedia_titles,
             match_confidence = v.match_confidence,
             match_status = v.match_status,
             match_notes = v.match_notes,
             pageviews_median_12m = v.pageviews,
             sitelinks_count = v.sitelinks,
             popularity_score = v.score,
             popularity_computed_at = v.computed_at
        from (values
          ${rows}
        ) as v(id, wikidata_id, wikipedia_titles, match_confidence, match_status, match_notes, pageviews, sitelinks, score, computed_at)
       where c.id = v.id
    `);
  }

  for (let index = 0; index < franchises.length; index += 100) {
    const chunk = franchises.slice(index, index + 100);
    const rows = chunk
      .map(
        (franchise) =>
          `(${textLiteral(franchise.id)}::uuid, ${textLiteral(franchise.wikidataId)}, ` +
          `${franchise.score === null ? "null" : franchise.score}, ${jsonbLiteral(franchise.sources)}, now())`,
      )
      .join(",\n");

    await runner.query(`
      update public.franchises as f
         set wikidata_id = v.wikidata_id,
             popularity_score = v.score,
             popularity_computed_at = v.computed_at,
             popularity_sources = v.sources
        from (values
          ${rows}
        ) as v(id, wikidata_id, score, sources, computed_at)
       where f.id = v.id
    `);
  }
}

type DB = {
  id: string;
  wikidataId: string | null;
  titles: Record<string, string> | null;
  confidence: number | null;
  status: string;
  notes: unknown;
  pageviews: Record<string, number> | null;
  sitelinks: number | null;
  score: number | null;
};

type DBF = {
  id: string;
  wikidataId: string | null;
  score: number | null;
  sources: unknown;
};

async function main() {
  const dataset = await loadDataset();

  // ——— Repli : rang interne au wiki de la franchise, avant le score.
  const fallback = await enrichFallbacks(dataset, {
    refresh: REFRESH_FALLBACK,
    log: (line) => console.log(line),
  });
  console.log(
    `→ repli : ${fallback.cards} carte(s), ${fallback.withWiki} avec wiki, ${fallback.withoutWiki} sans wiki, ${fallback.withoutPage} page(s) introuvable(s)`,
  );

  // ——— Score des franchises puis des personnages (une seule implémentation,
  // partagée avec rarity:preview et rarity:apply).
  computeScores(dataset);
  await saveDataset(dataset);

  // ——— Persistance.
  const runner = await openRunner();
  try {
    await persist(
      runner,
      dataset.cards.map((card) => ({
        id: card.id,
        wikidataId: card.wikidataId,
        titles: card.wikipediaTitles,
        confidence: card.matchStatus === "auto" ? card.matchConfidence : null,
        status: card.matchStatus,
        notes: card.matchNotes,
        pageviews: card.pageviews,
        sitelinks: card.sitelinksCount,
        score: card.popularityScore,
      })),
      dataset.franchises.map((franchise) => ({
        id: franchise.id,
        wikidataId: franchise.wikidataId,
        score: franchise.popularityScore,
        sources: {
          wikipedia: franchise.wikipediaTitles,
          pageviews: franchise.pageviews,
          sitelinks: franchise.sitelinksCount,
          notes: franchise.notes,
          confidence: franchise.confidence,
        },
      })),
    );
  } finally {
    await runner.close();
  }

  const auto = dataset.cards.filter((card) => card.matchStatus === "auto").length;
  const repli = dataset.cards.filter((card) => card.matchStatus === "repli").length;
  const aucun = dataset.cards.filter((card) => card.matchStatus === "aucun").length;
  const top = [...dataset.cards]
    .sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    .slice(0, 5)
    .map((card) => `${card.name} ${card.popularityScore}`);

  console.log(`✓ score calculé pour ${dataset.cards.length} personnages`);
  console.log(`  auto ${auto} (${Math.round((auto / dataset.cards.length) * 1000) / 10} %) · repli ${repli} · aucun ${aucun}`);
  console.log(`  top 5 : ${top.join(" · ")}`);
  console.log(`  réseau : ${netSummary()}`);
  console.log("  base mise à jour : correspondances, pages vues, scores (aucune rareté touchée)");
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
