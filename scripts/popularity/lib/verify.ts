/**
 * Contrôle d — vérification supplémentaire des cartes du haut de classement.
 *
 * Une carte appelée à devenir Mythique ou Légendaire avec une confiance
 * inférieure au seuil est revérifiée sur trois points : le titre de l'article
 * contient son nom, l'entité est classée « personnage fictif », et son œuvre
 * appartient bien à la franchise. Les trois doivent tenir, sinon la carte est
 * signalée comme non vérifiée et l'application s'arrête.
 */

import { normalizeName } from "../../../src/lib/popularity";
import type { CardEntry, FranchiseEntry } from "./dataset";
import { fetchFacts, fetchFranchiseCharacters, fetchFranchiseWorks } from "./wikidata";

export type Verification = { ok: boolean; evidence: string[] };

export async function verifyTopCards(
  cards: CardEntry[],
  franchises: FranchiseEntry[],
): Promise<Map<string, Verification>> {
  const results = new Map<string, Verification>();
  const candidates = cards.filter((card) => card.wikidataId);
  if (candidates.length === 0) return results;

  const franchiseQids = [
    ...new Set(
      candidates
        .map((card) => franchises.find((franchise) => franchise.id === card.franchiseId)?.wikidataId)
        .filter((qid): qid is string => Boolean(qid)),
    ),
  ];

  const [facts, franchiseWorks, franchiseCharacters] = await Promise.all([
    fetchFacts(candidates.map((card) => card.wikidataId!)),
    fetchFranchiseWorks(franchiseQids),
    fetchFranchiseCharacters(franchiseQids),
  ]);

  for (const card of candidates) {
    const fact = facts.get(card.wikidataId!);
    const franchise = franchises.find((entry) => entry.id === card.franchiseId);
    const works = new Set<string>();
    const characters = new Set<string>();
    for (const qid of [franchise?.wikidataId].filter((value): value is string => Boolean(value))) {
      for (const work of franchiseWorks.get(qid) ?? []) works.add(work);
      for (const character of franchiseCharacters.get(qid) ?? []) characters.add(character);
    }

    const tokens = normalizeName(card.name).split(" ").filter((token) => token.length > 2);
    const titles = Object.values(card.wikipediaTitles ?? {}).map(normalizeName);
    const titleHasName = tokens.length > 0 && titles.some((title) => tokens.every((token) => title.includes(token)));
    const isCharacter = fact?.isFictionalCharacter ?? false;
    const linked =
      (fact?.works.some((work) => works.has(work)) ?? false) || characters.has(card.wikidataId!);

    results.set(card.id, {
      ok: titleHasName && isCharacter && linked,
      evidence: [
        `titre contenant le nom : ${titleHasName ? "oui" : "non"}`,
        `personnage fictif : ${isCharacter ? "oui" : "non"}`,
        `franchise concordante : ${linked ? "oui" : "non"}`,
      ],
    });
  }

  return results;
}
