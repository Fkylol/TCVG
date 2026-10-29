import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const MIGRATION = read("supabase/migrations/054_cartes_edition_en_ligne.sql");
const FRAMING_MIGRATION = read("supabase/migrations/056_cadrage_visuel_en_ligne.sql");
const SAVE_MIGRATION = read("supabase/migrations/057_enregistrement_sans_reecriture.sql");
const SECURITY_MIGRATION = read("supabase/migrations/058_securite_atelier_halloween.sql");
const EDITS = read("src/lib/card-edits.ts");
const SERVER = read("src/lib/card-edits.server.ts");
const CARDS = read("src/lib/cards.ts");
const ART = read("src/lib/card-art.ts");
const LAYOUT = read("src/app/layout.tsx");
const PAGE = read("src/app/atelier/cartes/page.tsx");
const ONLINE = read("src/app/atelier/cartes/en-ligne.tsx");
const FORM = read("src/app/atelier/cartes/en-ligne-form.tsx");
const ACTIONS = read("src/app/atelier/cartes/en-ligne-actions.ts");

test("catalogue en ligne : une couche d'édition par-dessus le code", () => {
  assert.match(MIGRATION, /create table if not exists public\.card_edits/);
  for (const column of ["name", "rarity", "universe", "emoji", "image_url", "hidden"]) {
    assert.match(MIGRATION, new RegExp(`\\b${column}\\b`), `colonne ${column}`);
  }
  // La tombe survit à la carte : pas de clé étrangère sur card_id.
  assert.doesNotMatch(MIGRATION, /card_id text primary key references/);
  // Le catalogue du code applique les remplacements et masque les retirées.
  assert.match(CARDS, /if \(isHiddenCard\(id\)\) return undefined;/);
  assert.match(CARDS, /applyCardEdit\(card\)/);
  // Visuel choisi en ligne : il passe avant le manifeste.
  assert.match(ART, /const edit = cardEdit\(cardId\)/);
  assert.match(ART, /edit\?\.imageUrl/);
  // Le cadrage enregistré s'applique aussi au visuel du catalogue.
  assert.match(ART, /if \(art && edit\?\.framing\)/);
});

test("catalogue en ligne : le visuel se recadre sans changer d'image", () => {
  // Trois colonnes, une par réglage, et NULL = cadrage du catalogue.
  for (const column of ["image_fit", "image_position", "image_zoom"]) {
    assert.match(FRAMING_MIGRATION, new RegExp(`add column if not exists ${column}`), column);
  }
  assert.match(FRAMING_MIGRATION, /p_image_fit text/);
  assert.match(FRAMING_MIGRATION, /p_image_position text/);
  assert.match(FRAMING_MIGRATION, /p_image_zoom numeric/);
  assert.match(FRAMING_MIGRATION, /image_fit = excluded\.image_fit/);
  // La fiche enregistrée relit le cadrage, côté serveur comme dans la page.
  assert.match(SERVER, /image_fit, image_position, image_zoom/);
  assert.match(SERVER, /framing: framingOf\(row\)/);
  assert.match(ACTIONS, /p_image_position: text\(formData\.get\("imagePosition"\)\)/);
  // L'aperçu de l'atelier déplace et zoome le visuel affiché.
  assert.match(FORM, /panFraming\(current, dx, dy\)/);
  assert.match(FORM, /zoomFraming\(current, Number\(event\.target\.value\)\)/);
  assert.match(FORM, /name="imagePosition"/);
});

test("catalogue en ligne : le serveur installe les éditions avant le rendu", () => {
  assert.match(SERVER, /from\("card_edits"\)/);
  assert.match(SERVER, /publishCardEdits\(cache\)/);
  // Le layout racine les pose aussi dans la page, avant l'hydratation.
  assert.match(LAYOUT, /installCardEdits\(\)/);
  assert.match(LAYOUT, /Promise\.all\(\[/);
  assert.match(LAYOUT, /globalThis\.__CARD_EDITS__=/);
  assert.match(EDITS, /__CARD_EDITS__/);
});

test("catalogue en ligne : le rendu serveur des composants clients relit la liste", () => {
  // `card-face.tsx` est compilé deux fois (serveur et navigateur) : la copie
  // du rendu serveur ne voyait jamais les éditions installées par le layout,
  // d'où un total qui changeait à l'hydratation.
  assert.match(
    EDITS,
    /export function publishCardEdits\(rows: CardEdit\[\]\): void \{\s*\n\s*\(globalThis as Boot\)\.__CARD_EDITS__ = rows;/,
  );
  assert.match(EDITS, /function syncBoot\(\): void \{/);
  assert.match(EDITS, /if \(!Array\.isArray\(boot\) \|\| boot === BOOT\) return;/);

  // La relecture se fait à l'usage, pas au chargement du module : l'ordre
  // d'évaluation des deux copies n'est pas garanti.
  for (const accessor of ["cardEditsVersion", "isHiddenCard", "applyCardEdit"]) {
    assert.match(
      EDITS.slice(EDITS.indexOf(`export function ${accessor}`)),
      /syncBoot\(\);/,
      `${accessor} ne relit pas la liste publiée`,
    );
  }
});

test("catalogue en ligne : écriture réservée à l'atelier", () => {
  assert.match(MIGRATION, /function public\.is_atelier\(\)/);
  assert.match(MIGRATION, /lower\(p\.username\) in \('fkyzu', 'deathsky74', 'asperge'\)/);
  for (const fn of ["atelier_save_card_edit", "atelier_delete_card"]) {
    assert.match(MIGRATION, new RegExp(`function public\\.${fn}\\(`), fn);
    assert.match(
      MIGRATION.slice(MIGRATION.indexOf(`function public.${fn}`)),
      /if not public\.is_atelier\(\) then/,
      `garde de ${fn}`,
    );
  }
  assert.match(ACTIONS, /atelier_save_card_edit/);
  assert.match(ACTIONS, /atelier_delete_card/);
});

test("atelier : les droits sont liés aux UUID et refusés par défaut", () => {
  assert.match(SECURITY_MIGRATION, /user_id uuid primary key references auth\.users\(id\)/);
  assert.match(SECURITY_MIGRATION, /revoke all on public\.atelier_members from public, anon, authenticated/);
  assert.match(SECURITY_MIGRATION, /where user_id = auth\.uid\(\)/);
  assert.doesNotMatch(SECURITY_MIGRATION.replace(/^\s*--.*$/gm, ""), /insert into public\.atelier_members/i);
  assert.doesNotMatch(SECURITY_MIGRATION, /username/);
});

test("catalogue en ligne : suppression complète, copies comprises", () => {
  for (const table of ["collection", "market_listings", "buy_orders", "wishlist", "card_reports"]) {
    assert.match(
      MIGRATION,
      new RegExp(`delete from public\\.${table} where card_id = p_card_id;`),
      `purge de ${table}`,
    );
  }
  assert.match(MIGRATION, /delete from public\.cards where id = p_card_id;/);
  // La suppression exige une confirmation explicite.
  assert.match(ACTIONS, /formData\.get\("confirme"\) !== "1"/);
});

test("catalogue en ligne : le formulaire repart de la carte affichée", () => {
  // `?edit=` change sans changer de route : React réutilise l'instance du
  // composant client. Sans clé, les champs d'identité (non contrôlés) et le
  // cadrage (état) gardaient la carte précédente, et l'enregistrement — un
  // simple recadrage compris — écrivait l'identité de l'ancienne carte sur la
  // nouvelle : « duplicate key value violates unique constraint
  // cards_character_unique ».
  assert.match(ONLINE, /<OnlineCardForm\s+key=\{current\.id\}/);
  assert.match(FORM, /defaultValue=\{values\.name\}/);
  assert.match(FORM, /useState\(values\.imageUrl\)/);
  assert.match(FORM, /useState<PortraitFraming>/);
});

test("catalogue en ligne : la carte ouverte se charge même hors de la liste", () => {
  // La liste est plafonnée (300) et suit la recherche : « Ciel » menait à
  // « Sciel », absent de la liste relue sans le terme, et la page restait vide.
  assert.match(ONLINE, /\.eq\("id", editId\)/);
  assert.match(ONLINE, /\.maybeSingle\(\)/);
  assert.match(ONLINE, /cards = \[data as CardRow, \.\.\.cards\]/);
  // Le lien de la liste garde la recherche en cours.
  assert.match(ONLINE, /if \(query\) params\.set\("q", query\)/);
  assert.match(ONLINE, /params\.set\("edit", id\)/);
  // Un identifiant inconnu est dit, au lieu d'une page vide en silence.
  assert.match(ONLINE, /Aucune carte/);
  assert.match(ONLINE, /editId && !current && !failure/);
});

test("catalogue en ligne : l'identité n'est réécrite que si elle change", () => {
  // Un recadrage ne doit pas toucher au nom, à la rareté ni à l'univers, et
  // un vrai doublon doit être dit en français.
  assert.match(SAVE_MIGRATION, /where c\.id = p_card_id/);
  assert.match(SAVE_MIGRATION, /c\.name is distinct from coalesce\(v_name, c\.name\)/);
  assert.match(SAVE_MIGRATION, /c\.universe is distinct from coalesce\(v_universe, c\.universe\)/);
  assert.match(SAVE_MIGRATION, /when unique_violation then/);
  assert.match(SAVE_MIGRATION, /Ce personnage existe déjà dans cet univers/);
  // Le cadrage reste enregistré comme avant.
  assert.match(SAVE_MIGRATION, /image_position = excluded\.image_position/);
  assert.match(SAVE_MIGRATION, /p_image_zoom numeric/);
  // La signature à six arguments survit (page déjà chargée pendant un déploiement).
  assert.match(SAVE_MIGRATION, /not like '%numeric'/);
});

test("catalogue en ligne : l'atelier ouvre l'éditeur en ligne sur le site", () => {
  assert.match(PAGE, /<OnlineCardEditor/);
  assert.match(PAGE, /if \(!ATELIER_LOCAL\)/);
  assert.doesNotMatch(PAGE, /if \(!ATELIER_LOCAL\) redirect/);
  assert.match(ONLINE, /<OnlineCardForm/);
  assert.match(FORM, /Enregistrer et publier/);
  assert.match(FORM, /Supprimer la carte/);
});
