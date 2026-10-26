/**
 * Lecture de l'état des visuels : cartes en base, manifeste de rendu
 * (`src/data/portraits.json`), chemins locaux (`cards.image_path`).
 */

import fs from "node:fs/promises";
import path from "node:path";

import { openRunner } from "../../lib/db-runner";

const MANIFEST = path.join(process.cwd(), "src", "data", "portraits.json");

export type Portrait = {
  url: string;
  source: string;
  sourceName?: string;
  page?: string;
  file?: string;
  width?: number;
  height?: number;
  credit?: string;
  license?: string;
  checkedAt?: string;
  /** Niveau de confiance de la recherche stricte (`high`/`medium`). */
  confidence?: "high" | "medium";
};

export type Manifest = {
  generatedAt: string;
  note?: string;
  items: Record<string, Portrait>;
};

export type CardRow = {
  id: string;
  name: string;
  franchise: string;
  wikidataId: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  imageStatus: string | null;
};

export async function loadManifest(): Promise<Manifest> {
  try {
    return JSON.parse(await fs.readFile(MANIFEST, "utf8")) as Manifest;
  } catch {
    return { generatedAt: new Date().toISOString(), items: {} };
  }
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

/** Cartes actives, avec leur franchise et leurs colonnes d'image. */
export async function loadCards(): Promise<CardRow[]> {
  const runner = await openRunner();
  try {
    const rows = await runner.query(`
      select c.id,
             c.name,
             coalesce(f.name, c.universe) as franchise,
             c.wikidata_id as "wikidataId",
             c.image_path as "imagePath",
             c.image_url as "imageUrl",
             c.image_status as "imageStatus"
        from public.cards c
        left join public.franchises f on f.id = c.franchise_id
       where c.active
       order by c.name
    `);
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      franchise: String(row.franchise),
      wikidataId: (row.wikidataId as string | null) ?? null,
      imagePath: (row.imagePath as string | null) ?? null,
      imageUrl: (row.imageUrl as string | null) ?? null,
      imageStatus: (row.imageStatus as string | null) ?? null,
    }));
  } finally {
    await runner.close();
  }
}

/** Une carte sans visuel exploitable : ni fichier local, ni URL du manifeste. */
export function currentUrl(card: CardRow, manifest: Manifest): string | null {
  if (card.imagePath) return card.imagePath;
  return manifest.items[card.id]?.url ?? card.imageUrl ?? null;
}
