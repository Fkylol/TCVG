import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { GENRES, cardIdsOfGenre, genresOf } from "../src/lib/card-genres";
import { getCardLore } from "../src/lib/card-lore";
import { CARDS } from "../src/lib/cards";
import { getPack, shopPacks } from "../src/lib/packs";
import { getPortrait } from "../src/lib/portraits";
import { cardStats } from "../src/lib/stats";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (file: string) =>
  readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

const MIGRATION = read("supabase/migrations/061_booster_halloween.sql");
/** Migrations dont les blocs de pool sont réécrits par la 061. */
const SOURCES = [
  read("supabase/migrations/015_packs_gratuits.sql"),
  read("supabase/migrations/037_boosters_de_genre_stricts.sql"),
  read("supabase/migrations/039_chances_booster_par_carte.sql"),
];
const SYNC = read("scripts/db-cards.ts");

const SEASONAL = CARDS.filter((card) => card.season === "halloween");

/** Blocs `$tag$…$tag$` des patchs textuels, dans l'ordre du fichier. */
function blocks(sql: string): { tag: string; body: string }[] {
  return [
    ...sql.matchAll(/\$(pool_old|pool_new|count_old|count_new|old|new)\$([\s\S]*?)\$\1\$/g),
  ].map((match) => ({ tag: match[1], body: match[2] }));
}

test("halloween : vingt cartes spectrales, hors des packs de genre", () => {
  assert.equal(SEASONAL.length, 20);

  for (const card of SEASONAL) {
    // Une carte saisonnière n'appartient à aucun genre : elle ne peut donc pas
    // sortir d'un pack de genre, même sans la colonne en base.
    assert.deepEqual(genresOf(card.id), [], `${card.id} est rattachée à un genre`);
    assert.ok(getCardLore(card.id)?.bio, `${card.id} n'a pas de fiche`);
    assert.ok(getPortrait(card.id), `${card.id} n'a pas de visuel`);
    assert.ok(cardStats(card).quality > 0, `${card.id} n'a pas de stats`);
  }

  // Les six raretés sont représentées : le pack tient dans un paquet de cinq
  // cartes sans jamais sortir de sa saison.
  assert.deepEqual(
    [...new Set(SEASONAL.map((card) => card.rarity))].sort(),
    ["C", "L", "R", "SR", "UC", "UR"],
  );
});

test("halloween : chaque carte saisonnière vient d'un personnage du catalogue", () => {
  const ids = new Set(CARDS.map((card) => card.id));
  for (const card of SEASONAL) {
    assert.match(card.id, /-halloween$/, `${card.id} n'est pas nommée comme une variante`);
    const original = card.id.replace(/-halloween$/, "");
    assert.ok(ids.has(original), `${card.id} n'a pas d'original : ${original}`);
  }
});

test("halloween : le pack existe, porte sa saison et reste hors vitrine", () => {
  const pack = getPack("halloween");
  assert.ok(pack);
  assert.equal(pack.season, "halloween");
  assert.equal(pack.genre, null);
  assert.ok(
    !shopPacks().some((item) => item.id === "halloween"),
    "le pack saisonnier ne doit pas être proposé dans la vitrine",
  );
});

test("halloween : les cartes saisonnières sont absentes des packs permanents", () => {
  const seasonal = new Set(SEASONAL.map((card) => card.id));

  for (const genre of GENRES) {
    for (const id of cardIdsOfGenre(genre.slug)) {
      assert.ok(!seasonal.has(id), `${id} traînerait dans le pack ${genre.slug}`);
    }
  }

  // Et le Mix, qui couvre tout le catalogue permanent, les laisse dehors.
  assert.equal(cardIdsOfGenre(null).length, CARDS.length - SEASONAL.length);
});

test("migration 061 : la saison est une colonne, des deux côtés", () => {
  assert.match(MIGRATION, /alter table public\.cards add column if not exists season text;/);
  assert.match(MIGRATION, /alter table public\.booster_types add column if not exists season text;/);
  assert.match(MIGRATION, /cards_season_check/);
  assert.match(MIGRATION, /booster_types_season_check/);
  assert.match(MIGRATION, /check \(season is null or season = 'halloween'\)/);

  // La vue doit exposer la colonne : les pools filtrent dessus.
  assert.match(MIGRATION, /create or replace view public\.playable_cards/);
  assert.match(MIGRATION, /\s+c\.added_at,\n\s+c\.season\n/);
});

test("migration 061 : le pack est créé avec sa saison", () => {
  assert.match(
    MIGRATION,
    /insert into public\.booster_types \(slug, name, genre_id, cards_count, active, season\)\nvalues \('halloween', 'Booster d''Halloween', null, 5, true, 'halloween'\)/,
  );
  assert.match(MIGRATION, /on conflict \(slug\) do update/);
});

test("migration 061 : les cinq fonctions qui construisent un pool suivent la saison", () => {
  for (const signature of [
    "public._open_pack_stock(text)",
    "public.open_pack(text)",
    "public.pack_stats()",
    "public.card_booster_chances(text)",
    "public.pack_cards(text)",
  ]) {
    assert.ok(MIGRATION.includes(`'${signature}'`), `${signature} n'est pas patchée`);
  }

  // Le tirage lui-même : les deux fonctions qui ouvrent un pack.
  assert.match(MIGRATION, /v_names text\[\] := array\['_open_pack_stock', 'open_pack'\]/);
  // Pack saisonnier d'un côté, packs permanents de l'autre.
  assert.match(MIGRATION, /if v_pack\.season is not null then/);
  assert.match(MIGRATION, /where season is null;/);
});

test("migration 061 : chaque remplacement reprend un bloc existant et se vérifie", () => {
  const found = blocks(MIGRATION);
  const olds = found.filter((block) => block.tag.endsWith("_old") || block.tag === "old");
  const news = found.filter((block) => block.tag.endsWith("_new") || block.tag === "new");

  // Sept blocs remplacés : le tirage, deux blocs de pack_stats, trois blocs
  // de card_booster_chances et le filtre de pack_cards.
  assert.equal(olds.length, 7);
  assert.equal(news.length, olds.length, "remplacements incomplets");

  // Un bloc ancien doit venir tel quel d'une migration antérieure : c'est ce
  // qui garantit que le patch vise la bonne fonction et la bonne version.
  for (const block of olds) {
    assert.ok(
      SOURCES.some((source) => source.includes(block.body)),
      `bloc introuvable dans les migrations 015, 037 et 039 :\n${block.body.slice(0, 80)}`,
    );
  }

  // Et le bloc neuf ne doit exister nulle part avant : la migration est ce qui
  // l'introduit, sans quoi elle remplacerait un bloc déjà en place.
  for (const block of news) {
    assert.ok(
      SOURCES.every((source) => !source.includes(block.body)),
      `bloc déjà présent avant la 061 :\n${block.body.slice(0, 80)}`,
    );
  }

  // Chaque patch s'arrête si le remplacement est déjà là, et lève si le bloc
  // attendu a disparu : la migration est rejouable et refuse de deviner.
  assert.equal(MIGRATION.match(/position\(v_\w+ in v_definition\) = 0/g)?.length, 6);
  assert.equal(
    MIGRATION.match(/raise exception '[^']*vérifier la fonction avant migration'/g)?.length,
    6,
  );
  // Each direct block patch exits early if the replacement is already present.
  assert.equal(MIGRATION.match(/position\(v_\w+ in v_definition\) > 0/g)?.length, 4);
});

test("migration 061 : le tirage est contrôlé des deux côtés", () => {
  // Pack saisonnier : aucune carte hors saison.
  assert.match(MIGRATION, /where not exists \(\n\s+select 1 from public\.playable_cards c\n\s+where c\.id = carte ->> 'id' and c\.season = paquet\.season/);
  // Packs permanents : aucune carte de saison.
  assert.match(MIGRATION, /where exists \(\n\s+select 1 from public\.playable_cards c\n\s+where c\.id = carte ->> 'id' and c\.season is not null/);
  assert.match(MIGRATION, /raise exception 'fuite hors saison/);
  assert.match(MIGRATION, /raise exception 'une carte saisonnière sort d''un pack permanent/);
});

test("synchronisation : la saison est écrite en base avec la carte", () => {
  assert.match(
    SYNC,
    /insert into public\.cards \(id, name, universe, rarity, number, quality, franchise_id, active, retired_reason, season\)/,
  );
  assert.match(SYNC, /season = excluded\.season,/);
  assert.match(SYNC, /const season = card\.season \? quote\(card\.season\) : "null";/);
});
