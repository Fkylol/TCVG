/**
 * État de travail du pipeline de popularité, entre deux scripts.
 *
 * `.popularity/dataset.json` contient les cartes, leurs correspondances, leurs
 * pages vues et leur score. Chaque étape le lit, l'enrichit et le réécrit :
 * une interruption ne perd rien, il suffit de relancer la commande.
 *
 * Le fichier n'est pas versionné (voir .gitignore) : c'est un cache de travail,
 * la vérité reste en base.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { openRunner } from "../../lib/db-runner";

const DIR = path.join(process.cwd(), ".popularity");
const FILE = path.join(DIR, "dataset.json");

export type MatchStatus = "auto" | "repli" | "aucun";

export type MatchNotes = {
  /** Termes réellement interrogés, dans l'ordre. */
  attempts: string[];
  /** Identifiant retenu et libellé de l'entité. */
  chosen?: string;
  /** Meilleur candidat refusé, s'il y en a un. */
  runnerUp?: string;
  /** Indices retenus pour le barème. */
  evidence?: string[];
  /** Explications lisibles : rejets, ambiguïtés, revérifications. */
  notes: string[];
};

/**
 * Mesures internes au wiki de la franchise, pour les personnages sans article
 * propre (repli). Les percentiles ne sont calculés qu'entre personnages de la
 * même franchise.
 */
export type FallbackData = {
  /** `wiki` : rang interne calculé ; `franchise` : wiki/page absent, 0,3 × score. */
  method: "wiki" | "franchise";
  wikiHost: string | null;
  page: string | null;
  backlinks: number | null;
  pageSize: number | null;
  backlinksPercentile: number | null;
  pageSizePercentile: number | null;
  /** Moyenne pondérée interne à la franchise, de 0 à 100. */
  withinFranchiseScore: number | null;
  /** Raison lisible, reprise dans le rapport. */
  reason: string;
};

export type WikiReference = {
  host: string;
  api: string;
  /** Comment le wiki a été trouvé : lien officiel, Fandom deviné, recherche. */
  source: "official" | "fandom" | "search";
};

export type CardEntry = {
  id: string;
  name: string;
  universe: string;
  rarity: string;
  number: number;
  franchiseId: string;
  franchiseSlug: string;
  franchiseName: string;
  wikidataId: string | null;
  wikipediaTitles: Record<string, string> | null;
  matchStatus: MatchStatus;
  matchConfidence: number;
  matchNotes: MatchNotes;
  /** Rareté forcée à la main (prioritaire sur le calcul). */
  rarityOverride?: string | null;
  /** Rareté verrouillée : ne bouge plus. */
  rarityLocked?: boolean;
  /** Médiane mensuelle de pages vues par langue. */
  pageviews: Record<string, number> | null;
  pageviewsTotal: number | null;
  sitelinksCount: number | null;
  popularityScore: number | null;
  computedAt: string | null;
  /** Renseigné par `popularity:score` pour les cartes sans correspondance auto. */
  fallback?: FallbackData | null;
};

export type FranchiseEntry = {
  id: string;
  slug: string;
  name: string;
  wikidataId: string | null;
  wikipediaTitles: Record<string, string> | null;
  confidence: number;
  notes: string[];
  pageviews: Record<string, number> | null;
  pageviewsTotal: number | null;
  sitelinksCount: number | null;
  popularityScore: number | null;
  /** Wiki de la franchise, mémorisé pour éviter de le rechercher à chaque passage. */
  wiki?: WikiReference | null;
};

export type Dataset = {
  version: 1;
  createdAt: string;
  updatedAt: string;
  /** Année des données : 12 derniers mois complets au moment du calcul. */
  window?: { from: string; to: string };
  franchises: FranchiseEntry[];
  cards: CardEntry[];
};

export function datasetPath(): string {
  return FILE;
}

export async function loadDataset(): Promise<Dataset> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Dataset;
  } catch {
    throw new Error(
      "aucun jeu de données : lance d'abord `npm run popularity:match`, puis `popularity:fetch` et `popularity:score`.",
    );
  }
}

export async function saveDataset(dataset: Dataset): Promise<void> {
  dataset.updatedAt = new Date().toISOString();
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, `${JSON.stringify(dataset, null, 1)}\n`, "utf8");
}

/** Lit cartes et franchises actives en base pour amorcer le jeu de données. */
export async function loadSources(): Promise<{
  cards: CardEntry[];
  franchises: FranchiseEntry[];
  close: () => Promise<void>;
}> {
  const runner = await openRunner();
  try {
    const franchiseRows = await runner.query(`
      select f.id, f.slug, f.name
        from public.franchises f
       where f.active
       order by f.slug
    `);

    const cardRows = await runner.query(`
      select c.id, c.name, c.universe, c.rarity, c.number,
             c.franchise_id, f.slug as franchise_slug, f.name as franchise_name,
             c.rarity_override, c.rarity_locked
        from public.cards c
        join public.franchises f on f.id = c.franchise_id
       where c.active and f.active
       order by c.number
    `);

    return {
      franchises: franchiseRows.map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name),
        wikidataId: null,
        wikipediaTitles: null,
        confidence: 0,
        notes: [],
        pageviews: null,
        pageviewsTotal: null,
        sitelinksCount: null,
        popularityScore: null,
      })),
      cards: cardRows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        universe: String(row.universe),
        rarity: String(row.rarity),
        number: Number(row.number),
        franchiseId: String(row.franchise_id),
        franchiseSlug: String(row.franchise_slug),
        franchiseName: String(row.franchise_name),
        wikidataId: null,
        wikipediaTitles: null,
        matchStatus: "aucun" as MatchStatus,
        matchConfidence: 0,
        matchNotes: { attempts: [], notes: [] },
        rarityOverride: (row.rarity_override as string | null) ?? null,
        rarityLocked: Boolean(row.rarity_locked),
        pageviews: null,
        pageviewsTotal: null,
        sitelinksCount: null,
        popularityScore: null,
        computedAt: null,
      })),
      close: () => runner.close(),
    };
  } catch (error) {
    await runner.close();
    throw error;
  }
}
