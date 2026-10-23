/**
 * Récupère les visuels de personnages et écrit src/data/portraits.json.
 *
 * Deux sources, dans cet ordre :
 *   1. Wikipédia (anglophone) — article dédié, pour 64 cartes ;
 *   2. Fandom — wiki de la franchise, pour les personnages qui n'ont pas d'article
 *      Wikipédia avec visuel (Ripto, Gruntilda, Artorias…).
 *
 * Les images NE SONT PAS téléchargées : on ne stocke que l'URL distante et les crédits.
 * Les deux sources sont majoritairement en « fair use » : voir la note légale du README.
 *
 * La correspondance carte → page est volontairement explicite : la recherche
 * automatique ramenait des pages hors sujet (Baldur → Baldur's Gate, etc.).
 *
 * Usage : npm run portraits
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CARDS } from "../src/lib/cards";

const USER_AGENT = "TCVG-fan-project/1.0 (projet de collection de cartes, usage personnel)";
const THUMB_SIZE = 720;
const OUTPUT = path.join(process.cwd(), "src", "data", "portraits.json");
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

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
  zelda: "Princess Zelda",
  ganondorf: "Ganondorf",
  shadow: "Shadow the Hedgehog",
  cloud: "Cloud Strife",
  sephiroth: "Sephiroth (Final Fantasy)",
  aerith: "Aerith Gainsborough",
  tifa: "Tifa Lockhart",
  solaire: "Solaire of Astora",
  hornet: "Hornet (Hollow Knight)",
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

/** Carte → page du wiki de la franchise, pour les personnages absents de Wikipédia. */
const FANDOM_TITLES: Record<string, { wiki: string; title: string }> = {
  // Ces personnages ont un article Wikipédia, mais son image d'illustration
  // n'est pas le personnage : logo de la franchise (Sonic), boîte du jeu
  // (Le Chevalier), planche de tous les designs (Link, Knuckles), ou décor
  // vide. Le wiki de la franchise, lui, expose un rendu du personnage.
  sonic: { wiki: "sonic.fandom.com", title: "Sonic the Hedgehog" },
  eggman: { wiki: "sonic.fandom.com", title: "Doctor Eggman" },
  knuckles: { wiki: "sonic.fandom.com", title: "Knuckles the Echidna" },
  link: { wiki: "zelda.fandom.com", title: "Link" },
  "le-chevalier": { wiki: "hollowknight.fandom.com", title: "The Knight" },
  xehanort: { wiki: "kingdomhearts.fandom.com", title: "Master Xehanort" },
  atreus: { wiki: "godofwar.fandom.com", title: "Atreus" },
  baldur: { wiki: "godofwar.fandom.com", title: "Baldur" },
  freya: { wiki: "godofwar.fandom.com", title: "Freya" },
  gruntilda: { wiki: "banjokazooie.fandom.com", title: "Gruntilda" },
  mumbo: { wiki: "banjokazooie.fandom.com", title: "Mumbo Jumbo" },
  ripto: { wiki: "spyro.fandom.com", title: "Ripto" },
  hunter: { wiki: "spyro.fandom.com", title: "Hunter" },
  majora: { wiki: "zelda.fandom.com", title: "Majora" },
  artorias: { wiki: "darksouls.fandom.com", title: "Artorias" },
  gwyn: { wiki: "darksouls.fandom.com", title: "Gwyn" },
  "ender-dragon": { wiki: "minecraft.fandom.com", title: "Ender Dragon" },
  ciri: { wiki: "witcher.fandom.com", title: "Ciri" },
  yennefer: { wiki: "witcher.fandom.com", title: "Yennefer" },
  tracer: { wiki: "overwatch.fandom.com", title: "Tracer" },
  leon: { wiki: "residentevil.fandom.com", title: "Leon S. Kennedy" },
  "chun-li": { wiki: "streetfighter.fandom.com", title: "Chun-Li" },
  "king-dedede": { wiki: "kirby.fandom.com", title: "King Dedede" },
  "g-man": { wiki: "half-life.fandom.com", title: "G-Man" },
  inkling: { wiki: "splatoon.fandom.com", title: "Inkling" },
};

/**
 * Visuels choisis explicitement à la main : la page du wiki renvoie une capture
 * de jeu ou une image de costume plutôt qu'un rendu du personnage.
 */
const FANDOM_FILES: Record<string, { wiki: string; file: string }> = {
  grimm: { wiki: "hollowknight.fandom.com", file: "Grimm Idle.png" },
  glados: { wiki: "half-life.fandom.com", file: "GladosArms2 TRANSPARENT.png" },
};

/**
 * Les visuels Fandom sont servis par un CDN Cloudflare qui exige des en-têtes
 * navigateur (`Sec-Fetch-*` ou `Referer`). Un navigateur les envoie toujours,
 * donc le hotlink fonctionne — mais un client HTTP nu (curl, bots) reçoit un 403.
 */

type WikiPage = {
  title: string;
  missing?: boolean;
  pageimage?: string;
  pageprops?: { disambiguation?: string };
  thumbnail?: { source: string; width: number; height: number };
  imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number }[];
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
  source: "wikipedia" | "fandom";
  wikiHost?: string;
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

async function api(
  baseUrl: string,
  params: Record<string, string>,
  attempt = 0,
): Promise<QueryResponse> {
  const url = new URL(baseUrl);
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
      console.warn(`   … ${response.status} sur ${new URL(baseUrl).host}, pause ${Math.round(delay / 1000)} s`);
      await sleep(delay);
      return api(baseUrl, params, attempt + 1);
    }
    throw new Error(`API ${new URL(baseUrl).host} → ${response.status} (${params.titles ?? ""})`);
  }

  const raw = await response.text();
  try {
    return JSON.parse(raw) as QueryResponse;
  } catch {
    if (attempt < 6) {
      await sleep(5000 * (attempt + 1));
      return api(baseUrl, params, attempt + 1);
    }
    throw new Error(`Réponse illisible de ${new URL(baseUrl).host} : ${raw.slice(0, 120)}`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Wikipédia ajoute des paramètres de tracking ; Fandom utilise ses query strings pour la mise à l'échelle. */
function cleanUrl(source: string): string {
  const host = new URL(source).hostname;
  return host.endsWith("wikimedia.org") ? source.split("?")[0] : source;
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

/**
 * Un logo ou une jaquette n'est pas un portrait. Les articles de franchise les
 * exposent volontiers comme image d'illustration (Sonic → logo Sega), d'où ce
 * filtre : une carte concernée est signalée puis laissée à une autre source.
 */
const NOT_A_PORTRAIT = /\.svg$|logo|cover|box art|montage/i;

function toPortrait(
  page: WikiPage,
  source: "wikipedia" | "fandom",
  pageUrl: (title: string) => string,
  wikiHost?: string,
): Portrait | null {
  if (!page.thumbnail?.source || page.pageprops?.disambiguation) return null;
  if (NOT_A_PORTRAIT.test(page.pageimage ?? "")) {
    console.warn(`   ! visuel écarté (logo/jaquette) sur « ${page.title} » : ${page.pageimage}`);
    return null;
  }
  return {
    url: cleanUrl(page.thumbnail.source),
    source,
    wikiHost,
    wikiTitle: page.title,
    page: pageUrl(page.title),
    file: normalizeFileName(page.pageimage ?? ""),
    width: page.thumbnail.width,
    height: page.thumbnail.height,
  };
}

async function main() {
  const portraits: Record<string, Portrait> = {};
  const missing: string[] = [];

  // ————— 1. Wikipédia —————
  const fromWikipedia = CARDS.filter((card) => WIKI_TITLES[card.id]).map((card) => ({
    card,
    title: WIKI_TITLES[card.id],
  }));

  console.log(`→ Wikipédia : ${fromWikipedia.length} cartes`);

  const pagesByTitle = new Map<string, WikiPage>();
  for (const group of chunk(fromWikipedia, 45)) {
    const titles = Array.from(new Set(group.map((item) => item.title)));
    const data = await api(WIKIPEDIA_API, {
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

  for (const { card, title } of fromWikipedia) {
    const page = pagesByTitle.get(title);
    const portrait = page
      ? toPortrait(
          page,
          "wikipedia",
          (wikiTitle) => `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
        )
      : null;

    if (portrait) portraits[card.id] = portrait;
    else missing.push(`${card.id} (wikipédia : ${title})`);
  }

  // ————— 2. Fandom —————
  const byWiki = new Map<string, { cardId: string; title: string }[]>();
  for (const card of CARDS) {
    if (portraits[card.id]) continue;
    const entry = FANDOM_TITLES[card.id];
    if (!entry) continue;
    const list = byWiki.get(entry.wiki) ?? [];
    list.push({ cardId: card.id, title: entry.title });
    byWiki.set(entry.wiki, list);
  }

  const fandomTotal = Array.from(byWiki.values()).reduce((sum, list) => sum + list.length, 0);
  console.log(`→ Fandom : ${fandomTotal} cartes sur ${byWiki.size} wikis`);

  for (const [wiki, items] of byWiki) {
    let data: QueryResponse | null = null;

    try {
      data = await api(`https://${wiki}/api.php`, {
        action: "query",
        prop: "pageimages|pageprops",
        piprop: "thumbnail|name",
        pithumbsize: String(THUMB_SIZE),
        redirects: "1",
        titles: Array.from(new Set(items.map((item) => item.title))).join("|"),
      });
    } catch (error) {
      console.warn(`   ! ${wiki} : ${(error as Error).message}`);
    }

    for (const item of items) {
      const finalTitle = data ? resolveAlias(data, item.title) : item.title;
      const page = data?.query?.pages?.find((candidate) => candidate.title === finalTitle);
      const portrait = page
        ? toPortrait(
            page,
            "fandom",
            (wikiTitle) => `https://${wiki}/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
            wiki,
          )
        : null;

      if (portrait) portraits[item.cardId] = portrait;
      else missing.push(`${item.cardId} (${wiki} : ${item.title})`);
    }
  }

  // ————— 2 bis. Visuels choisis fichier par fichier —————
  const filesByWiki = new Map<string, { cardId: string; file: string }[]>();
  for (const card of CARDS) {
    if (portraits[card.id]) continue;
    const entry = FANDOM_FILES[card.id];
    if (!entry) continue;
    const list = filesByWiki.get(entry.wiki) ?? [];
    list.push({ cardId: card.id, file: entry.file });
    filesByWiki.set(entry.wiki, list);
  }

  for (const [wiki, items] of filesByWiki) {
    let data: QueryResponse | null = null;

    try {
      data = await api(`https://${wiki}/api.php`, {
        action: "query",
        prop: "imageinfo",
        iiprop: "url|size",
        iiurlwidth: String(THUMB_SIZE),
        titles: items.map((item) => `File:${item.file}`).join("|"),
      });
    } catch (error) {
      console.warn(`   ! ${wiki} : ${(error as Error).message}`);
    }

    for (const item of items) {
      const page = data?.query?.pages?.find(
        (candidate) => normalizeFileName(candidate.title.replace(/^File:/, "")) === item.file,
      );
      const info = page?.imageinfo?.[0];
      const source = info?.thumburl ?? info?.url;

      if (!page || !source) {
        missing.push(`${item.cardId} (${wiki} : File:${item.file})`);
        continue;
      }

      portraits[item.cardId] = {
        url: cleanUrl(source),
        source: "fandom",
        wikiHost: wiki,
        wikiTitle: item.file,
        page: `https://${wiki}/wiki/${encodeURIComponent(`File:${item.file}`.replace(/ /g, "_"))}`,
        file: item.file,
        width: info?.width ?? 0,
        height: info?.height ?? 0,
      };
    }
  }

  // ————— 3. Crédits Wikipédia —————
  const wikipediaFiles = Array.from(
    new Set(
      Object.values(portraits)
        .filter((portrait) => portrait.source === "wikipedia")
        .map((portrait) => portrait.file)
        .filter(Boolean),
    ),
  );

  for (const group of chunk(wikipediaFiles, 40)) {
    try {
      const data = await api(WIKIPEDIA_API, {
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
          if (portrait.source !== "wikipedia") continue;
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
        note: "Visuels hotlinkés (Wikipédia, puis Fandom pour les personnages sans article). Projet de fan non officiel : la plupart de ces images sont en fair use (voir README).",
        items: sorted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`✓ ${Object.keys(sorted).length}/${CARDS.length} visuels écrits dans src/data/portraits.json`);
  if (missing.length > 0) {
    console.log(`\nSans visuel (fallback dégradé + emoji) :\n  ${missing.join("\n  ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
