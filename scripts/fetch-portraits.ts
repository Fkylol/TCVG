/**
 * Récupère les visuels de personnages depuis l'API Wikipédia (anglophone) et écrit
 * src/data/portraits.json.
 *
 * Les images NE SONT PAS téléchargées : on ne stocke que l'URL upload.wikimedia.org
 * et les crédits. La plupart de ces visuels sont en « fair use » sur Wikipédia, donc
 * valables uniquement dans le cadre de l'article : voir la note légale du README.
 *
 * La correspondance carte → article est volontairement explicite : la recherche
 * automatique ramenait des pages hors sujet (Baldur → Baldur's Gate, etc.). Une carte
 * absente de cette table garde le fallback dégradé + emoji.
 *
 * Usage : npm run portraits
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CARDS } from "../src/lib/cards";

const API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT = "TCVG-fan-project/1.0 (projet de collection de cartes, usage personnel)";
const THUMB_SIZE = 720;
const OUTPUT = path.join(process.cwd(), "src", "data", "portraits.json");

/** Carte → article Wikipédia portant le visuel du personnage. */
const WIKI_TITLES: Record<string, string> = {
  kratos: "Kratos (God of War)",
  mario: "Mario",
  luigi: "Luigi (character)",
  bowser: "Bowser",
  peach: "Princess Peach",
  yoshi: "Yoshi",
  "banjo-kazooie": "Banjo & Kazooie",
  spyro: "Spyro (character)",
  link: "Link (The Legend of Zelda)",
  zelda: "Princess Zelda",
  ganondorf: "Ganondorf",
  sonic: "Sonic the Hedgehog",
  eggman: "Doctor Eggman",
  shadow: "Shadow the Hedgehog",
  knuckles: "Knuckles the Echidna",
  cloud: "Cloud Strife",
  sephiroth: "Sephiroth (Final Fantasy)",
  aerith: "Aerith Gainsborough",
  tifa: "Tifa Lockhart",
  solaire: "Solaire of Astora",
  "le-chevalier": "The Knight (Hollow Knight)",
  hornet: "Hornet (Hollow Knight)",
  glados: "GLaDOS",
  chell: "Chell (Portal)",
  wheatley: "Wheatley (Portal)",
  "master-chief": "Master Chief (Halo)",
  cortana: "Cortana (Halo)",
  arbiter: "Arbiter (Halo)",
  steve: "Steve (Minecraft)",
  creeper: "Creeper (Minecraft)",
  "doom-slayer": "Doomguy",
  geralt: "Geralt of Rivia",
  crash: "Crash Bandicoot (character)",
  cortex: "Doctor Neo Cortex",
  samus: "Samus Aran",
  ridley: "Ridley (Metroid)",
  alucard: "Alucard (Castlevania)",
  dracula: "Dracula (Castlevania)",
  simon: "Simon Belmont",
  sans: "Sans (Undertale)",
  papyrus: "Papyrus (Undertale)",
  flowey: "Flowey",
  malenia: "Malenia",
  radahn: "Starscourge Radahn",
  reaper: "Reaper (Overwatch)",
  mercy: "Mercy (Overwatch)",
  sora: "Sora (Kingdom Hearts)",
  xehanort: "Xehanort",
  dante: "Dante (Devil May Cry)",
  vergil: "Vergil (Devil May Cry)",
  nemesis: "Nemesis (Resident Evil)",
  ryu: "Ryu (Street Fighter)",
  bison: "M. Bison",
  kirby: "Kirby (character)",
  "meta-knight": "Meta Knight",
  pikachu: "Pikachu",
  mewtwo: "Mewtwo",
  charizard: "Charizard",
  gordon: "Gordon Freeman",
  cuphead: "Cuphead (character)",
  "king-dice": "King Dice",
  madeline: "Madeline (Celeste)",
  joker: "Joker (Persona 5)",
  "2b": "2B (Nier: Automata)",
};

type WikiPage = {
  title: string;
  missing?: boolean;
  pageimage?: string;
  pageprops?: { disambiguation?: string };
  thumbnail?: { source: string; width: number; height: number };
};

type QueryResponse = {
  query?: {
    pages?: WikiPage[];
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
  };
};

type Portrait = {
  url: string;
  wikiTitle: string;
  page: string;
  file: string;
  width: number;
  height: number;
  credit?: string;
  license?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** L'API anonyme limite vite le débit : un appel toutes les 1,2 s minimum. */
const MIN_INTERVAL_MS = 1200;
let lastRequestAt = 0;

async function waitForSlot() {
  const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function api(params: Record<string, string>, attempt = 0): Promise<QueryResponse> {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params }).toString();

  await waitForSlot();

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!response.ok) {
    if (attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(30_000, 3000 * 2 ** attempt);
      console.warn(`   … ${response.status}, pause ${Math.round(delay / 1000)} s`);
      await sleep(delay);
      return api(params, attempt + 1);
    }
    throw new Error(`API Wikipédia ${response.status} (${params.titles ?? ""})`);
  }

  const raw = await response.text();
  try {
    return JSON.parse(raw) as QueryResponse;
  } catch {
    if (attempt < 6) {
      await sleep(5000 * (attempt + 1));
      return api(params, attempt + 1);
    }
    throw new Error(`Réponse illisible de l'API : ${raw.slice(0, 120)}`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Retire les paramètres de tracking ajoutés par l'API. */
function cleanUrl(source: string): string {
  return source.split("?")[0];
}

function resolveAlias(data: QueryResponse, wanted: string): string {
  let title = wanted;
  for (const entry of data.query?.normalized ?? []) if (entry.from === title) title = entry.to;
  for (const entry of data.query?.redirects ?? []) if (entry.from === title) title = entry.to;
  return title;
}

/** Les titres de fichiers utilisent des espaces, les réponses de l'API parfois des underscores. */
function normalizeFileName(value: string): string {
  return value.replace(/_/g, " ").trim();
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

async function main() {
  const wanted = CARDS.filter((card) => WIKI_TITLES[card.id]).map((card) => ({
    card,
    title: WIKI_TITLES[card.id],
  }));

  console.log(`→ ${wanted.length}/${CARDS.length} cartes avec un article Wikipédia connu`);

  // 1. Résolution groupée des titres (l'API accepte plusieurs dizaines de titres par appel).
  const pagesByTitle = new Map<string, WikiPage>();
  for (const group of chunk(wanted, 45)) {
    const titles = Array.from(new Set(group.map((item) => item.title)));
    const data = await api({
      action: "query",
      prop: "pageimages|pageprops",
      piprop: "thumbnail|name",
      pilicense: "any",
      pithumbsize: String(THUMB_SIZE),
      redirects: "1",
      titles: titles.join("|"),
    });

    for (const title of titles) {
      const finalTitle = resolveAlias(data, title);
      const page = data.query?.pages?.find((candidate) => candidate.title === finalTitle);
      if (page) pagesByTitle.set(title, page);
    }
  }

  // 2. Construction des portraits (on ignore les pages d'homonymie et les pages sans visuel).
  const portraits: Record<string, Portrait> = {};
  const missing: string[] = [];

  for (const { card, title } of wanted) {
    const page = pagesByTitle.get(title);
    if (!page || page.missing || !page.thumbnail?.source || page.pageprops?.disambiguation) {
      missing.push(`${card.id} (${title})`);
      continue;
    }

    portraits[card.id] = {
      url: cleanUrl(page.thumbnail.source),
      wikiTitle: page.title,
      page: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      file: normalizeFileName(page.pageimage ?? ""),
      width: page.thumbnail.width,
      height: page.thumbnail.height,
    };
  }

  // 3. Crédits : un seul appel pour tous les fichiers.
  const files = Array.from(new Set(Object.values(portraits).map((portrait) => portrait.file).filter(Boolean)));

  for (const group of chunk(files, 40)) {
    try {
      const data = await api({
        action: "query",
        prop: "imageinfo",
        iiprop: "extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName",
        titles: group.map((file) => `File:${file}`).join("|"),
      });

      for (const page of data.query?.pages ?? []) {
        const file = normalizeFileName(page.title.replace(/^File:/, ""));
        const meta = (page as unknown as { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] })
          .imageinfo?.[0]?.extmetadata;

        for (const portrait of Object.values(portraits)) {
          if (normalizeFileName(portrait.file) !== file || !meta) continue;
          portrait.credit = stripHtml(meta.Artist?.value);
          portrait.license = stripHtml(meta.LicenseShortName?.value);
        }
      }
    } catch (error) {
      console.warn(`   ! crédits partiels : ${(error as Error).message}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(portraits).sort(([a], [b]) => a.localeCompare(b)));

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(
    OUTPUT,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "en.wikipedia.org",
        note: "Visuels hotlinkés depuis upload.wikimedia.org. Projet de fan non officiel : la plupart de ces images sont en fair use sur Wikipédia (voir README).",
        items: sorted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`✓ ${Object.keys(sorted).length} visuels écrits dans src/data/portraits.json`);
  if (missing.length > 0) {
    console.log(`\nSans visuel (fallback dégradé + emoji) :\n  ${missing.join("\n  ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
