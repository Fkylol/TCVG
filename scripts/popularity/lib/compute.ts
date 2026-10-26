/**
 * Calcul du score de popularité, partagé par `popularity:score`,
 * `rarity:preview` et `rarity:apply`.
 *
 * Même code pour les trois : un aperçu ne peut pas diverger de ce qui sera
 * appliqué.
 */

import { log10p1, popularityScores, type PopularityInput } from "../../../src/lib/popularity";
import {
  FALLBACK_WEIGHTS,
  FRANCHISE_FALLBACK_FACTOR,
} from "../../../src/lib/rarity-distribution.config";
import type { Dataset } from "./dataset";

/** Score des franchises, puis des personnages, avec la règle de repli. */
export function computeScores(dataset: Dataset): void {
  const franchiseEntries: PopularityInput[] = dataset.franchises.map((franchise) => ({
    id: franchise.id,
    pageviews: log10p1(franchise.pageviewsTotal ?? 0),
    languages: log10p1(franchise.sitelinksCount ?? 0),
  }));
  const franchiseScores = popularityScores(franchiseEntries);
  for (const franchise of dataset.franchises) {
    franchise.popularityScore = franchiseScores.get(franchise.id) ?? 0;
  }
  const franchiseById = new Map(dataset.franchises.map((franchise) => [franchise.id, franchise]));

  const cardEntries: PopularityInput[] = dataset.cards.map((card) => ({
    id: card.id,
    pageviews: log10p1(card.pageviewsTotal ?? 0),
    languages: log10p1(card.sitelinksCount ?? 0),
  }));
  const cardScores = popularityScores(cardEntries);

  for (const card of dataset.cards) {
    if (card.matchStatus === "auto") {
      card.popularityScore = cardScores.get(card.id) ?? 0;
      continue;
    }

    const franchise = franchiseById.get(card.franchiseId);
    const base = franchise?.popularityScore ?? 0;
    const hasData = base > 0;
    const fallback = card.fallback;
    const internal = fallback?.method === "wiki" ? fallback.withinFranchiseScore : null;

    card.matchStatus = hasData ? "repli" : "aucun";
    // Une ancienne note de repli ne doit pas survivre à un nouveau calcul.
    card.matchNotes.notes = card.matchNotes.notes.filter((note) => !note.startsWith("repli"));

    if (!hasData) {
      card.popularityScore = 0;
      card.matchNotes.notes.push("repli : la franchise elle-même n'a aucune donnée, score 0");
      continue;
    }

    if (internal !== null && internal !== undefined) {
      card.popularityScore =
        Math.round((base * FALLBACK_WEIGHTS.franchise + internal * FALLBACK_WEIGHTS.internal) * 100) / 100;
      card.matchNotes.notes.push(
        `repli : ${FALLBACK_WEIGHTS.franchise} × ${base} (franchise) + ${FALLBACK_WEIGHTS.internal} × ${internal} (rang interne${fallback?.wikiHost ? `, ${fallback.wikiHost}` : ""})`,
      );
    } else {
      card.popularityScore = Math.round(base * FRANCHISE_FALLBACK_FACTOR * 100) / 100;
      card.matchNotes.notes.push(
        `repli : ${FRANCHISE_FALLBACK_FACTOR} × ${base} (franchise seule${fallback?.reason ? ` — ${fallback.reason}` : ""})`,
      );
    }
  }
  const stamp = new Date().toISOString();
  for (const card of dataset.cards) card.computedAt = stamp;
}
