/**
 * État des visuels de tout le catalogue (étape 1 + étape 3).
 *
 * Pour chaque carte : l'URL retenue (fichier local, puis manifeste, puis
 * colonne `image_url`) est téléchargée en en-tête et vérifiée — 200, type
 * image, dimensions, rapport, nom de fichier, hotlink. Les doublons d'URL sont
 * signalés : une image ne peut pas illustrer deux personnages.
 *
 *   npm run images:check
 *   npm run images:check -- --fresh     (ignore le cache disque)
 *   npm run images:check -- --json      (sortie machine pour d'autres outils)
 *
 * Rien n'est modifié : le script n'écrit que `.images/check.json`.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { loadCards, loadManifest, currentUrl } from "./lib/cards";
import { dedupeKey, inspectImage, isHttpUrl, type Verdict } from "./lib/validate";

const FRESH = process.argv.includes("--fresh");
const JSON_OUT = process.argv.includes("--json");
const OUT = path.join(process.cwd(), ".images", "check.json");

export type CheckEntry = {
  id: string;
  name: string;
  franchise: string;
  url: string | null;
  local: boolean;
  ok: boolean;
  reason: string;
  duplicateOf?: string;
  width: number;
  height: number;
  status: number;
  sourceName?: string;
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runCheck(options: { fresh?: boolean } = {}): Promise<CheckEntry[]> {
  const [cards, manifest] = await Promise.all([loadCards(), loadManifest()]);

  const verdicts = await mapLimit(cards, 8, async (card): Promise<{ card: typeof card; verdict: Verdict | null; url: string | null }> => {
    const url = currentUrl(card, manifest);
    if (!url) return { card, verdict: null, url: null };
    if (!isHttpUrl(url)) {
      return {
        card,
        url,
        verdict: { url, ok: false, reason: "URL absente ou non http(s)", status: 0, contentType: "", width: 0, height: 0, ratio: 0, format: "", finalUrl: url },
      };
    }
    return { card, url, verdict: await inspectImage(url, { fresh: options.fresh }) };
  });

  // Doublons : la première carte (ordre alphabétique d'identifiant) garde
  // l'image, les autres doivent en trouver une.
  const seen = new Map<string, string>();
  const entries: CheckEntry[] = verdicts.map(({ card, url, verdict }) => {
    const base: CheckEntry = {
      id: card.id,
      name: card.name,
      franchise: card.franchise,
      url,
      local: Boolean(card.imagePath),
      ok: Boolean(verdict?.ok),
      reason: verdict?.ok ? "valide" : (verdict?.reason ?? "aucune image"),
      width: verdict?.width ?? 0,
      height: verdict?.height ?? 0,
      status: verdict?.status ?? 0,
      sourceName: manifest.items[card.id]?.sourceName ?? manifest.items[card.id]?.source,
    };
    if (!base.ok || !url) return base;

    const key = dedupeKey(url);
    const first = seen.get(key);
    if (first && first !== card.id) {
      return { ...base, ok: false, duplicateOf: first, reason: `doublon de ${first}` };
    }
    seen.set(key, card.id);
    return base;
  });

  // Ordre déterministe pour la déduplication : le plus petit identifiant gagne.
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const firstUse = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.url || !entry.ok) continue;
    const key = dedupeKey(entry.url);
    const owner = firstUse.get(key);
    if (owner) {
      entry.ok = false;
      entry.duplicateOf = owner;
      entry.reason = `doublon de ${owner}`;
    } else {
      firstUse.set(key, entry.id);
    }
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, `${JSON.stringify({ checkedAt: new Date().toISOString(), entries }, null, 1)}\n`);
  return entries;
}

async function main() {
  if (!JSON_OUT) console.log("→ vérification des visuels…");
  const entries = await runCheck({ fresh: FRESH });

  const ok = entries.filter((entry) => entry.ok).length;
  const missing = entries.filter((entry) => !entry.url).length;
  const invalid = entries.length - ok - missing;

  const reasons = new Map<string, number>();
  for (const entry of entries.filter((item) => !item.ok && item.url)) {
    const family = entry.reason.replace(/\(.+\)$/, "").trim();
    reasons.set(family, (reasons.get(family) ?? 0) + 1);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: entries.length, ok, missing, invalid, entries }, null, 1));
    return;
  }

  console.log(`✓ cartes : ${entries.length}`);
  console.log(`  images valides : ${ok}`);
  console.log(`  sans image     : ${missing}`);
  console.log(`  invalides      : ${invalid}`);
  for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
    console.log(`    · ${reason} : ${count}`);
  }
  console.log(`  détail : ${OUT}`);
}

const isMain = process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/images/check.ts");
if (isMain) {
  main().catch((error) => {
    console.error(`✗ ${(error as Error).message}`);
    process.exit(1);
  });
}
