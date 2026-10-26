/**
 * Contrôle e — anomalies de pages vues.
 *
 * Une carte qui dépasse dix fois la médiane de sa franchise peut signaler un
 * homonyme (mauvaise entité), pas une popularité réelle. Elle est revérifiée :
 * le titre de l'article doit contenir son nom, l'entité doit être un personnage
 * fictif, et son œuvre doit appartenir à la franchise. Si l'un des trois
 * manque, la carte repasse en « aucun » (règle de repli).
 */

import { normalizeName } from "../../../src/lib/popularity";
import { CONTROLS } from "../../../src/lib/rarity-distribution.config";
import type { Dataset } from "./dataset";
import { fetchFacts, fetchFranchiseWorks } from "./wikidata";

export type Correction = {
  id: string;
  name: string;
  franchiseName: string;
  views: number;
  franchiseMedian: number;
  ratio: number;
  kept: boolean;
  evidence: string[];
};

/** Médiane d'une liste de nombres. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Détecte et revérifie les anomalies. Modifie le jeu de données en place
 * (statut repassé à « aucun » pour les cartes non confirmées) et renvoie le
 * détail, pour le rapport.
 */
export async function correctAnomalies(dataset: Dataset): Promise<Correction[]> {
  const byFranchise = new Map<string, number[]>();
  for (const card of dataset.cards) {
    if ((card.pageviewsTotal ?? 0) <= 0) continue;
    const list = byFranchise.get(card.franchiseId) ?? [];
    list.push(card.pageviewsTotal ?? 0);
    byFranchise.set(card.franchiseId, list);
  }

  const suspects = dataset.cards.filter((card) => {
    const views = card.pageviewsTotal ?? 0;
    if (views <= 0 || card.matchStatus !== "auto" || !card.wikidataId) return false;
    const med = median(byFranchise.get(card.franchiseId) ?? []);
    return med > 0 && views > med * CONTROLS.franchiseOutlierFactor;
  });
  if (suspects.length === 0) return [];

  const franchiseQids = [
    ...new Set(
      suspects
        .map((card) => dataset.franchises.find((franchise) => franchise.id === card.franchiseId)?.wikidataId)
        .filter((qid): qid is string => Boolean(qid)),
    ),
  ];
  const franchiseWorks = await fetchFranchiseWorks(franchiseQids);
  const facts = await fetchFacts(suspects.map((card) => card.wikidataId!));

  const corrections: Correction[] = [];
  for (const card of suspects) {
    const views = card.pageviewsTotal ?? 0;
    const franchiseMedian = median(byFranchise.get(card.franchiseId) ?? []);
    const fact = facts.get(card.wikidataId!);
    const franchise = dataset.franchises.find((entry) => entry.id === card.franchiseId);
    const works = new Set<string>();
    if (franchise?.wikidataId) {
      for (const work of franchiseWorks.get(franchise.wikidataId) ?? []) works.add(work);
    }

    const nameTokens = normalizeName(card.name).split(" ").filter((token) => token.length > 2);
    const titles = Object.values(card.wikipediaTitles ?? {}).map(normalizeName);
    const titleHasName = titles.some((title) => nameTokens.every((token) => title.includes(token)));
    const isCharacter = fact?.isFictionalCharacter ?? false;
    const linked = fact?.works.some((work) => works.has(work)) ?? false;

    const evidence = [
      `titre d'article contenant le nom : ${titleHasName ? "oui" : "non"}`,
      `personnage fictif : ${isCharacter ? "oui" : "non"}`,
      `œuvre rattachée à la franchise : ${linked ? "oui" : "non"}`,
      `pages vues ${views} vs médiane ${franchiseMedian}`,
    ];

    const kept = titleHasName && isCharacter && linked;
    if (!kept) {
      card.matchStatus = "aucun";
      card.matchConfidence = 0;
      card.pageviewsTotal = 0;
      card.pageviews = null;
      card.matchNotes.notes.push(`anomalie non confirmée (contrôle e) : ${evidence.join(" · ")}`);
    }

    corrections.push({
      id: card.id,
      name: card.name,
      franchiseName: card.franchiseName,
      views,
      franchiseMedian,
      ratio: Math.round((views / (franchiseMedian || 1)) * 10) / 10,
      kept,
      evidence,
    });
  }

  return corrections;
}
