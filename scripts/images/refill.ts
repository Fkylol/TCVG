/**
 * Remplissage ciblé des visuels manquants.
 *
 * Contrairement à `images:fix`, ce script ne cherche pas « une image dont le
 * nom contient le personnage » : il part de la page de personnage du wiki de la
 * franchise, lit son infobox et n'accepte l'image que si la page est bien une
 * page de personnage (catégories / infobox / première phrase). Les pages de
 * lieux, d'objets, de factions ou d'homonymes réels sont écartées.
 *
 * Les alias viennent du nom de la carte, du titre Wikipédia anglais quand il
 * existe, et d'une petite table de traductions françaises (`Le Croisé` →
 * `Crusader`). Les réponses API et les images sont mises en cache disque par
 * `lib/http`, donc une relance est rapide.
 *
 *   npm run images:refill                 # simulation
 *   npm run images:refill -- --apply      # manifeste + base
 *   npm run images:refill -- --limit 20   # essai sur 20 cartes
 *   npm run images:refill -- --only purah,teba,m-qi
 */

import fs from "node:fs/promises";
import path from "node:path";

import { openRunner } from "../lib/db-runner";
import { getJson } from "./lib/http";
import { apiEndpoint, fandomHost } from "./lib/sources";
import { assetName, dedupeKey, inspectImage } from "./lib/validate";

const APPLY = process.argv.includes("--apply");
const FRESH = process.env.IMAGES_FRESH === "1";
const LIMIT = (() => {
  const index = process.argv.indexOf("--limit");
  const value = index >= 0 ? Number(process.argv[index + 1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : Infinity;
})();
const ONLY = (() => {
  const index = process.argv.indexOf("--only");
  const value = index >= 0 ? process.argv[index + 1] : "";
  return new Set(value.split(",").map((id) => id.trim()).filter(Boolean));
})();

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "src", "data", "portraits.json");
const REPORT = path.join(ROOT, ".images", "refill.json");

type Card = {
  id: string;
  name: string;
  franchise: string;
  wikipediaTitles: Record<string, string> | null;
  imagePath: string | null;
};

type Page = {
  title: string;
  missing?: string;
  thumbnail?: { source: string };
  categories?: { title: string }[];
  images?: { title: string }[];
  revisions?: { slots?: { main?: { "*": string } } }[];
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
  license?: string;
  credit?: string;
  checkedAt?: string;
  confidence?: "high" | "medium";
};

type Manifest = { generatedAt: string; note?: string; items: Record<string, Portrait> };

type Result = {
  id: string;
  name: string;
  franchise: string;
  host: string | null;
  page: string | null;
  file: string | null;
  url: string | null;
  status: "found" | "missing" | "no-wiki" | "invalid";
  reason: string;
};

/**
 * Traductions françaises des noms de cartes. Le wiki anglais ne connaît pas
 * « Le Croisé » mais « Crusader » : sans cette table, la recherche exacte
 * échouerait alors que l'image existe.
 */
/** Hôtes Fandom des franchises absentes du manifeste vérifié. */
const HOST_FALLBACKS: Record<string, string> = {
  "Age of Conan": "conan.fandom.com",
  "Albion Online": "albiononline.fandom.com",
  "Atlantica Online": "atlantica.fandom.com",
  Dofus: "dofuswiki.fandom.com",
  "Lineage II": "lineage2.fandom.com",
  "Perfect World": "perfectworld.fandom.com",
  "Stardew Valley": "stardewvalley.fandom.com",
  "Darkest Dungeon": "darkestdungeon.fandom.com",
  "Untitled Goose Game": "untitledgoosegame.fandom.com",
  "Plants vs. Zombies": "plantsvszombies.fandom.com",
  Portal: "half-life.fandom.com",
  "Fall Guys": "fallguysultimateknockout.fandom.com",
  "Project Zero": "fatalframe.fandom.com",
  "Katana Zero": "katana-zero.fandom.com",
  Signalis: "signalis.fandom.com",
  "Slender: The Eight Pages": "creepypasta.fandom.com",
  Ori: "oriandtheblindforest.fandom.com",
  "The Secret World": "secretworld.fandom.com",
  "Star Trek Online": "startrekonline.fandom.com",
  "Star Wars: The Old Republic": "swtor.fandom.com",
  "Star Wars Galaxies": "starwars.fandom.com",
  "Star Wars: Empire at War": "starwars.fandom.com",
  "The Lord of the Rings Online": "lotro.fandom.com",
  "Warhammer Online": "warhammerfantasy.fandom.com",
  "Total War": "totalwar.fandom.com",
  Stronghold: "stronghold.fandom.com",
  "Rappelz": "rappelz.fandom.com",
  "Ragnarok Online": "ragnarok.fandom.com",
  "MU Online": "muonline.fandom.com",
  "Guild Wars 2": "guildwars2.fandom.com",
  EverQuest: "everquest.fandom.com",
  "Duke Nukem": "dukenukem.fandom.com",
  "Doki Doki Literature Club!": "doki-doki-literature-club.fandom.com",
  "Dead Space": "deadspace.fandom.com",
};

const ALLOW_COMBINED_PAGES = new Set(["terri-bobcat", "terry-bobcat"]);

/** Fichiers d'infobox médiocres corrigés à la main (capture, plateau, etc.). */
const PREFERRED_FILES: Record<string, RegExp> = {
  zero: /^ZeroSteamCard\.png$/i,
  ori: /^Sleeping[ _]Ori\.png$/i,
  cesar: /^Mariusz-kozik-caezar-final-e\.jpg$/i,
  glados: /^GLaDOShd[ _]Portal[ _]2\.png$/i,
  malekith: /^Warhammer[ _]Malekith[ _]Art\.jpg$/i,
  "kliff-macduff": /^Kliff[ _]Infobox\.png$/i,
};

const CARD_HOST_OVERRIDES: Record<string, string> = {
  // Les pages Dofus de Nox et Rushu sont un objet et un serveur ; le wiki
  // Wakfu porte les pages de personnages correspondantes.
  arpagone: "wakfu.fandom.com",
  nox: "wakfu.fandom.com",
  rushu: "wakfu.fandom.com",
  "joris-jurgen": "wakfu.fandom.com",
  // Pages absentes du wiki de la suite / de la franchise : on va au wiki
  // d'origine du personnage.
  "gregorio-silva": "codevein.fandom.com",
  jula: "memory-beta.fandom.com",
  "tom-bombadil": "lotr.fandom.com",
};

/**
 * Visuels choisis à la main : le wiki et la page sont connus, et souvent le
 * fichier exact aussi. La page et l'image passent quand même par la
 * vérification de taille et de hotlink avant d'être enregistrées.
 */
const CARD_PINNED: Record<string, { host: string; page: string; file?: string }> = {
  'king-dedede': { host: 'kirby.fandom.com', page: 'King Dedede', file: '16-dedede.png' },
  'freyja-crescent': {
    host: 'finalfantasy.fandom.com',
    page: 'Freya Crescent',
    file: 'FFIX CG Render Freya.png',
  },
  'tarask-coral': { host: 'finalfantasy.fandom.com', page: 'Amarant Coral', file: 'Amarant 3.jpg' },
  markus: { host: 'finalfantasy.fandom.com', page: 'Marcus', file: 'Marcus.jpg' },
  'juzo-mido': {
    host: 'codevein.fandom.com',
    page: 'Juzo Mido',
    file: 'Code-Vein 2018 04-19-18 011.jpg',
  },
  'louis-amamiya': {
    host: 'codevein.fandom.com',
    page: 'Louis Amamiya',
    file: 'Louis bio.jpg',
  },
  'cruz-silva': {
    host: 'codevein.fandom.com',
    page: 'Cruz Silva',
    file: 'Cruz Silva character draft.jpg',
  },
  monoco: {
    host: 'clair-obscur.fandom.com',
    page: 'Monoco',
    file: 'Amandine-marest-3d-mainchar-monoco-default5.jpg',
  },
  'dark-vlad': { host: 'dofuswiki.fandom.com', page: 'Dark Vlad (NPC)', file: 'Dark Vlad (NPC).png' },
  'femme-cheveux-denoues': {
    host: 'fatalframe.fandom.com',
    page: 'Long Hair Woman',
    file: 'Longhairedwoman.png',
  },
  passant: { host: 'darkwood.fandom.com', page: 'Protagonist', file: 'Stranger.png' },
  tarnished: {
    host: 'eldenring.fandom.com',
    page: 'The Tarnished (Protagonist)',
    file: 'ER Character Tarnished 01.png',
  },
  heavy: { host: 'teamfortress.fandom.com', page: 'Heavy', file: 'H.W.G.png' },
  imposteur: {
    host: 'amongus.fandom.com',
    page: 'Impostor',
    file: 'Impostor victory.png',
  },
  'petit-garcon': { host: 'limbo.fandom.com', page: 'Nameless Boy', file: 'Unamed.Boy.jpg' },
  inspecteur: { host: 'papersplease.fandom.com', page: 'Inspector', file: 'Inspector-bw.png' },
  explorateur: {
    host: 'outerwilds.fandom.com',
    page: 'The protagonist',
    file: 'Protagonist Suit Closeup.JPG',
  },
  prince: { host: 'katamari.fandom.com', page: 'The Prince', file: 'Cousins BK 01 Prince.png' },
  rodeur: { host: 'subnautica.fandom.com', page: 'Stalker', file: 'Stalker Fauna.png' },
  'firiona-vie': { host: 'eq2.fandom.com', page: 'Firiona Vie (Antonica)', file: 'Firiona Vie (Antonica).jpg' },
  avatus: { host: 'wildstar.fandom.com', page: 'Avatus', file: 'Avatus Thumbnail.png' },
  clockworks: { host: 'flyff.fandom.com', page: 'Clockworks', file: 'Clockworks.jpg' },
  'dr-harley-sawyer': {
    host: 'poppy-playtime.fandom.com',
    page: 'Harley Sawyer',
    file: "Harley sawyer's appearance.jpg",
  },
  'lola-lombardi': { host: 'bully.fandom.com', page: 'Lola Lombardi', file: 'Lola.jpg' },
  'derby-harrington': { host: 'bully.fandom.com', page: 'Derby Harrington', file: 'Derby25.jpg' },
  antharas: { host: 'lineage2.fandom.com', page: 'Antharas', file: 'Antharas1.jpg' },
  'kirsten-geary': {
    host: 'secretworld.fandom.com',
    page: 'Kirsten Geary',
    file: 'Kirstengeary desc.jpg',
  },
  crucia: { host: 'rift.fandom.com', page: 'Crucia', file: 'Crucia.jpg' },
  spy: { host: 'teamfortress.fandom.com', page: 'Spy', file: 'Spy Classic.png' },
  prisonnier: {
    host: 'deadcells.fandom.com',
    page: 'The Beheaded',
    file: 'Beheaded-Island-BG.jpg',
  },
  'black-spirit': {
    host: 'blackdesertonline.fandom.com',
    page: 'Black Spirit',
    file: 'BlackSpirit Stage 6.png',
  },
  // « Melvin Harris » est le nom complet de Big Smoke dans San Andreas.
  'melvin-harris': { host: 'grandtheftauto.fandom.com', page: 'Big Smoke', file: 'BigSmoke-GTASA.jpg' },
};

const MANUAL_ALIASES: Record<string, string[]> = {
  conan: ["Conan"],
  "banjo-kazooie": ["Banjo", "Banjo and Kazooie", "Banjo & Kazooie"],
  cuphead: ["Cuphead (character)"],
  "hunter-bloodborne": ["Hunter", "The Hunter"],
  "king-dice": ["King Dice"],
  kyprosa: ["Kyprosa", "Kyprosa Daeior"],
  "hong-seokkeun": ["Hong", "Hong Sokyun"],
  "gregorio-silva": ["Gregorio", "Gregorio Silva"],
  "terri-bobcat": ["Terri"],
  "terry-bobcat": ["Terry"],
  "joris-jurgen": ["Master Joris"],
  "kerubim": ["Kerub Crepin"],
  arpagone: ["Arpagone"],
  nox: ["Nox (Animated Series)"],
  rushu: ["Rushu"],
  joker: ["Ren Amamiya", "Joker (Persona 5)"],
  venat: ["Venat (Final Fantasy XIV)"],
  rauru: ["King Rauru", "Rauru (Tears of the Kingdom)"],
  xehanort: ["Master Xehanort"],
  malgus: ["Darth Malgus"],
  "wise-old-man": ["Wise Old Man"],
  "lance-wilson": ["Lance Wilson"],
  "juan-garcia-cortez": ["Juan Cortez", "Juan Garcia Cortez"],
  "tracy-de-santa": ["Tracey De Santa"],
  "poppy-ludwig": ["Poppy Ludwig"],
  croise: ["Crusader"],
  mercer: ["Mercer", "Doctor Mercer"],
  kerafyrm: ["Kerafyrm"],
  "fall-guy": ["Fall Guy"],
  dogmeat: ["Dogmeat"],
  "vendeur-vault-tec": ["Vault-Tec rep", "Vault-Tec representative", "Vault-Tec Rep"],
  "djidane-tribal": ["Zidane Tribal"],
  "kweena-quen": ["Quina Quen"],
  "pile-et-face": ["Zorn and Thorn"],
  jenova: ["Jenova"],
  "sergent-duke": ["Sergeant Duke", "Duke"],
  "ender-dragon": ["Ender Dragon"],
  "zombie-cone": ["Conehead Zombie"],
  "prototype-experience-1006": ["The Prototype"],
  abhuva: ["Abhuva"],
  xizor: ["Xizor", "Prince Xizor"],
  thrawn: ["Thrawn", "Mitth'raw'nuruodo", "Grand Admiral Thrawn"],
  "duc-de-paille": ["Duc de Paille"],
  "leviatan-faucheur": ["Reaper Leviathan"],
  oie: ["Goose"],
  jardinier: ["Groundskeeper", "Gardener"],
  malekith: ["Malekith"],
  garrosh: ["Garrosh Hellscream"],
  solaire: ["Solaire of Astora"],
  arbiter: ["Thel 'Vadam"],
  "m-qi": ["Mr. Qi"],
  geralt: ["Geralt of Rivia"],
  "triss-merigold-de-maribor": ["Triss Merigold"],
  "letho-de-guleta": ["Letho of Gulet", "Letho"],
  "meve-de-lyria": ["Meve"],
  ulysse: ["Ulysses"],
  "sir-jyscal-guado": ["Jyscal Guado"],
  "cycloid-empero": ["Cycloid Emperor"],
  "jedediah-lucan": ["Jed Lucan"],
  "kliff-macduff": ["Kliff"],
  cesar: ["Julius Caesar"],
  "valkyrie-randgris": ["Randgris"],
  "ivy-valentine": ["Ivy"],
  "slender-man": ["The Slender Man"],
  wendigo: ["The Wendigos", "Wendigos"],
};

const PHYSICAL =
  /(home|house|pad|map|icon|logo|scan|magazine|poster|cover|(?:^|[\s_-])box(?:[\s_-]?art)?(?:[\s_-]|$)|banner|pennon|badge|flag|coat[_ -]?of[_ -]?arms|font|sheet|texture|(?:^|[\s_-])ui(?:[\s_-]|$)|steam[_ -]?card|trading[_ -]?card|comparison|height|chart|symbol|cardart|card)/i;
const BAD_GALLERY =
  /(battle|hurt|fatal|sprite|icon|map|logo|scan|magazine|poster|cover|(?:^|[\s_-])box(?:[\s_-]?art)?(?:[\s_-]|$)|banner|pennon|badge|flag|coat[_ -]?of[_ -]?arms|font|sheet|texture|(?:^|[\s_-])ui(?:[\s_-]|$)|real|canvas|comparison|height|chart|symbol|card|cardart)/i;
const BLOCKED_TITLE =
  /(gwent|soundtrack|original soundtrack|\bost\b|\bmusic\b|\balbum\b|\bsong\b|\/netflix|\/gallery|\/card|\/quotes|\/image|\/audio)/i;
const BLOCKED_CATEGORY_NAMES =
  /^(locations?|places?|items?|weapons?|armou?r|quests?|soundtracks?|music|albums?|songs?|merchandise|companies|organizations?|factions?|real world|actors?|voice actors?|games?|video games?|comics?|novels?|films?|media)$/;
const CHARACTER_CATEGORIES =
  /\b(characters?|heroes|villagers?|bosses|boss|enemies|enemy|protagonists?|antagonists?|npcs?|playable characters?|party members?|companions?|sangheili characters?|main characters?|expedition 33|monsters?|creatures?|beings?|gods?|demigods?|individuals?|males?|females?|fauna)\b/i;
const CHARACTER_INFOBOX = /\{\{\s*(infobox character|characterinfobox|starbox character|infobox character info)/i;
const NON_CHARACTER_INFOBOX =
  /\{\{\s*(infobox (item|weapon|armou?r|location|quest|faction|organization|company|album|song|soundtrack|music)|iteminfobox|locationinfobox|weaponinfobox)/i;
const NON_CHARACTER_LEAD =
  /\b(is|was)\s+(a|an)\s+[^.]{0,100}\b(item|weapon|consumable|mark|location|quest|faction|company|organization|rank|title|song|record|outfit|game|video game|novel|comic|film|series|soundtrack|album|music)\b/i;
const CHARACTER_LEAD =
  /\b(characters?|protagonists?|antagonists?|villagers?|heroes?|villains?|daughters?|sons?|granddaughters?|grandsons?)\b/i;

function quote(value: string | null | undefined): string {
  return value === null || value === undefined ? "null" : `'${value.replace(/'/g, "''")}'`;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanTitle(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function aliasesFor(card: Card): string[] {
  const out: string[] = [];
  const add = (value: string | null | undefined) => {
    const text = value?.trim();
    if (text && text.length > 1 && !out.some((item) => normalize(item) === normalize(text))) out.push(text);
  };

  // Les alias manuels passent avant le nom de la carte : « Rauru » existe
  // pour Ocarina of Time, mais la carte vient de Tears of the Kingdom.
  for (const alias of MANUAL_ALIASES[card.id] ?? []) add(alias);

  add(card.name);
  add(card.name.replace(/^(l'|le |la |les |the )/i, "").trim());
  add(card.name.split(",")[0].trim());
  add(card.name.replace(/\bM\.\s*/g, "Mr. "));
  add(card.name.replace(/\bMme\.?\s*/g, "Mrs. "));
  add(card.name.replace(/\bDocteur\b/gi, "Doctor"));
  add(card.name.replace(/\bAmiral\b/gi, "Admiral"));

  if (card.wikipediaTitles) {
    for (const value of Object.values(card.wikipediaTitles)) {
      if (typeof value === "string") add(cleanTitle(value));
    }
  }

  return out.slice(0, 10);
}

function aliasRank(title: string, aliases: string[]): number {
  const clean = normalize(cleanTitle(title));
  const index = aliases.findIndex((alias) => normalize(alias) === clean);
  return index >= 0 ? index : 999;
}

async function queryPages(host: string, titles: string[]): Promise<Page[]> {
  const url = `${apiEndpoint(`https://${host}`)}?action=query&format=json&origin=*&redirects=1&prop=pageimages%7Crevisions%7Ccategories%7Cimages&piprop=thumbnail&pithumbsize=900&rvprop=content&rvslots=main&cllimit=50&imlimit=50&titles=${encodeURIComponent(titles.join("|"))}`;
  const data = await getJson<{ query?: { pages?: Record<string, Page> } }>(url, { fresh: FRESH });
  return Object.values(data.query?.pages ?? {});
}

function contentOf(page: Page): string {
  return page.revisions?.[0]?.slots?.main?.["*"] ?? "";
}

function isCharacterPage(page: Page, text: string): boolean {
  const categories = (page.categories ?? []).map((category) => category.title).join(" ");
  const categoryNames = (page.categories ?? []).map((category) =>
    category.title.replace(/^Category:/i, "").trim().toLowerCase(),
  );
  if (categoryNames.some((name) => BLOCKED_CATEGORY_NAMES.test(name))) return false;

  const head = text.slice(0, 2_500);
  if (NON_CHARACTER_INFOBOX.test(head) && !CHARACTER_INFOBOX.test(head)) return false;
  if (CHARACTER_CATEGORIES.test(categories)) return true;
  if (CHARACTER_INFOBOX.test(head)) return true;

  const lead = text.replace(/\{\{[^{}]*\}\}/g, " ").replace(/\s+/g, " ").slice(0, 1_400);
  if (NON_CHARACTER_LEAD.test(lead)) return false;
  if (/\b(is|was)\s+(a|an)\s+[^.]{0,90}\b(character|protagonist|antagonist|villager|hero)\b/i.test(lead)) return true;
  if (/\best\s+(un|une)\s+[^.]{0,90}\b(personnage|héros|antagoniste|protagoniste)\b/i.test(lead)) return true;
  if (CHARACTER_LEAD.test(lead.slice(0, 500))) return true;
  return false;
}

function leadFiles(text: string): string[] {
  const head = text.slice(0, 1_500);
  return [...head.matchAll(/\[\[\s*(?:File|Image):\s*([^|\]}\n]+)/gi)].map((match) => match[1].trim());
}

function infoboxFiles(text: string): string[] {
  const start = text.search(/\|\s*image\s*=/i);
  if (start < 0) return [];
  const block = text.slice(start, start + 1_400);
  const out: string[] = [];
  const add = (value: string) => {
    const file = value.trim().replace(/^File:/i, "");
    if (file && !out.some((item) => item.toLowerCase() === file.toLowerCase())) out.push(file);
  };

  // Galeries sans préfixe `File:` : `|image = <gallery> Banjo.png|...`.
  const gallery = block.match(/<gallery[^>]*>([\s\S]*?)<\/gallery>/i);
  if (gallery) {
    for (const line of gallery[1].split("\n")) {
      const file = line.split("|")[0]?.trim();
      if (file) add(file);
    }
  }

  for (const match of block.matchAll(/(?:File|Image):\s*([^|\]}\n<]+)/gi)) {
    add(match[1]);
  }
  return out;
}

function pickFile(candidates: string[], cardName: string, aliases: string[] = []): string | null {
  if (candidates.length === 0) return null;
  const clean = candidates.filter(
    (file) => !/\.(gif|svg)$/i.test(file) && !BAD_GALLERY.test(file),
  );
  const pool =
    clean.length > 0
      ? clean
      : candidates.filter((file) => !/\.(gif|svg)$/i.test(file));
  if (pool.length === 0) return null;

  // Une carte « Banjo & Kazooie » doit préférer un artwork où les deux
  // personnages apparaissent, pas le portrait de l'un ou de l'autre.
  const wanted = nameTokens([...aliases, cardName]);
  const exactNames = new Set(
    [cardName, ...aliases].map((value) => normalize(value)).filter(Boolean),
  );
  return pool
    .map((file, index) => {
      const haystack = normalize(file);
      const stem = normalize(file.replace(/\.[a-z0-9]+$/i, ""));
      const exact = exactNames.has(stem) ? 20 : 0;
      const score = [...wanted].filter((token) => haystack.includes(token)).length;
      return { file, index, score: score + exact };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]!.file;
}

async function imageUrl(host: string, file: string): Promise<string | null> {
  const title = `File:${file.replace(/^File:/i, "").trim()}`;
  const url = `${apiEndpoint(`https://${host}`)}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=900&titles=${encodeURIComponent(title)}`;
  try {
    const data = await getJson<{
      query?: {
        pages?: Record<
          string,
          { imageinfo?: { url?: string; thumburl?: string; extmetadata?: Record<string, { value?: string }> }[] }
        >;
      };
    }>(url, { fresh: FRESH });
    const page = Object.values(data.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    return info?.thumburl ?? info?.url ?? null;
  } catch {
    return null;
  }
}

/** Image principale (infobox) d'une page, sans passer par la recherche. */
async function pageLeadImage(host: string, title: string): Promise<string | null> {
  const url = `${apiEndpoint(`https://${host}`)}?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(title)}`;
  try {
    const data = await getJson<{
      query?: { pages?: Record<string, { original?: { source: string } }> };
    }>(url, { fresh: FRESH });
    const page = Object.values(data.query?.pages ?? {})[0];
    return page?.original?.source ?? null;
  } catch {
    return null;
  }
}

function pageUrl(host: string, title: string): string {
  return `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function hostOf(portrait: Portrait | undefined): string | null {
  if (!portrait) return null;
  if (portrait.wikiHost) return portrait.wikiHost;
  const pageHost = portrait.page?.match(/^https?:\/\/([^/]+\.fandom\.com)/)?.[1];
  if (pageHost) return pageHost;
  if (portrait.sourceName?.endsWith(".fandom.com")) return portrait.sourceName;
  return null;
}

async function searchTitles(host: string, term: string): Promise<string[]> {
  const url = `${apiEndpoint(`https://${host}`)}?action=query&format=json&origin=*&list=search&srnamespace=0&srlimit=6&srsearch=${encodeURIComponent(term)}`;
  const data = await getJson<{ query?: { search?: { title: string }[] } }>(url, { fresh: FRESH });
  return (data.query?.search ?? []).map((hit) => hit.title);
}

function nameTokens(values: string[]): Set<string> {
  const stop = new Set(["the", "and", "les", "des", "une", "un", "of", "de", "la", "le", "du", "der"]);
  const all = values
    .flatMap((value) => normalize(value).split(" "))
    .filter((token) => token.length >= 2 && !stop.has(token));
  const significant = all.filter((token) => token.length >= 3);
  // Un nom comme « M. Qi » n'a que des jetons courts : sans ce repli, aucun
  // alias ne pourrait jamais correspondre.
  return new Set(significant.length > 0 ? significant : all);
}

/** 3 = titre complet, 2 = surnom plus long, 1 = fragment, -1 = aucun rapport. */
function titleScore(title: string, aliases: string[], name: string): number {
  const cardTokens = nameTokens([...aliases, name]);
  const pageTokens = nameTokens([cleanTitle(title)]);
  if (cardTokens.size === 0 || pageTokens.size === 0) return -1;
  const cardInPage = [...cardTokens].every((token) => pageTokens.has(token));
  const pageInCard = [...pageTokens].every((token) => cardTokens.has(token));
  if (cardInPage && pageInCard) return 3;
  if (cardInPage) return 2;
  if (pageInCard) return 1;
  // « Challus Mercer » partage « mercer » avec « Le Docteur Mercer » :
  // suffisant pour chercher la page, pas pour l'accepter sans les filtres.
  if ([...pageTokens].some((token) => cardTokens.has(token))) return 1;
  return -1;
}

/** Recherche de secours quand aucune page ne porte exactement le nom de la carte. */
async function searchFallback(host: string, card: Card, aliases: string[]): Promise<Page[]> {
  const terms = [card.name, ...aliases].filter((value, index, list) => value && list.indexOf(value) === index).slice(0, 4);
  const titles = new Set<string>();
  for (const term of terms) {
    try {
      for (const title of await searchTitles(host, term)) {
        if (titleScore(title, aliases, card.name) > 0) titles.add(title);
        if (titles.size >= 8) break;
      }
    } catch {
      // recherche indisponible : on continue avec les autres termes
    }
    if (titles.size >= 8) break;
  }
  if (titles.size === 0) return [];
  const pages = await queryPages(host, [...titles]);
  const primary = normalize(card.name)
    .split(" ")
    .find((token) => token.length >= 3);
  const primaryRank = (title: string) =>
    primary && normalize(cleanTitle(title)).split(" ").includes(primary) ? 1 : 0;
  return pages
    .filter((page) => page.missing === undefined)
    .sort(
      (a, b) =>
        titleScore(b.title, aliases, card.name) - titleScore(a.title, aliases, card.name) ||
        primaryRank(b.title) - primaryRank(a.title),
    );
}

async function acceptPage(
  card: Card,
  host: string,
  page: Page,
  aliases: string[],
  used: Set<string>,
  rejected: string[],
): Promise<Result | null> {
  // Un alias manuel est une identité choisie : « Rauru » page Ocarina of Time
  // ne doit pas passer quand la carte est le Rauru de Tears of the Kingdom.
  if (BLOCKED_TITLE.test(page.title)) {
    rejected.push(`${page.title}: sous-page ou page de carte`);
    return null;
  }

  const pageTokens = nameTokens([page.title]);
  const manual = MANUAL_ALIASES[card.id] ?? [];
  if (manual.length > 0) {
    const matchesManual = manual.some((alias) =>
      [...nameTokens([alias])].every((token) => pageTokens.has(token)),
    );
    if (!matchesManual) {
      rejected.push(`${page.title}: hors alias manuel`);
      return null;
    }
  }

  // Le titre doit contenir au moins un alias complet : « Seymour Guado » ne
  // peut pas illustrer « Sir Jyscal Guado » sur le seul mot « Guado ».
  const matchesAlias = aliases.some((alias) => {
    const tokens = nameTokens([alias]);
    return tokens.size > 0 && [...tokens].every((token) => pageTokens.has(token));
  });
  if (!matchesAlias) {
    rejected.push(`${page.title}: aucun alias complet`);
    return null;
  }

  // Une page « Terry and Terri Bobcat » ne doit pas illustrer la seule carte
  // « Terri » : on refuse les titres combinés qui ajoutent un prénom.
  if (
    /(?:&|\band\b)/i.test(page.title) &&
    !/(?:&|\band\b)/i.test(card.name) &&
    !ALLOW_COMBINED_PAGES.has(card.id)
  ) {
    const own = nameTokens([...aliases, card.name]);
    const extra = [...nameTokens([page.title])].filter((token) => !own.has(token));
    if (extra.length > 0) {
      rejected.push(`${page.title}: page combinée (${extra.join(", ")})`);
      return null;
    }
  }

  const text = contentOf(page);
  // `{{DisambigMsg|...}}` est un bandeau « voir aussi », pas une page
  // d'homonymie : « Crusader » l'utilise tout en étant la page du héros.
  if (/\{\{\s*(disambig|disambiguation|homonymie)\s*\}\}/i.test(text)) {
    rejected.push(`${page.title}: homonymie`);
    return null;
  }
  if (!isCharacterPage(page, text)) {
    rejected.push(`${page.title}: pas une page de personnage`);
    return null;
  }

  const files = infoboxFiles(text);
  const lead = files.length === 0 ? leadFiles(text) : [];
  // Certaines pages n'ont qu'un GIF dans leur infobox. La liste `images` de
  // la page contient alors souvent le PNG fixe du même personnage.
  const wantedTokens = nameTokens([...aliases, card.name]);
  const rawGallery = (page.images ?? []).map((image) =>
    image.title.replace(/^File:/i, "").trim(),
  );
  const gallery = rawGallery.filter((file) =>
    [...wantedTokens].some((token) => normalize(file).includes(token)),
  );
  const relevantLead = lead.filter((file) =>
    [...wantedTokens].some((token) => normalize(file).includes(token)),
  );
  const pool = [...files, ...relevantLead, ...gallery];
  const preferred = PREFERRED_FILES[card.id]
    ? [...files, ...lead, ...rawGallery].find((file) =>
        PREFERRED_FILES[card.id]!.test(file),
      )
    : undefined;
  const first = preferred ?? pickFile(pool, card.name, aliases);
  const ordered = first ? [first, ...pool.filter((file) => file !== first)] : [];
  const pageImage = page.thumbnail?.source ?? null;
  const attempts: { file: string | null; prompt: string | null }[] = ordered.map((file) => ({ file, prompt: null }));
  if (pageImage) attempts.push({ file: null, prompt: pageImage });

  for (const attempt of attempts) {
    const raw = attempt.file ? await imageUrl(host, attempt.file) : attempt.prompt;
    if (!raw) continue;

    const chosenFile = attempt.file ?? assetName(raw);
    const isPreferred = Boolean(attempt.file && attempt.file === preferred);
    if (
      !attempt.file &&
      ![...wantedTokens].some((token) => normalize(chosenFile).includes(token))
    ) {
      rejected.push(`${page.title}: vignette sans rapport (${chosenFile})`);
      continue;
    }
    const iconNamed =
      /icon/i.test(chosenFile) &&
      [...nameTokens([card.name])].some((token) => normalize(chosenFile).includes(token));
    if (!attempt.file && /\.svg$/i.test(chosenFile)) {
      rejected.push(`${page.title}: SVG refusé (${chosenFile})`);
      continue;
    }
    if (!attempt.file && PHYSICAL.test(chosenFile) && !iconNamed) {
      rejected.push(`${page.title}: vignette de page refusée (${chosenFile})`);
      continue;
    }
    if (attempt.file && PHYSICAL.test(attempt.file) && !iconNamed && !isPreferred) {
      rejected.push(`${page.title}: fichier refusé (${attempt.file})`);
      continue;
    }

    const groupFile = /(?:^|[\s_-])and(?:[\s_-]|$)/i.test(chosenFile);
    const cardIsGroup = /\band\b|&/i.test(card.name) || manual.some((alias) => /\band\b|&/i.test(alias));
    if (groupFile && !cardIsGroup) {
      rejected.push(`${page.title}: image de groupe (${chosenFile})`);
      continue;
    }

    const key = dedupeKey(raw);
    if (used.has(key)) {
      rejected.push(`${page.title}: image déjà utilisée`);
      continue;
    }

    // Les sprites de jeu (Stardew, etc.) descendent à 128 px ; les artworks
    // très allongés (Ciri) sont acceptés jusqu'à 0,20 de ratio et recadrés
    // par `PORTRAIT_FRAMING`. Un `Icon` de wiki est accepté seulement s'il
    // porte le nom du personnage (sinon c'est une icône d'interface).
    const verdict = await inspectImage(raw, {
      minSide: 128,
      minRatio: 0.2,
      allowBlockedName: iconNamed,
    });
    if (!verdict.ok) {
      rejected.push(`${page.title}: ${verdict.reason}`);
      continue;
    }

    used.add(key);
    if (process.env.DEBUG_IMAGES) console.log(`\n[${card.id}] ${rejected.join(" · ")}`);
    return {
      id: card.id,
      name: card.name,
      franchise: card.franchise,
      host,
      page: pageUrl(host, page.title),
      file: chosenFile,
      url: raw,
      status: "found",
      reason: attempt.file ? "image d'infobox de personnage" : "image principale de la page personnage",
    };
  }
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8")) as Manifest;
  const runner = await openRunner();
  let cards: Card[];
  try {
    const rows = await runner.query(`
      select c.id,
             c.name,
             coalesce(f.name, c.universe) as franchise,
             c.wikipedia_titles as "wikipediaTitles",
             c.image_path as "imagePath"
        from public.cards c
        left join public.franchises f on f.id = c.franchise_id
       where c.active
       order by franchise, c.name
    `);
    cards = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      franchise: String(row.franchise),
      wikipediaTitles: (row.wikipediaTitles as Record<string, string> | null) ?? null,
      imagePath: (row.imagePath as string | null) ?? null,
    }));
  } finally {
    await runner.close();
  }

  const byId = new Map(cards.map((card) => [card.id, card]));
  const hostVotes = new Map<string, Map<string, number>>();
  for (const [id, portrait] of Object.entries(manifest.items)) {
    const card = byId.get(id);
    const host = hostOf(portrait);
    if (!card || !host) continue;
    const votes = hostVotes.get(card.franchise) ?? new Map<string, number>();
    votes.set(host, (votes.get(host) ?? 0) + 1);
    hostVotes.set(card.franchise, votes);
  }
  const hostByFranchise = new Map<string, string>();
  for (const [franchise, votes] of hostVotes) {
    const best = [...votes].sort((a, b) => b[1] - a[1])[0];
    if (best) hostByFranchise.set(franchise, best[0]);
  }

  const hostFallback = new Map<string, string | null>();
  const used = new Set(Object.values(manifest.items).map((portrait) => dedupeKey(portrait.url)));
  let targets = cards.filter(
    (card) => !manifest.items[card.id] && !card.imagePath && (ONLY.size === 0 || ONLY.has(card.id)),
  );
  if (LIMIT !== Infinity) targets = targets.slice(0, LIMIT);

  console.log(`→ ${cards.length} cartes actives, ${targets.length} à compléter`);
  let done = 0;

  const results = await mapLimit(targets, 6, async (card): Promise<Result> => {
    const pinned = CARD_PINNED[card.id];
    if (pinned) {
      const url = pinned.file
        ? await imageUrl(pinned.host, pinned.file)
        : await pageLeadImage(pinned.host, pinned.page);
      const verdict = url
        ? await inspectImage(url, { minSide: 128, minRatio: 0.2 })
        : null;
      if (url && verdict?.ok) {
        used.add(dedupeKey(url));
        done += 1;
        return {
          id: card.id,
          name: card.name,
          franchise: card.franchise,
          host: pinned.host,
          page: pageUrl(pinned.host, pinned.page),
          file: pinned.file ?? assetName(url),
          url,
          status: "found",
          reason: "visuel choisi sur le wiki de la franchise",
        };
      }
      done += 1;
      return {
        id: card.id,
        name: card.name,
        franchise: card.franchise,
        host: pinned.host,
        page: pageUrl(pinned.host, pinned.page),
        file: pinned.file ?? null,
        url,
        status: "invalid",
        reason: url ? (verdict?.reason ?? "image refusée") : "fichier introuvable",
      };
    }

    let host: string | null =
      CARD_HOST_OVERRIDES[card.id] ??
      hostByFranchise.get(card.franchise) ??
      HOST_FALLBACKS[card.franchise] ??
      null;
    if (!host) {
      if (!hostFallback.has(card.franchise)) {
        hostFallback.set(card.franchise, (await fandomHost(card.franchise)) ?? HOST_FALLBACKS[card.franchise] ?? null);
      }
      host = hostFallback.get(card.franchise) ?? null;
    }
    if (!host) {
      done += 1;
      return {
        id: card.id,
        name: card.name,
        franchise: card.franchise,
        host: null,
        page: null,
        file: null,
        url: null,
        status: "no-wiki",
        reason: "aucun wiki Fandom identifié",
      };
    }

    const aliases = aliasesFor(card);
    let pages: Page[] = [];
    try {
      pages = await queryPages(host, aliases);
    } catch (error) {
      done += 1;
      return {
        id: card.id,
        name: card.name,
        franchise: card.franchise,
        host,
        page: null,
        file: null,
        url: null,
        status: "invalid",
        reason: `API : ${(error as Error).message}`,
      };
    }

    const candidates = pages
      .filter((page) => page.missing === undefined && aliasRank(page.title, aliases) < 999)
      .sort((a, b) => aliasRank(a.title, aliases) - aliasRank(b.title, aliases));
    const rejected: string[] = [];

    for (const page of candidates) {
      const result = await acceptPage(card, host, page, aliases, used, rejected);
      if (result) {
        done += 1;
        if (done % 10 === 0) process.stdout.write(`  ${done}/${targets.length}\r`);
        return result;
      }
    }

    // Aucune page au titre exact : recherche plein texte du wiki, puis on ne
    // garde que les pages qui partagent un mot significatif avec le nom.
    try {
      const fallback = await searchFallback(host, card, aliases);
      for (const page of fallback) {
        if (page.missing !== undefined || candidates.some((candidate) => candidate.title === page.title)) continue;
        const result = await acceptPage(card, host, page, aliases, used, rejected);
        if (result) {
          done += 1;
          if (done % 10 === 0) process.stdout.write(`  ${done}/${targets.length}\r`);
          return result;
        }
      }
    } catch (error) {
      rejected.push(`recherche : ${(error as Error).message}`);
    }

    done += 1;
    if (done % 10 === 0) process.stdout.write(`  ${done}/${targets.length}\r`);
    return {
      id: card.id,
      name: card.name,
      franchise: card.franchise,
      host,
      page: null,
      file: null,
      url: null,
      status: "missing",
      reason: rejected.length > 0 ? rejected.join(" · ") : "aucune page correspondante",
    };
  });

  const found = results.filter((result) => result.status === "found");
  const missing = results.filter((result) => result.status !== "found");
  console.log(`\n✓ ${found.length} visuel(s) trouvé(s), ${missing.length} sans visuel`);
  for (const result of found.slice(0, 20)) {
    console.log(`  ${result.id} → ${result.file} (${result.host})`);
  }

  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, `${JSON.stringify({ generatedAt: new Date().toISOString(), found: found.length, missing: missing.length, results }, null, 2)}\n`);

  if (!APPLY) {
    console.log("→ simulation : manifeste et base inchangés (ajoute --apply).");
    return;
  }

  for (const result of found) {
    manifest.items[result.id] = {
      url: result.url!,
      source: "fandom",
      sourceName: result.host!,
      wikiHost: result.host!,
      wikiTitle: result.file ?? undefined,
      page: result.page ?? undefined,
      file: result.file ?? undefined,
      checkedAt: new Date().toISOString(),
      confidence: "medium",
    };
  }
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("✓ manifeste mis à jour");

  const runner2 = await openRunner();
  try {
    const values = found
      .map((result) => {
        const portrait = manifest.items[result.id];
        const width = portrait.width ? String(portrait.width) : "null";
        const height = portrait.height ? String(portrait.height) : "null";
        return `(${quote(result.id)}, ${quote(result.url)}, ${quote(result.host)}, ${quote(result.page)}, ${width}, ${height})`;
      })
      .join(",\n    ");
    if (values) {
      await runner2.query(`
        update public.cards as c
           set image_url = v.url,
               image_source_name = v.source_name,
               image_source_page = v.source_page,
               image_license = null,
               image_width = v.width::int,
               image_height = v.height::int,
               image_checked_at = now(),
               image_status = 'ok'
          from (values
      ${values}
          ) as v(id, url, source_name, source_page, width, height)
         where c.id = v.id;
      `);
    }
    console.log(`✓ base : ${found.length} image(s) appliquée(s)`);
  } finally {
    await runner2.close();
  }
}

main().catch((error) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exit(1);
});
