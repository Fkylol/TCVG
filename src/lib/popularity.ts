/**
 * Calculs du chantier « rareté par popularité ».
 *
 * Tout est pur et sans entrée/sortie : les scripts lancent les appels réseau et
 * la base, puis passent les faits ici. C'est ce qui rend le score, la
 * répartition et les contrôles testables sans réseau.
 *
 * Réglages : `rarity-distribution.config.ts`. Rien n'est codé en dur.
 */

import type { Rarity } from "./cards";
import {
  FRANCHISE_CAPS,
  LANGUAGES,
  MATCH_MARGIN,
  MATCH_THRESHOLD,
  MATCH_WEIGHTS,
  POPULARITY_WEIGHTS,
  RARITY_ORDER,
  RARITY_SHARES,
} from "./rarity-distribution.config";

// ————————————————————————————————————————————————————————————
//  Noms
// ————————————————————————————————————————————————————————————

/**
 * Forme comparable d'un nom : minuscules, sans accents, sans ponctuation,
 * espaces réduits. « Arthas Menethil », « arthas  menethil » et
 * « Arthás Menethil » se rejoignent.
 */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const PARTICLES = ["de", "du", "des", "von", "van", "of", "the", "la", "le", "les", "l"];

/** Variantes de recherche d'un nom, dans l'ordre d'essai. */
export function nameVariants(name: string): string[] {
  const base = normalizeName(name);
  const variants = new Set<string>([base]);

  const words = base.split(" ").filter(Boolean);
  // « Le Chevalier », « La Baronne Von Bon Bon » : l'article n'est pas un nom.
  const parts = words.filter((word) => !PARTICLES.includes(word));
  if (parts.length >= 1 && parts.length < words.length) variants.add(parts.join(" "));

  if (words.length > 2) {
    if (parts.length >= 2) variants.add(parts.slice(-2).join(" "));
    // Nom sans prénom.
    variants.add(parts[parts.length - 1] ?? base);
  }

  variants.delete("");
  return [...variants];
}

// ————————————————————————————————————————————————————————————
//  Correspondance personnage / article
// ————————————————————————————————————————————————————————————

/** Faits vérifiés sur un candidat Wikidata. Aucun n'est deviné : absent = faux. */
export type MatchFacts = {
  /** Identifiant Wikidata (Q…). */
  id: string;
  /** Libellés et alias connus, toutes langues confondues. */
  labels: string[];
  /** Descriptions Wikidata, toutes langues confondues. */
  descriptions: string[];
  /** Titres d'articles Wikipédia connus (« Tifa Lockhart » pour « Tifa »). */
  articleTitles?: string[];
  /** `instance de` (ou sous-type de) « personnage fictif ». */
  isFictionalCharacter: boolean;
  /** Au moins un article Wikipédia dans les langues suivies. */
  hasWikipediaArticle: boolean;
  /** Présent dans une œuvre de la franchise (`P1441`). */
  inFranchiseWork: boolean;
  /** La franchise le cite dans ses personnages (`P674`). */
  listedByFranchise: boolean;
  /** Son titre ou sa description cite le nom de la franchise. */
  mentionsFranchise: boolean;
  /** Page d'homonymie, liste, œuvre ou jeu : écarté d'office. */
  rejected: boolean;
  /** Nombre de langues où l'entité a un lien (sitelinks). */
  sitelinks: number;
  /** Libellés des œuvres liées, pour les notes. */
  workLabels?: string[];
};

export type MatchScore = {
  id: string;
  score: number;
  exactName: boolean;
  /** Le titre commence par le nom de la carte et continue : nom complet. */
  prefixName: boolean;
  franchiseLink: boolean;
  reasons: string[];
};

/**
 * Le nom de la carte ouvre-t-il un titre plus long ? « Tifa » ouvre
 * « Tifa Lockhart ». Il faut un mot entier : « Pie » n'ouvre pas « Pierrot ».
 */
export function prefixedBy(name: string, title: string): boolean {
  const wanted = normalizeName(name);
  const haystack = normalizeName(title);
  if (wanted.length < 4 || haystack.length <= wanted.length) return false;
  return haystack.startsWith(`${wanted} `);
}

/**
 * Score de confiance d'un candidat, sur le barème du cahier des charges :
 * nom exact 0,40 · personnage fictif 0,20 · lien franchise 0,30 · article 0,10.
 */
export function scoreMatch(
  facts: MatchFacts,
  name: string,
  weights: typeof MATCH_WEIGHTS = MATCH_WEIGHTS,
): MatchScore {
  if (facts.rejected) {
    return {
      id: facts.id,
      score: 0,
      exactName: false,
      prefixName: false,
      franchiseLink: false,
      reasons: ["type écarté (homonymie, liste, œuvre ou jeu)"],
    };
  }

  const wanted = new Set<string>();
  for (const variant of nameVariants(name)) wanted.add(variant);
  // Le titre de l'article fait foi au même titre que le libellé : certains
  // éléments n'ont pas de libellé dans la langue de leur article (Final
  // Fantasy IX n'a qu'un libellé japonais), et le titre reste la source
  // publique du nom.
  const names = [...facts.labels, ...(facts.articleTitles ?? [])];
  const exactName = names.some((label) => wanted.has(normalizeName(label)));
  const prefixName = !exactName && names.some((title) => prefixedBy(name, title));

  const franchiseLink = facts.inFranchiseWork || facts.listedByFranchise || facts.mentionsFranchise;

  const reasons: string[] = [];
  let score = 0;
  if (exactName) {
    score += weights.exactName;
    reasons.push("nom exact");
  } else if (prefixName) {
    score += weights.prefixName;
    reasons.push("nom complet de l'article");
  }
  if (facts.isFictionalCharacter) {
    score += weights.fictionalCharacter;
    reasons.push("personnage fictif");
  }
  if (franchiseLink) {
    score += weights.franchiseLink;
    reasons.push(
      facts.inFranchiseWork
        ? "présent dans une œuvre de la franchise"
        : facts.listedByFranchise
          ? "cité par la franchise"
          : "titre ou description citant la franchise",
    );
  }
  if (facts.hasWikipediaArticle) {
    score += weights.wikipediaArticle;
    reasons.push("article Wikipédia");
  }

  return {
    id: facts.id,
    score: Math.round(score * 1000) / 1000,
    exactName,
    prefixName,
    franchiseLink,
    reasons,
  };
}

export type MatchChoice =
  | { accepted: true; best: MatchScore; second: MatchScore | null; score: number }
  | { accepted: false; best: MatchScore | null; second: MatchScore | null; score: number };

/**
 * Retient un candidat s'il dépasse le seuil ET devance le deuxième d'au moins
 * l'écart minimal. À égalité de score, le plus de langues gagne, puis
 * l'identifiant (déterministe).
 */
export function chooseMatch(
  scores: MatchScore[],
  options: { threshold?: number; margin?: number } = {},
): MatchChoice {
  const threshold = options.threshold ?? MATCH_THRESHOLD;
  const margin = options.margin ?? MATCH_MARGIN;

  const sorted = [...scores].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id, "en", { numeric: true }),
  );
  const best = sorted[0] ?? null;
  const second = sorted[1] ?? null;

  if (!best || best.score < threshold) {
    return { accepted: false, best, second, score: best?.score ?? 0 };
  }
  if (second && best.score - second.score < margin - 1e-9) {
    return { accepted: false, best, second, score: best.score };
  }
  return { accepted: true, best, second, score: best.score };
}

// ————————————————————————————————————————————————————————————
//  Score de popularité
// ————————————————————————————————————————————————————————————

export type PopularityInput = {
  id: string;
  /** Somme des médianes mensuelles de pages vues, toutes langues. */
  pageviews: number;
  /** Nombre de langues où l'entité est présente (sitelinks). */
  languages: number;
};

/**
 * Rang percentile 0–1 de chaque entrée, égalités départagées par identifiant.
 * Le plus petit a 0, le plus grand 1.
 */
export function percentileRanks(entries: PopularityInput[]): Map<string, { pageviews: number; languages: number }> {
  const ranks = new Map<string, { pageviews: number; languages: number }>();
  if (entries.length === 0) return ranks;

  const byId = (a: PopularityInput, b: PopularityInput) =>
    a.id.localeCompare(b.id, "en", { numeric: true });

  const byViews = [...entries].sort((a, b) => a.pageviews - b.pageviews || byId(a, b));
  const byLangs = [...entries].sort((a, b) => a.languages - b.languages || byId(a, b));

  const share = (index: number, total: number) => (total <= 1 ? 1 : index / (total - 1));

  byViews.forEach((entry, index) => {
    ranks.set(entry.id, { pageviews: 0, languages: 0 });
    ranks.get(entry.id)!.pageviews = share(index, byViews.length);
  });
  byLangs.forEach((entry, index) => {
    const current = ranks.get(entry.id) ?? { pageviews: 0, languages: 0 };
    current.languages = share(index, byLangs.length);
    ranks.set(entry.id, current);
  });

  return ranks;
}

/**
 * Score 0–100 : 70 % pages vues, 30 % nombre de langues, chaque métrique
 * ramenée en rang percentile. Une entrée sans donnée vaut 0.
 */
export function popularityScores(
  entries: PopularityInput[],
  weights: { pageviews: number; languages: number } = POPULARITY_WEIGHTS,
): Map<string, number> {
  const ranks = percentileRanks(entries);
  const total = weights.pageviews + weights.languages || 1;
  const scores = new Map<string, number>();

  for (const entry of entries) {
    const rank = ranks.get(entry.id);
    if (!rank) {
      scores.set(entry.id, 0);
      continue;
    }
    const value = (weights.pageviews * rank.pageviews + weights.languages * rank.languages) / total;
    scores.set(entry.id, Math.round(value * 10000) / 100);
  }
  return scores;
}

/** `log10(1 + x)` borné à 0 pour les valeurs négatives absurdes. */
export function log10p1(value: number): number {
  return Math.log10(1 + Math.max(0, value));
}

// ————————————————————————————————————————————————————————————
//  Attribution des raretés
// ————————————————————————————————————————————————————————————

/** Part de chaque rareté ; contrôle au passage qu'elles somment à 1. */
export function rarityShares(shares: Record<Rarity, number> = RARITY_SHARES): Record<Rarity, number> {
  const sum = RARITY_ORDER.reduce((total, rarity) => total + shares[rarity], 0);
  if (Math.abs(sum - 1) > 1e-6) {
    throw new Error(`les parts de rareté doivent sommer à 1 (obtenu ${sum})`);
  }
  return shares;
}

/**
 * Effectifs cibles exacts pour `count` cartes : arrondi au plus proche, puis
 * les cartes restantes vont aux plus grandes parties fractionnaires (les
 * raretés les plus rares l'emportant à égalité).
 */
export function targetCounts(
  count: number,
  shares: Record<Rarity, number> = rarityShares(),
): Record<Rarity, number> {
  const counts = {} as Record<Rarity, number>;
  const remainders: { rarity: Rarity; rest: number }[] = [];
  let assigned = 0;

  for (const rarity of RARITY_ORDER) {
    const exact = count * shares[rarity];
    const floor = Math.floor(exact);
    counts[rarity] = floor;
    assigned += floor;
    remainders.push({ rarity, rest: exact - floor });
  }

  const order = RARITY_ORDER;
  remainders.sort((a, b) => b.rest - a.rest || order.indexOf(a.rarity) - order.indexOf(b.rarity));
  for (let index = 0; assigned < count; index += 1) {
    const entry = remainders[index % remainders.length];
    counts[entry.rarity] += 1;
    assigned += 1;
  }

  return counts;
}

/** Index d'un palier : 0 = Mythique (le plus rare), 5 = Commune. */
export function tierIndex(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export type DistributionCard = {
  id: string;
  franchiseId: string;
  rarity: Rarity;
  popularityScore: number;
  rarityOverride?: Rarity | null;
  rarityLocked?: boolean;
};

export type DistributionResult = {
  rarities: Map<string, Rarity>;
  /** Cartes dont la rareté ne vient pas du rang (override ou verrou). */
  fixed: Map<string, "override" | "locked">;
  /** Cartes descendues d'un palier à cause du plafond de leur franchise. */
  capped: { id: string; franchiseId: string; from: Rarity; to: Rarity }[];
  /** Effectifs obtenus, par rareté. */
  counts: Record<Rarity, number>;
};

export type TargetAdjustment = {
  targets: Record<Rarity, number>;
  /** Paliers réduits faute de candidats éligibles, avec le nombre manquant. */
  reduced: Partial<Record<Rarity, number>>;
};

/**
 * Réduit les paliers hauts quand les personnages vérifiés ne suffisent pas.
 *
 * Le manque est reporté sur les paliers **plus communs** que le palier le plus
 * bas réduit, au prorata de leurs parts de base : les paliers hauts non réduits
 * ne sont donc jamais gonflés, et aucune carte en repli ne prend la place d'un
 * vérifié. Le total reste exactement le même.
 */
export function adjustTargets(
  base: Record<Rarity, number>,
  available: Partial<Record<Rarity, number>>,
): TargetAdjustment {
  const targets = { ...base };
  const reduced: Partial<Record<Rarity, number>> = {};
  let pool = 0;
  let lowestReduced = -1;

  for (const rarity of RARITY_ORDER) {
    const limit = available[rarity];
    if (limit === undefined || base[rarity] <= limit) continue;
    reduced[rarity] = base[rarity] - limit;
    pool += reduced[rarity]!;
    targets[rarity] = limit;
    lowestReduced = Math.max(lowestReduced, tierIndex(rarity));
  }

  if (pool === 0) return { targets, reduced };

  // Le manque d'un palier haut descend au mieux en Rare : les paliers
  // Mythique, Légendaire et Épique ne sont jamais gonflés au-delà de leurs
  // vérifiés disponibles. Si le palier réduit est déjà Rare, on descend plus
  // bas ; s'il ne reste plus rien, on répartit sur les paliers non réduits.
  const floor = Math.max(lowestReduced + 1, tierIndex("R"));
  const lower = RARITY_ORDER.filter(
    (rarity) => !reduced[rarity] && tierIndex(rarity) >= floor,
  );
  const recipients = lower.length
    ? lower
    : RARITY_ORDER.filter((rarity) => !reduced[rarity]);
  const weights = recipients.map((rarity) => base[rarity]);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);

  if (totalWeight === 0) {
    recipients[0] = recipients[0] ?? "C";
    targets[recipients[0]] += pool;
    return { targets, reduced };
  }

  const raw = weights.map((weight) => (pool * weight) / totalWeight);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = pool - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - floors[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);

  recipients.forEach((rarity, index) => {
    targets[rarity] += floors[index];
  });
  for (const entry of order) {
    if (remainder <= 0) break;
    targets[recipients[entry.index]] += 1;
    remainder -= 1;
  }

  return { targets, reduced };
}

/**
 * Attribue une rareté à chaque carte.
 *
 * 1. Les cartes `rarity_override` / `rarity_locked` gardent leur rareté et
 *    consomment une place.
 * 2. Les autres sont classées par popularité (égalités départagées par
 *    identifiant) et prennent le palier le plus rare encore disponible.
 * 3. Si la franchise a atteint son plafond, la carte descend d'un palier : la
 *    place laissée libre revient de fait au personnage suivant du classement,
 *    puisque le compteur du palier n'a pas bougé.
 */
export function distributeRarities(
  cards: DistributionCard[],
  options: {
    shares?: Record<Rarity, number>;
    caps?: Partial<Record<Rarity, number>>;
    /** Effectifs exacts, prioritaires sur les parts (voir `adjustTargets`). */
    targets?: Record<Rarity, number>;
    /** Un palier peut être interdit à certaines cartes (repli, confiance). */
    eligible?: Partial<Record<Rarity, (card: DistributionCard) => boolean>>;
  } = {},
): DistributionResult {
  const shares = options.shares ?? rarityShares();
  const caps = options.caps ?? FRANCHISE_CAPS;
  const targets = options.targets ? { ...options.targets } : targetCounts(cards.length, shares);
  const eligible = options.eligible ?? {};

  const counts = {} as Record<Rarity, number>;
  for (const rarity of RARITY_ORDER) counts[rarity] = 0;

  const fixed = new Map<string, "override" | "locked">();
  const rarities = new Map<string, Rarity>();
  const perFranchise = new Map<string, Map<Rarity, number>>();

  const bump = (franchiseId: string, rarity: Rarity) => {
    const slots = perFranchise.get(franchiseId) ?? new Map<Rarity, number>();
    slots.set(rarity, (slots.get(rarity) ?? 0) + 1);
    perFranchise.set(franchiseId, slots);
  };

  const remaining = { ...targets };
  const open: DistributionCard[] = [];

  for (const card of cards) {
    const forced = card.rarityOverride ?? (card.rarityLocked ? card.rarity : null);
    if (forced) {
      rarities.set(card.id, forced);
      fixed.set(card.id, card.rarityOverride ? "override" : "locked");
      counts[forced] += 1;
      remaining[forced] = Math.max(0, remaining[forced] - 1);
      bump(card.franchiseId, forced);
    } else {
      open.push(card);
    }
  }

  // Classement : score décroissant, puis identifiant croissant (déterministe).
  open.sort(
    (a, b) =>
      b.popularityScore - a.popularityScore ||
      a.id.localeCompare(b.id, "en", { numeric: true }),
  );

  const capped: DistributionResult["capped"] = [];
  const leftovers: DistributionCard[] = [];

  for (const card of open) {
    const slots = perFranchise.get(card.franchiseId) ?? new Map<Rarity, number>();
    let placed: Rarity | null = null;

    for (const rarity of RARITY_ORDER) {
      if (remaining[rarity] <= 0) continue;
      if (eligible[rarity] && !eligible[rarity]!(card)) continue;
      const cap = caps[rarity];
      if (cap !== undefined && (slots.get(rarity) ?? 0) >= cap) continue;
      placed = rarity;
      break;
    }

    if (!placed) {
      // Tous les paliers sont pleins : la carte attend la fin du classement.
      leftovers.push(card);
      continue;
    }

    // Le palier que le rang seul donnerait (plafonds ignorés) : s'il est plus
    // rare que celui obtenu, c'est le plafond de la franchise qui a joué.
    const byRank = RARITY_ORDER.find(
      (rarity) => remaining[rarity] > 0 && (!eligible[rarity] || eligible[rarity]!(card)),
    );
    if (byRank && tierIndex(placed) > tierIndex(byRank)) {
      capped.push({ id: card.id, franchiseId: card.franchiseId, from: byRank, to: placed });
    }

    rarities.set(card.id, placed);
    counts[placed] += 1;
    remaining[placed] -= 1;
    bump(card.franchiseId, placed);
  }

  // Les paliers hauts bloqués par les plafonds libèrent leurs places vers le
  // bas : aucune carte ne reste sans rareté, et les effectifs restent exacts.
  for (const card of leftovers) {
    const slots = perFranchise.get(card.franchiseId) ?? new Map<Rarity, number>();
    const fallback =
      [...RARITY_ORDER].reverse().find((rarity) => {
        if (eligible[rarity] && !eligible[rarity]!(card)) return false;
        const cap = caps[rarity];
        return cap === undefined || (slots.get(rarity) ?? 0) < cap;
      }) ?? "C";
    rarities.set(card.id, fallback);
    counts[fallback] += 1;
    bump(card.franchiseId, fallback);
  }

  return { rarities, fixed, capped, counts };
}

/** Écart de paliers entre deux raretés (0 = inchangée). */
export function tierGap(from: Rarity, to: Rarity): number {
  return Math.abs(tierIndex(from) - tierIndex(to));
}

export const POPULARITY_LANGUAGES = LANGUAGES;
