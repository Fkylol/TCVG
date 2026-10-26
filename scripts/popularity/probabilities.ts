/**
 * Étape 8 — probabilités par carte, à titre de rapport.
 *
 * Aucun poids n'est modifié : le script lit `game_config.booster_drop_rates`,
 * compte les cartes par rareté et en déduit, pour chaque booster :
 *   • la chance qu'une carte précise sorte à un tirage donné ;
 *   • la chance qu'elle sorte au moins une fois dans un booster ;
 *   • le nombre moyen de boosters pour l'obtenir.
 *
 *   npm run rarity:probabilities
 */

import { RARITY_ORDER } from "../../src/lib/rarity-distribution.config";
import { openRunner } from "../lib/db-runner";

type Row = { rarity: string; n: number };

function averageBoosters(perCard: number, cards: number): number {
  const perBooster = 1 - (1 - perCard) ** cards;
  return perBooster <= 0 ? Infinity : 1 / perBooster;
}

async function main() {
  const runner = await openRunner();
  try {
    const config = await runner.query(
      "select key, value from public.game_config where key in ('booster_drop_rates', 'cards_per_booster', 'pack_min_pool_size')",
    );
    const map = new Map(config.map((row) => [String(row.key), row.value]));
    const weights = (map.get("booster_drop_rates") ?? {}) as Record<string, number>;
    const perBooster = Number(map.get("cards_per_booster") ?? 5);
    const minPool = Number(map.get("pack_min_pool_size") ?? 15);

    const total = Object.values(weights).reduce((sum, value) => sum + Number(value), 0);
    const counts = (await runner.query(
      "select rarity, count(*)::int as n from public.playable_cards group by rarity",
    )) as Row[];
    const pool = counts.reduce((sum, row) => sum + Number(row.n), 0);
    const byRarity = new Map(counts.map((row) => [String(row.rarity), Number(row.n)]));

    console.log(`Poids actuels : ${Object.entries(weights).map(([key, value]) => `${key}=${value}`).join(" · ")}`);
    console.log(`Cartes par booster : ${perBooster} · pool Mix : ${pool} cartes\n`);

    console.log("| Rareté | Poids | Part d'un tirage | Cartes | Chance par carte et par booster | Boosters en moyenne |");
    console.log("| --- | ---: | ---: | ---: | ---: | ---: |");
    for (const rarity of RARITY_ORDER) {
      const weight = Number(weights[rarity] ?? 0);
      const n = byRarity.get(rarity) ?? 0;
      const share = total > 0 ? weight / total : 0;
      const perCard = n > 0 ? share / n : 0;
      const chance = 1 - (1 - perCard) ** perBooster;
      const needed = perCard > 0 ? averageBoosters(perCard, perBooster) : Infinity;
      console.log(
        `| ${rarity} | ${weight} | ${(share * 100).toFixed(2)} % | ${n} | ${(chance * 100).toFixed(3)} % | ${
          Number.isFinite(needed) ? Math.round(needed).toLocaleString("fr-FR") : "—"
        } |`,
      );
    }

    // Packs de genre : pool propre, mêmes poids renormalisés sur les raretés présentes.
    const genres = await runner.query(`
      select g.slug, g.name, c.rarity, count(*)::int as n
        from public.genres g
        join public.card_genres cg on cg.genre_id = g.id
        join public.playable_cards c on c.id = cg.card_id
       group by g.slug, g.name, c.rarity
       order by g.name
    `);

    const perGenre = new Map<string, { name: string; counts: Record<string, number> }>();
    for (const row of genres) {
      const slug = String(row.slug);
      const entry = perGenre.get(slug) ?? { name: String(row.name), counts: {} };
      entry.counts[String(row.rarity)] = Number(row.n);
      perGenre.set(slug, entry);
    }

    console.log("\n### Packs de genre (pool propre)\n");
    console.log("| Pack | Cartes | Raretés présentes | Chance d'une carte précise par booster |");
    console.log("| --- | ---: | --- | ---: |");
    for (const [slug, entry] of [...perGenre].sort((a, b) => a[1].name.localeCompare(b[1].name, "fr"))) {
      const poolSize = Object.values(entry.counts).reduce((sum, value) => sum + value, 0);
      const present = RARITY_ORDER.filter((rarity) => (entry.counts[rarity] ?? 0) > 0);
      const localTotal = present.reduce((sum, rarity) => sum + Number(weights[rarity] ?? 0), 0);
      const chances = present.map((rarity) => {
        const share = localTotal > 0 ? Number(weights[rarity] ?? 0) / localTotal : 0;
        const n = entry.counts[rarity] ?? 0;
        const perCard = n > 0 ? share / n : 0;
        return `${rarity} ${(100 * (1 - (1 - perCard) ** perBooster)).toFixed(2)} %`;
      });
      console.log(
        `| ${entry.name} (${slug}) | ${poolSize}${poolSize < minPool ? " ⚠" : ""} | ${present.join(", ")} | ${chances.join(" · ")} |`,
      );
    }

    const smallest = [...perGenre].sort(
      (a, b) =>
        Object.values(a[1].counts).reduce((sum, value) => sum + value, 0) -
        Object.values(b[1].counts).reduce((sum, value) => sum + value, 0),
    )[0];
    if (smallest) {
      console.log(
        `\nPool le plus petit : ${smallest[1].name}, ${Object.values(smallest[1].counts).reduce((sum, value) => sum + value, 0)} cartes (seuil d'ouverture ${minPool}).`,
      );
    }
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
