/**
 * Nettoyage qualité des visuels.
 *
 * La recherche stricte a accepté 347 visuels fiables. Les autres entrées du
 * manifeste viennent d'anciens imports ou de `images:fix` : photos de lieux,
 * homonymes réels, vignettes de page (« Teba's Home »), etc. Ce script ne garde
 * que les visuels `high`/`medium` de `src/data/image-audit.json`, remet leur
 * URL exacte dans `src/data/portraits.json` et vide les autres colonnes image
 * de `public.cards` (`image_status = 'missing'`).
 *
 * Les fichiers locaux (`cards.image_path`) ne sont jamais touchés : ils restent
 * prioritaires dans `resolveCardArt`.
 *
 *   npm run images:cleanup            # simulation, aucune écriture
 *   npm run images:cleanup -- --apply # manifeste + base
 */

import fs from "node:fs/promises";
import path from "node:path";

import { openRunner } from "../lib/db-runner";

const APPLY = process.argv.includes("--apply");
const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "src", "data", "portraits.json");
const AUDIT = path.join(ROOT, "src", "data", "image-audit.json");
const BACKUP_DIR = path.join(ROOT, ".images");

type AuditEntry = {
  id: string;
  name: string;
  franchise: string;
  url: string;
  page?: string;
  source?: string;
  confidence: "high" | "medium" | "unverified";
  reason?: string;
};

type AuditFile = {
  generatedAt: string;
  total: number;
  accepted: number;
  entries: AuditEntry[];
};

type Portrait = {
  url: string;
  source: "wikipedia" | "fandom" | "wikidata";
  sourceName?: string;
  wikiHost?: string;
  wikiTitle?: string;
  page?: string;
  file?: string;
  width?: number;
  height?: number;
  credit?: string;
  license?: string;
  checkedAt?: string;
  confidence?: "high" | "medium";
};

type Manifest = {
  generatedAt: string;
  note?: string;
  items: Record<string, Portrait>;
};

function quote(value: string | null | undefined): string {
  return value === null || value === undefined ? "null" : `'${value.replace(/'/g, "''")}'`;
}

/** Nom de fichier lisible dans une URL Fandom/Wikipédia. */
function fileFromUrl(url: string): string | undefined {
  try {
    const pathname = new URL(url).pathname;
    const fandom = pathname.match(/\/(?:images|thumb)\/[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i);
    if (fandom) return decodeURIComponent(fandom[1]);
    const wikipedia = pathname.match(/\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i);
    if (wikipedia) return decodeURIComponent(wikipedia[1]);
    const last = pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : undefined;
  } catch {
    return undefined;
  }
}

function sourceOf(entry: AuditEntry, previous?: Portrait): Pick<Portrait, "source" | "sourceName" | "wikiHost"> {
  if (entry.source === "wikidata") {
    return { source: "wikidata", sourceName: previous?.sourceName ?? "Wikidata (P18)" };
  }
  if (entry.source === "wikipedia" || entry.source?.includes("wikipedia")) {
    return { source: "wikipedia", sourceName: previous?.sourceName ?? entry.source ?? "Wikipédia" };
  }
  const host = entry.source ?? previous?.sourceName ?? previous?.wikiHost ?? "Fandom";
  return { source: "fandom", sourceName: host, wikiHost: host };
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8")) as Manifest;
  const audit = JSON.parse(await fs.readFile(AUDIT, "utf8")) as AuditFile;

  const verified = new Map(
    audit.entries
      .filter((entry) => entry.confidence === "high" || entry.confidence === "medium")
      .map((entry) => [entry.id, entry]),
  );
  if (verified.size === 0) {
    throw new Error("aucun visuel vérifié dans l'audit : rien à conserver");
  }

  const kept: Record<string, Portrait> = {};
  for (const [id, entry] of verified) {
    const previous = manifest.items[id];
    const sameFile = previous?.url === entry.url;
    kept[id] = {
      url: entry.url,
      ...sourceOf(entry, previous),
      page: entry.page || previous?.page,
      file: fileFromUrl(entry.url) ?? previous?.file,
      ...(sameFile && previous?.width ? { width: previous.width } : {}),
      ...(sameFile && previous?.height ? { height: previous.height } : {}),
      ...(sameFile && previous?.credit ? { credit: previous.credit } : {}),
      ...(sameFile && previous?.license ? { license: previous.license } : {}),
      checkedAt: audit.generatedAt,
      confidence: entry.confidence === "high" ? "high" : "medium",
    };
  }

  const removed = Object.keys(manifest.items).filter((id) => !kept[id]);
  const added = Object.keys(kept).filter((id) => !manifest.items[id]);
  console.log(`→ audit : ${verified.size} visuel(s) vérifié(s)`);
  console.log(`→ manifeste actuel : ${Object.keys(manifest.items).length}`);
  console.log(`  conservés : ${Object.keys(kept).length}`);
  console.log(`  retirés   : ${removed.length}`);
  console.log(`  récupérés depuis l'audit : ${added.length}`);
  if (added.length > 0) console.log(`  ex. récupérés : ${added.slice(0, 8).join(", ")}`);

  const runner = await openRunner();
  let before: Record<string, unknown>[] = [];
  try {
    before = await runner.query(`
      select id, image_url, image_source_name, image_source_page, image_license,
             image_width, image_height, image_status
        from public.cards
       where active
       order by id
    `);
  } finally {
    await runner.close();
  }

  console.log(`→ base : ${before.length} carte(s) active(s), ${before.filter((row) => row.image_url).length} avec image_url`);

  if (!APPLY) {
    console.log("✓ simulation : ni manifeste ni base modifiés (ajoute --apply).");
    return;
  }

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(BACKUP_DIR, `portraits-backup-${stamp}.json`);
  await fs.writeFile(
    backup,
    `${JSON.stringify({ createdAt: new Date().toISOString(), manifest, cards: before }, null, 2)}\n`,
  );
  console.log(`✓ sauvegarde : ${backup}`);

  const nextManifest: Manifest = {
    generatedAt: new Date().toISOString(),
    note: "Visuels vérifiés uniquement (recherche stricte). Les cartes sans entrée retombent sur la silhouette.",
    items: Object.fromEntries(Object.entries(kept).sort(([a], [b]) => a.localeCompare(b))),
  };
  await fs.writeFile(MANIFEST, `${JSON.stringify(nextManifest, null, 2)}\n`);
  console.log("✓ manifeste réécrit : src/data/portraits.json");

  const values = [...verified.entries()]
    .map(([id, entry]) => {
      const image = kept[id];
      const width = image.width ? String(image.width) : "null";
      const height = image.height ? String(image.height) : "null";
      return `(${quote(id)}, ${quote(entry.url)}, ${quote(image.sourceName)}, ${quote(entry.page)}, ${width}, ${height})`;
    })
    .join(",\n    ");

  const runner2 = await openRunner();
  try {
    await runner2.query(`
      update public.cards as c
         set image_url = v.url,
             image_source_name = v.source_name,
             image_source_page = v.source_page,
             image_license = null,
             image_width = v.width,
             image_height = v.height,
             image_checked_at = now(),
             image_status = 'ok'
        from (values
    ${values}
        ) as v(id, url, source_name, source_page, width, height)
       where c.id = v.id;
    `);

    const cleared = await runner2.query(`
      update public.cards
         set image_url = null,
             image_source_name = null,
             image_source_page = null,
             image_license = null,
             image_width = null,
             image_height = null,
             image_checked_at = now(),
             image_status = 'missing'
       where active
         and id <> all (array[${[...verified.keys()].map((id) => quote(id)).join(", ")}]::text[])
         and (image_url is not null or image_status is distinct from 'missing')
      returning id;
    `);

    const stats = await runner2.query(`
      select count(*)::int as total,
             count(*) filter (where image_url is not null)::int as with_image,
             count(*) filter (where image_status = 'missing')::int as missing
        from public.cards
       where active
    `);
    console.log(`✓ base : ${cleared.length} image(s) retirée(s)`);
    console.log(`  ${stats[0]?.with_image ?? 0}/${stats[0]?.total ?? 0} carte(s) avec image, ${stats[0]?.missing ?? 0} en silhouette`);
  } finally {
    await runner2.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
