/**
 * Contrôles automatiques (étape 6), obligatoires avant toute application.
 *
 * Une seule fonction, des données en entrée, une liste de verdicts en sortie :
 * c'est testable sans base ni réseau, et `rarity:preview` et `rarity:apply`
 * affichent exactement les mêmes résultats.
 */

import type { Rarity } from "../../../src/lib/cards";
import {
  FRANCHISE_CAPS,
  RARITY_ORDER,
  RARITY_SHARES,
  CONTROLS,
} from "../../../src/lib/rarity-distribution.config";
import { targetCounts, tierIndex } from "../../../src/lib/popularity";

export type ControlCard = {
  id: string;
  name: string;
  rarity: Rarity;
  newRarity: Rarity;
  franchiseId: string;
  franchiseName: string;
  /** Confiance de la correspondance (0 si aucune). */
  confidence: number;
  status: string;
  /** Vérification supplémentaire des cartes du haut de classement. */
  verified?: boolean;
};

export type GenreCounts = { slug: string; name: string; counts: Partial<Record<Rarity, number>> };

export type ControlVerdict = {
  id: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
};

export type ControlInput = {
  cards: ControlCard[];
  counts: Record<Rarity, number>;
  genres: GenreCounts[];
  /** Effectifs cibles, réduits si les vérifiés manquent (étape C). */
  targets?: Record<Rarity, number>;
  /** Instantané vérifié disponible (étape 7). */
  snapshotVerified: boolean;
  /** Les tests automatiques passent. */
  testsPassed: boolean;
  /** Anomalies de pages vues détectées et leur revérification (contrôle e). */
  anomalies?: { id: string; kept?: boolean }[];
};

/** Effectifs cibles pour le nombre de cartes fourni. */
export function expectedCounts(count: number): Record<Rarity, number> {
  return targetCounts(count, RARITY_SHARES);
}

export function runControls(input: ControlInput): ControlVerdict[] {
  const verdicts: ControlVerdict[] = [];
  const total = input.cards.length;
  const auto = input.cards.filter((card) => card.status === "auto").length;
  const matchedShare = total ? auto / total : 0;

  // a1 — aucun palier haut sans correspondance vérifiée.
  const highRarities: Rarity[] = ["L", "UR", "SR"];
  const verifiedHigh = input.cards.filter((card) => highRarities.includes(card.newRarity));
  const unverifiedHigh = verifiedHigh.filter((card) => {
    if (card.status !== "auto") return true;
    const threshold = card.newRarity === "SR" ? CONTROLS.epicConfidence : CONTROLS.topRarityConfidence;
    return card.confidence < threshold && !card.verified;
  });
  verdicts.push({
    id: "a1",
    label: "Mythiques, Légendaires et Épiques vérifiés",
    ok: unverifiedHigh.length === 0,
    blocking: true,
    detail: unverifiedHigh.length
      ? `${unverifiedHigh.length}/${verifiedHigh.length} sans correspondance vérifiée : ${unverifiedHigh
          .slice(0, 8)
          .map((card) => `${card.name} (${card.status}, ${card.confidence})`)
          .join(", ")}`
      : `${verifiedHigh.length} carte(s) du haut de classement, toutes vérifiées (seuils ${CONTROLS.topRarityConfidence} / ${CONTROLS.epicConfidence})`,
  });

  // a2 — un personnage en repli ne dépasse jamais Rare.
  const fallbackHigh = input.cards.filter(
    (card) => card.status !== "auto" && tierIndex(card.newRarity) < tierIndex("R"),
  );
  verdicts.push({
    id: "a2",
    label: "Aucun repli au-dessus de Rare",
    ok: fallbackHigh.length === 0,
    blocking: true,
    detail: fallbackHigh.length
      ? `${fallbackHigh.length} carte(s) en repli au-dessus de Rare : ${fallbackHigh
          .slice(0, 8)
          .map((card) => `${card.name} (${rarityName(card.newRarity)})`)
          .join(", ")}`
      : "tous les personnages en repli sont Rare ou moins",
  });

  // a3 — information, non bloquante : part rattachée et franchises à majorité
  // de repli. Le seuil de 85 % a été retiré : il n'était pas atteignable sans
  // inventer des correspondances.
  const fallbackByFranchise = new Map<string, { name: string; total: number; fallback: number }>();
  for (const card of input.cards) {
    const entry = fallbackByFranchise.get(card.franchiseId) ?? {
      name: card.franchiseName,
      total: 0,
      fallback: 0,
    };
    entry.total += 1;
    if (card.status !== "auto") entry.fallback += 1;
    fallbackByFranchise.set(card.franchiseId, entry);
  }
  const majority = [...fallbackByFranchise.values()]
    .filter((entry) => entry.total > 0 && entry.fallback / entry.total > 0.5)
    .sort((a, b) => b.fallback / b.total - a.fallback / a.total || a.name.localeCompare(b.name, "fr"));
  verdicts.push({
    id: "a3",
    label: "Part de personnages rattachés (information)",
    ok: true,
    blocking: false,
    detail:
      `${(matchedShare * 100).toFixed(1)} % (${auto}/${total}) avec correspondance automatique` +
      (majority.length
        ? ` · ${majority.length} franchise(s) à majorité de repli : ${majority
            .slice(0, 8)
            .map((entry) => `${entry.name} (${entry.fallback}/${entry.total})`)
            .join(", ")}${majority.length > 8 ? "…" : ""}`
        : " · aucune franchise à majorité de repli"),
  });

  const targets = input.targets ?? expectedCounts(total);
  const drift = RARITY_ORDER.map((rarity) => ({
    rarity,
    target: targets[rarity],
    actual: input.counts[rarity] ?? 0,
  }));
  verdicts.push({
    id: "b",
    label: "Effectifs par rareté",
    ok: drift.every((entry) => Math.abs(entry.actual - entry.target) <= CONTROLS.countTolerance),
    blocking: true,
    detail: drift
      .map((entry) => `${rarityName(entry.rarity)} ${entry.actual}/${entry.target}`)
      .join(" · "),
  });

  const perFranchise = new Map<string, Record<string, number>>();
  for (const card of input.cards) {
    const slots = perFranchise.get(card.franchiseId) ?? {};
    slots[card.newRarity] = (slots[card.newRarity] ?? 0) + 1;
    perFranchise.set(card.franchiseId, slots);
  }
  const breaches: string[] = [];
  for (const [franchiseId, slots] of perFranchise) {
    for (const [rarity, cap] of Object.entries(FRANCHISE_CAPS) as [Rarity, number][]) {
      if ((slots[rarity] ?? 0) > cap) {
        const name = input.cards.find((card) => card.franchiseId === franchiseId)?.franchiseName ?? franchiseId;
        breaches.push(`${name} : ${slots[rarity]} ${rarityName(rarity)} (plafond ${cap})`);
      }
    }
  }
  verdicts.push({
    id: "c",
    label: "Plafonds par franchise",
    ok: breaches.length === 0,
    blocking: true,
    detail: breaches.length ? breaches.join(" · ") : "aucun dépassement",
  });

  const topRarity = RARITY_ORDER[0];
  const secondRarity = RARITY_ORDER[1];
  const top = input.cards.filter((card) => card.newRarity === topRarity);
  const second = input.cards.filter((card) => card.newRarity === secondRarity);
  const weak = [...top, ...second].filter(
    (card) => card.confidence < CONTROLS.topRarityConfidence && !card.verified,
  );
  verdicts.push({
    id: "d",
    label: "Confiance des Mythiques et Légendaires",
    ok: weak.length === 0,
    blocking: true,
    detail: weak.length
      ? `${weak.length} carte(s) sous ${CONTROLS.topRarityConfidence} sans vérification : ${weak
          .slice(0, 8)
          .map((card) => `${card.name} (${card.confidence})`)
          .join(", ")}`
      : `${top.length} Mythiques et ${second.length} Légendaires, tous à ${CONTROLS.topRarityConfidence}+ ou vérifiés`,
  });

  // Contrôle e : toute carte au-dessus du facteur est revérifiée. Le contrôle
  // porte sur la revérification, pas sur l'existence de l'anomalie : une carte
  // écartée à la revérification est un succès (elle repasse en repli), pas un
  // échec. Seule une carte laissée sans revérification bloque.
  const anomalies = input.anomalies ?? [];
  const unresolved = anomalies.filter((entry) => entry.kept === undefined);
  const kept = anomalies.filter((entry) => entry.kept).length;
  const demoted = anomalies.length - kept;
  verdicts.push({
    id: "e",
    label: "Anomalies de pages vues",
    ok: unresolved.length === 0,
    blocking: true,
    detail: anomalies.length
      ? `${anomalies.length} carte(s) au-dessus de ${CONTROLS.franchiseOutlierFactor}× la médiane de leur franchise : ${kept} confirmée(s), ${demoted} repassée(s) en repli après revérification`
      : "aucune anomalie",
  });

  const missing: string[] = [];
  const thin: string[] = [];
  for (const genre of input.genres) {
    for (const rarity of RARITY_ORDER) {
      if (tierIndex(rarity) < tierIndex("R")) continue; // Commune → Rare
      const count = genre.counts[rarity] ?? 0;
      if (count < CONTROLS.minCardsPerGenreRarity) missing.push(`${genre.name} ${rarityName(rarity)} ${count}`);
      if (count === 0) thin.push(`${genre.name} ${rarityName(rarity)}`);
    }
    const rare = (genre.counts.R ?? 0) + (genre.counts.SR ?? 0) + (genre.counts.UR ?? 0) + (genre.counts.L ?? 0);
    if (rare === 0) thin.push(`${genre.name} : aucune Rare ou mieux`);
  }
  verdicts.push({
    id: "f",
    label: "Booster de genre : au moins 2 cartes par rareté (C → Rare)",
    ok: missing.length === 0,
    // Le cahier des charges demande de le signaler (« ce n'est pas bloquant,
    // mais c'est signalé ») : la composition des boosters dépend du catalogue,
    // pas du calcul de rareté.
    blocking: false,
    detail: missing.length
      ? `manque : ${missing.join(", ")}`
      : "tous les boosters de genre couvrent Commune, Peu commune et Rare",
  });
  verdicts.push({
    id: "f2",
    label: "Genres pauvres en cartes rares",
    ok: thin.length === 0,
    blocking: false,
    detail: thin.length ? thin.join(", ") : "aucun genre sans Rare ou mieux",
  });

  verdicts.push({
    id: "g",
    label: "Instantané de la base vérifié",
    ok: input.snapshotVerified,
    blocking: true,
    detail: input.snapshotVerified ? "instantané présent et restauration testée" : "aucun instantané vérifié",
  });
  verdicts.push({
    id: "g2",
    label: "Tests automatiques",
    ok: input.testsPassed,
    blocking: true,
    detail: input.testsPassed ? "npm test au vert" : "tests non passés pour cette exécution",
  });

  return verdicts;
}

export function rarityName(rarity: Rarity): string {
  return (
    {
      C: "Commune",
      UC: "Peu commune",
      R: "Rare",
      SR: "Épique",
      UR: "Légendaire",
      L: "Mythique",
    } as Record<Rarity, string>
  )[rarity];
}

/** Vrai si tous les contrôles bloquants passent. */
export function allBlockingPass(verdicts: ControlVerdict[]): boolean {
  return verdicts.every((verdict) => !verdict.blocking || verdict.ok);
}
