/**
 * Synchronise les visuels locaux : `public/cards/` → `cards.image_path` en base
 * et `src/data/card-images.json` pour le rendu statique.
 *
 * Le fichier doit s'appeler comme la carte : `public/cards/kratos.webp`.
 * Extensions acceptées, par ordre de préférence : webp, avif, png, jpg, jpeg.
 *
 * Usage :
 *   npm run images:sync           # écrit le manifeste et met la base à jour
 *   npm run images:sync -- --dry  # montre ce qui changerait, sans rien écrire
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CARDS } from "../src/lib/cards";
import { openRunner } from "./lib/db-runner";

const DIRECTORY = path.join(process.cwd(), "public", "cards");
const MANIFEST = path.join(process.cwd(), "src", "data", "card-images.json");

/** Extensions acceptées, la première trouvée gagne. */
const EXTENSIONS = ["webp", "avif", "png", "jpg", "jpeg"] as const;

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main() {
  const dry = process.argv.slice(2).includes("--dry");
  // Une carte retirée n'a plus de visuel servi : son fichier est ignoré, ce qui
  // la sort du manifeste et remet `cards.image_path` à null plus bas.
  const known = new Set(CARDS.filter((card) => card.retired !== true).map((card) => card.id));
  const retired = new Set(CARDS.filter((card) => card.retired === true).map((card) => card.id));

  let files: string[] = [];
  try {
    files = await fs.readdir(DIRECTORY);
  } catch {
    console.log("→ public/cards/ n'existe pas encore : aucun visuel local.");
  }

  // Un seul fichier par carte, l'extension la plus moderne l'emporte.
  const found = new Map<string, string>();
  const ignored: string[] = [];

  for (const file of files) {
    const match = /^(.+)\.([a-z0-9]+)$/i.exec(file);
    if (!match) {
      ignored.push(file);
      continue;
    }

    const [, id, rawExtension] = match;
    const extension = rawExtension.toLowerCase();
    if (!EXTENSIONS.includes(extension as (typeof EXTENSIONS)[number])) {
      ignored.push(file);
      continue;
    }

    if (!known.has(id)) {
      ignored.push(`${file} (${retired.has(id) ? "carte retirée" : "carte inconnue"})`);
      continue;
    }

    const previous = found.get(id);
    if (!previous) {
      found.set(id, `/cards/${file}`);
      continue;
    }

    const previousExtension = previous.split(".").pop() ?? "";
    if (
      EXTENSIONS.indexOf(extension as (typeof EXTENSIONS)[number]) <
      EXTENSIONS.indexOf(previousExtension as (typeof EXTENSIONS)[number])
    ) {
      found.set(id, `/cards/${file}`);
    }
  }

  const items = Object.fromEntries([...found.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const manifest = {
    note: "Généré par `npm run images:sync` : ne pas éditer à la main.",
    count: Object.keys(items).length,
    items,
  };

  console.log(`→ ${Object.keys(items).length} visuel(s) local(aux) reconnu(s) sur ${CARDS.length} cartes.`);
  if (ignored.length > 0) {
    console.log(`  ⚠ ignoré(s) : ${ignored.slice(0, 8).join(", ")}${ignored.length > 8 ? "…" : ""}`);
  }

  if (dry) {
    for (const [id, file] of Object.entries(items).slice(0, 10)) {
      console.log(`  ${id} → ${file}`);
    }
    console.log("✓ mode --dry : ni manifeste ni base modifiés.");
    return;
  }

  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`✓ manifeste écrit : src/data/card-images.json`);

  const runner = await openRunner();
  try {
    const entries = Object.entries(items);
    if (entries.length > 0) {
      const values = entries
        .map(([id, file]) => `(${quote(id)}, ${quote(file)})`)
        .join(",\n    ");
      await runner.query(`
        update public.cards as c
           set image_path = m.path
          from (values
    ${values}
          ) as m(id, path)
         where c.id = m.id
           and c.image_path is distinct from m.path;
      `);
    }

    // Les cartes dont le fichier a disparu retrouvent leur ancien rendu.
    await runner.query(`
      update public.cards
         set image_path = null
       where image_path is not null
         and id <> all (array[${entries.map(([id]) => quote(id)).join(", ") || "''"}]::text[]);
    `);

    const rows = await runner.query(
      `select count(*)::int as total from public.cards where image_path is not null`,
    );
    const sample = await runner.query(
      `select id, image_path from public.cards where image_path is not null order by id limit 5`,
    );
    console.log(`✓ base : ${rows[0]?.total ?? 0} carte(s) avec un visuel local`);
    for (const row of sample) console.log(`  ${row.id} → ${row.image_path}`);
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
