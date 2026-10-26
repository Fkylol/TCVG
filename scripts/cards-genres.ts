/**
 * Backfill franchises + genres + statut actif des 84 cartes.
 *
 * Idempotent : peut être relancé sans effet de bord. Ne supprime **jamais**
 * de ligne — un retrait passe par `active = false` (phase 6), pas par un
 * DELETE, sinon les collections des joueurs perdraient leurs cartes.
 *
 * Usage : npm run db:genres
 */

import { CARDS, UNIVERSES } from "../src/lib/cards";
import { CARD_GENRES, GENRES } from "../src/lib/card-genres";
import { openRunner } from "./lib/db-runner";

/** Échappe une valeur pour l'inclure dans un littéral SQL. */
function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Refuse un catalogue incomplet avant de toucher à la base. */
function validateCatalogue() {
  const problems: string[] = [];
  const knownGenres = new Set(GENRES.map((genre) => genre.slug));
  const cardIds = new Set(CARDS.map((card) => card.id));

  for (const card of CARDS) {
    const genres = CARD_GENRES[card.id];
    if (!genres || genres.length === 0) {
      problems.push(`${card.id} : aucun genre`);
      continue;
    }
    for (const genre of genres) {
      if (!knownGenres.has(genre)) problems.push(`${card.id} : genre inconnu « ${genre} »`);
    }
  }

  for (const id of Object.keys(CARD_GENRES)) {
    if (!cardIds.has(id)) problems.push(`${id} : carte inconnue du catalogue`);
  }

  for (const [slug] of Object.entries(UNIVERSES)) {
    if (!CARDS.some((card) => card.universe === slug)) {
      problems.push(`${slug} : franchise sans carte`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`Catalogue incohérent :\n  ${problems.join("\n  ")}`);
  }
}

async function main() {
  validateCatalogue();

  const franchises = Object.entries(UNIVERSES)
    .map(([slug, universe]) => `(${quote(slug)}, ${quote(universe.label)})`)
    .join(",\n  ");

  // Les genres déjà en base (005) gardent leur description : on ne met à jour
  // que le nom affiché.
  const genres = GENRES.map((genre) => `(${quote(genre.slug)}, ${quote(genre.name)})`).join(",\n  ");

  const pairs = Object.entries(CARD_GENRES)
    .flatMap(([cardId, list]) =>
      list.map(
        (genre) => `(${quote(cardId)}, (select id from public.genres where slug = ${quote(genre)}))`,
      ),
    )
    .join(",\n  ");

  const ids = CARDS.map((card) => quote(card.id)).join(", ");

  const sql = `
begin;

insert into public.franchises (slug, name)
values
  ${franchises}
on conflict (slug) do update set name = excluded.name;

insert into public.genres (slug, name)
values
  ${genres}
on conflict (slug) do update set name = excluded.name;

-- Franchise : dérivée de l'univers du catalogue, jamais devinée.
update public.cards c
   set franchise_id = f.id,
       updated_at = now()
  from public.franchises f
 where f.slug = c.universe
   and c.id in (${ids})
   and c.franchise_id is distinct from f.id;

insert into public.card_genres (card_id, genre_id)
values
  ${pairs}
on conflict (card_id, genre_id) do nothing;

-- Retour arrière de sécurité : une carte du catalogue redevient active si elle
-- avait été désactivée par erreur. Un retrait volontaire passe par le script
-- de la phase 6, qui conserve la trace (retired_at / retired_reason).
update public.cards
   set active = true,
       retired_at = null,
       retired_reason = null
 where id in (${ids})
   and active = false
   and retired_reason is null;

commit;
`;

  console.log(`→ ${CARDS.length} cartes, ${Object.keys(UNIVERSES).length} franchises, ${GENRES.length} genres`);
  const runner = await openRunner();
  console.log(`→ connecté via ${runner.label}`);

  try {
    await runner.query(sql);

    const counts = await runner.query(
      `select g.slug, count(cg.card_id)::int as total
         from public.genres g
         left join public.card_genres cg on cg.genre_id = g.id
        group by g.slug order by g.slug`,
    );
    console.log(`✓ genres : ${counts.map((row) => `${row.slug}=${row.total}`).join(" · ")}`);

    const missing = await runner.query(
      `select count(*)::int as total from public.cards c
        where not exists (select 1 from public.card_genres cg where cg.card_id = c.id)`,
    );
    if (Number(missing[0]?.total) > 0) {
      throw new Error(`${missing[0]?.total} carte(s) sans genre après backfill`);
    }
    console.log("✓ chaque carte a au moins un genre");

    const noFranchise = await runner.query(
      `select count(*)::int as total from public.cards where franchise_id is null`,
    );
    if (Number(noFranchise[0]?.total) > 0) {
      throw new Error(`${noFranchise[0]?.total} carte(s) sans franchise après backfill`);
    }
    console.log("✓ chaque carte a une franchise");

    const playable = await runner.query(`select count(*)::int as total from public.playable_cards`);
    console.log(`  cartes jouables : ${playable[0]?.total}`);
  } finally {
    await runner.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
