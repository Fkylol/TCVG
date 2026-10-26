/**
 * Contrôle des visuels de cartes : poids et disponibilité.
 *
 * Les portraits sont hotlinkés (Wikipédia, Fandom) et rien ne garantit qu'une
 * vignette reste légère : un PNG pleine résolution ou un GIF animé peut peser
 * plusieurs centaines de Ko, ce qui se voit à la révélation d'un booster. Ce
 * script rejoue une requête par visuel, comme le navigateur, et signale :
 *
 *   - les fichiers au-delà de `MAX_BYTES` ;
 *   - les GIF animés (impossibles à alléger côté CDN) ;
 *   - les réponses non-images ou en erreur ;
 *   - les cartes du catalogue sans visuel.
 *
 * Fandom limite les rafales (HTTP 429) : on reste à `WORKERS` requêtes
 * simultanées, avec un temps d'attente croissant entre deux essais.
 *
 * Usage : npm run portraits:audit
 */

import fs from "node:fs/promises";
import path from "node:path";

import { CARDS } from "../src/lib/cards";

const OUTPUT = path.join(process.cwd(), "src", "data", "portraits.json");
// Seuil pragmatique : une illustration détourée en PNG plafonne autour de
// 250–280 Ko à 500 px, et descendre plus bas donne une carte floue. Au-delà de
// 300 Ko, c'est le signe d'un fichier servi en pleine résolution.
const MAX_BYTES = 300 * 1024;
/** En dessous, le visuel est trop petit pour une carte (icône, sprite 2008). */
const MIN_WIDTH = 200;
const WORKERS = 3;
const GAP_MS = 60;
const ATTEMPTS = 6;

const HEADERS = {
  Referer: "https://tcvg.fun/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
  Accept: "image/avif,image/webp,image/*",
};

type Result = {
  id: string;
  status: number;
  bytes: number;
  type: string;
  url: string;
  /** Dernière réponse : 429. Le fichier n'est pas en cause, c'est la limite d'IP. */
  limited: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Une requête, avec les réessais nécessaires sur les 429 et les 5xx. */
async function measure(id: string, url: string): Promise<Result> {
  let limited = false;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (response.status === 429 || response.status >= 500) {
        limited = response.status === 429;
        // Wikipédia limite durement les rafales : on double l'attente à chaque essai.
        await sleep(800 * 2 ** (attempt - 1));
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      const body = await response.arrayBuffer();
      return { id, status: response.status, bytes: body.byteLength, type, url, limited: false };
    } catch {
      await sleep(300 * attempt);
    }
  }
  return { id, status: 0, bytes: 0, type: limited ? "limité" : "introuvable", url, limited };
}

const kib = (bytes: number) => `${Math.round(bytes / 1024)} Ko`;
const bare = (url: string) => url.split("?")[0].split("/").pop() ?? url;

async function main() {
  const data = JSON.parse(await fs.readFile(OUTPUT, "utf8")) as {
    items: Record<string, { url: string; width?: number }>;
  };
  const items = Object.entries(data.items);
  const results: Result[] = [];

  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const [id, portrait] = items[cursor++];
      results.push(await measure(id, portrait.url));
      await sleep(GAP_MS);
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));

  const limited = results.filter((r) => r.limited);
  const broken = results.filter((r) => !r.limited && (r.status !== 200 || !r.type.startsWith("image/")));
  const animated = results.filter((r) => r.type.includes("gif"));
  const heavy = results
    .filter((r) => r.status === 200 && r.bytes > MAX_BYTES)
    .sort((a, b) => b.bytes - a.bytes);
  const noPortrait = CARDS.filter((card) => !data.items[card.id]);
  const tooSmall = Object.entries(data.items)
    .filter(([, portrait]) => (portrait.width ?? 0) < MIN_WIDTH)
    .map(([id, portrait]) => `${id} (${portrait.width ?? 0} px)`);

  const total = results.reduce((sum, r) => sum + r.bytes, 0);
  console.log(`${results.length} visuels, ${kib(total)} au total\n`);

  if (heavy.length > 0) {
    console.log(`Au-dessus de ${kib(MAX_BYTES)} :`);
    for (const r of heavy) console.log(`  ${kib(r.bytes).padStart(7)}  ${r.id}  ${bare(r.url)}`);
    console.log("");
  }

  if (animated.length > 0) {
    console.log("GIF animés (à remplacer par un rendu statique) :");
    for (const r of animated) console.log(`  ${kib(r.bytes).padStart(7)}  ${r.id}`);
    console.log("");
  }

  if (broken.length > 0) {
    console.log("Réponses inexploitables :");
    for (const r of broken) console.log(`  ${r.status || "—"}  ${r.id}  ${bare(r.url)}`);
    console.log("");
  }

  if (limited.length > 0) {
    console.log(
      `Limités par le CDN (429) après ${ATTEMPTS} essais — relancer plus tard, rien ne prouve que le fichier soit en cause :`,
    );
    for (const r of limited) console.log(`  ${r.id}  ${bare(r.url)}`);
    console.log("");
  }

  if (noPortrait.length > 0) {
    console.log("Cartes sans visuel (dégradé + emoji) :");
    for (const card of noPortrait) console.log(`  ${card.id}`);
    console.log("");
  }

  if (tooSmall.length > 0) {
    console.log(`À surveiller — visuels plus étroits que ${MIN_WIDTH} px, donc agrandis sur une carte :`);
    for (const entry of tooSmall) console.log(`  ${entry}`);
    console.log("");
  }

  // Un 429 et un visuel étroit ne font pas échouer le contrôle : le premier est
  // un incident d'IP, le second un compromis assumé faute de meilleur fichier.
  const problems = heavy.length + broken.length + animated.length;
  console.log(
    problems === 0
      ? "OK : tous les visuels répondent et restent sous la limite."
      : `${problems} point(s) à corriger.`,
  );
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
