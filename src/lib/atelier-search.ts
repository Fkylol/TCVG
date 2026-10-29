/**
 * Aide à la préparation d'une carte, pour l'atelier local (`/atelier/cartes`).
 *
 * ⚠️ Réservé au serveur : ce module lit le disque et interroge des API
 * publiques (Wikipédia, Fandom, Wikimedia). Il ne doit jamais être importé par
 * un composant client.
 *
 * Rien n'est deviné : chaque visuel vient d'une réponse d'API qui nomme le
 * fichier et la page, puis il passe les contrôles de `images/lib/validate`
 * (taille, ratio, type, hotlink).
 */

import fs from "node:fs/promises";
import path from "node:path";

import {
  apiEndpoint,
  fandomHost,
  pageImage,
  searchTitles,
} from "../../scripts/images/lib/sources";
import { assetName, inspectImage, namesCharacter } from "../../scripts/images/lib/validate";

import { capRarity, rarityFromRank, type PortraitCandidate } from "./atelier-core";
import { CARD_GENRES, GENRES, type GenreSlug } from "./card-genres";
import { CARDS, UNIVERSES, type Rarity } from "./cards";
import type { CardLore } from "./card-lore";
import { log10p1, popularityScores } from "./popularity";
import { getPortrait } from "./portraits";
import {
  FRANCHISE_CAPS,
  LANGUAGES,
  PAGEVIEW_MONTHS,
} from "./rarity-distribution.config";

const USER_AGENT = "TCVG-atelier/1.0 (https://tcvg.fun)";
const DATASET = path.join(process.cwd(), ".popularity", "dataset.json");

export type PortraitSearch = {
  candidates: PortraitCandidate[];
  notes: string[];
};

type PageExtract = {
  query?: { pages?: Record<string, { title?: string; extract?: string; missing?: string }> };
};

function wikiHostsOfUniverse(universe: string): string[] {
  const counts = new Map<string, number>();
  for (const card of CARDS) {
    if (card.universe !== universe) continue;
    const portrait = getPortrait(card.id);
    const host = portrait?.wikiHost ?? (portrait?.source === "fandom" ? portrait.sourceName : undefined);
    if (host) counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([host]) => host)
    .slice(0, 3)
    // `wikiHost` est stocké sans protocole (« warcraft.fandom.com ») : les
    // appels d'API ont besoin de l'URL complète.
    .map((host) => (/^https?:\/\//.test(host) ? host : `https://${host}`));
}

type PageImages = {
  query?: { pages?: Record<string, { images?: { title?: string }[] }> };
};

type FileInfo = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: {
          thumburl?: string;
          url?: string;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }
    >;
  };
};

/**
 * Fichiers de la page qui portent le nom du personnage (renders, artworks).
 *
 * L'image d'infobox est souvent un détail (un portrait bébé, un emblème) : la
 * galerie de la page donne des visuels plus adaptés à une carte.
 */
async function pageFileCandidates(
  wiki: string,
  title: string,
  name: string,
): Promise<{ url: string; file: string; license?: string; credit?: string }[]> {
  try {
    const listUrl =
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&prop=images&imlimit=60` +
      `&titles=${encodeURIComponent(title)}`;
    const listRes = await fetch(listUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!listRes.ok) return [];
    const list = (await listRes.json()) as PageImages;
    const page = Object.values(list.query?.pages ?? {})[0];
    const tokens = normalize(name)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);

    const files = (page?.images ?? [])
      .map((image) => image.title ?? "")
      .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
      .filter((file) => {
        const haystack = normalize(file);
        return tokens.length === 0 || tokens.some((token) => haystack.includes(token));
      })
      .filter((file) => !/\.svg$/i.test(file) && !/(logo|icon|crest|map|banner|flag)/i.test(file))
      .slice(0, 6);
    if (files.length === 0) return [];

    const infoRes = await fetch(
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=800` +
        `&titles=${encodeURIComponent(files.join("|"))}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!infoRes.ok) return [];
    const info = (await infoRes.json()) as FileInfo;

    const out: { url: string; file: string; license?: string; credit?: string }[] = [];
    for (const entry of Object.values(info.query?.pages ?? {})) {
      const image = entry.imageinfo?.[0];
      const url = image?.thumburl ?? image?.url;
      if (!url) continue;
      const meta = image?.extmetadata ?? {};
      out.push({
        url,
        file: (entry.title ?? "").replace(/^File:/, "").replace(/^Fichier:/, ""),
        license: meta.LicenseShortName?.value,
        credit: meta.Artist?.value?.replace(/<[^>]+>/g, "").slice(0, 120),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Noms de fichiers qui trahissent une capture, un croquis ou un logo. */
const NOISE_FILE =
  /(screenshot|screen-shot|concept|sketch|sheet|gallery|logo|icon|cover|banner|background|wallpaper|map|sprite|walkthrough|speech|audio|ost|soundtrack|charbox|ability|prologue|gameplay|keyart|header|thumb)/i;

/**
 * Ressemblance entre le nom de fichier et le personnage.
 *
 * `3` : le fichier porte exactement son nom (`Ori.png`) ; `2` : son nom suivi
 * d'un suffixe court (`Ori6.jpg`, `Ori-render.png`) ; `1` : son nom quelque
 * part dans un nom plus long (`Ori-and-the-blind-forest-kuro.jpg`).
 */
function nameAffinity(file: string, name: string): number {
  const base = file
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  const target = name.toLowerCase().replace(/[\s_]+/g, "-");
  if (base === target) return 3;
  if (base.startsWith(target)) {
    const tail = base.slice(target.length).replace(/^[-_.(\s]+/, "");
    if (tail.length <= 12) return 2;
  }
  return base.includes(target) ? 1 : 0;
}

type AllImages = {
  query?: {
    allimages?: { name: string; url: string; width: number; height: number; mime?: string }[];
  };
};

/**
 * Fichiers du wiki dont le nom est celui du personnage.
 *
 * C'est la source des renders officiels (ceux que trouve une recherche
 * d'images) : la page du personnage, elle, ne liste souvent que des captures,
 * des planches de concept art et des logos.
 */
async function allImageCandidates(
  wiki: string,
  name: string,
): Promise<{ url: string; file: string; license?: string; credit?: string }[]> {
  try {
    const api = apiEndpoint(wiki);
    const listRes = await fetch(
      `${api}?action=query&format=json&origin=*&list=allimages&ailimit=50&aiprop=url%7Csize%7Cmime` +
        `&aiprefix=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!listRes.ok) return [];
    const list = (await listRes.json()) as AllImages;

    const picks = (list.query?.allimages ?? [])
      .filter((image) => /^image\/(png|jpeg|webp)/i.test(image.mime ?? ""))
      .filter((image) => image.width >= 300 && image.height >= 300)
      .filter((image) => nameAffinity(image.name, name) >= 2)
      .filter((image) => !NOISE_FILE.test(image.name))
      .slice(0, 8);
    if (picks.length === 0) return [];

    const infoRes = await fetch(
      `${api}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=800` +
        `&titles=${encodeURIComponent(picks.map((image) => `File:${image.name}`).join("|"))}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!infoRes.ok) return [];
    const info = (await infoRes.json()) as FileInfo;

    const out: { url: string; file: string; license?: string; credit?: string }[] = [];
    for (const entry of Object.values(info.query?.pages ?? {})) {
      const image = entry.imageinfo?.[0];
      const url = image?.thumburl ?? image?.url;
      if (!url) continue;
      const meta = image?.extmetadata ?? {};
      out.push({
        url,
        file: (entry.title ?? "").replace(/^(File|Fichier):/, ""),
        license: meta.LicenseShortName?.value,
        credit: meta.Artist?.value?.replace(/<[^>]+>/g, "").slice(0, 120),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Exécute des requêtes indépendantes en parallèle, avec une limite stable. */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Cherche des visuels pour un personnage : wiki de la franchise (déduit des
 * cartes déjà présentes), puis Wikipédia français et anglais.
 */
export async function searchPortraitCandidates({
  universe,
  universeLabel: requestedLabel,
  name,
}: {
  universe: string;
  universeLabel?: string;
  name: string;
}): Promise<PortraitSearch> {
  const notes: string[] = [];
  const universeLabel = requestedLabel ?? UNIVERSES[universe as keyof typeof UNIVERSES]?.label ?? universe;

  const hosts = [...wikiHostsOfUniverse(universe)];
  // La recherche de domaine Fandom ne sert qu'aux franchises sans wiki connu.
  // Pour les franchises déjà représentées, la devinette ajoutait plusieurs
  // sondes réseau séquentielles à chaque création sans élargir les sources.
  if (hosts.length === 0) {
    const guessed = await fandomHost(universeLabel);
    if (guessed) hosts.push(guessed);
    else notes.push(`Aucun wiki Fandom connu pour ${universeLabel} : recherche limitée à Wikipédia.`);
  }

  const wikis = [...hosts, "https://fr.wikipedia.org", "https://en.wikipedia.org"];
  const foundByWiki = await Promise.all(wikis.map(async (wiki) => {
    const titles = await searchTitles(wiki, name, 4);
    const relevant = titles.filter((title) => normalize(title).includes(normalize(name))).slice(0, 2);
    const pageResults = await Promise.all(relevant.map(async (title) => {
      const [image, files] = await Promise.all([
        pageImage(wiki, title, 800),
        pageFileCandidates(wiki, title, name),
      ]);
      return [
        ...(image ? [{
          wiki,
          title,
          url: image.url,
          sourceName: image.sourceName,
          page: image.page,
          file: image.file,
          license: image.license,
          credit: image.credit,
        }] : []),
        ...files.map((file) => ({
          wiki,
          title,
          url: file.url,
          sourceName: new URL(wiki).host,
          page: `${wiki}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
          file: file.file,
          license: file.license,
          credit: file.credit,
        })),
      ];
    }));

    // Renders officiels : fichiers du wiki qui portent le nom du personnage.
    const renders = wiki.includes("fandom")
      ? (await allImageCandidates(wiki, name)).map((file) => ({
          wiki,
          title: "",
          url: file.url,
          sourceName: new URL(wiki).host,
          page: `${wiki}/wiki/File:${encodeURIComponent(file.file.replace(/ /g, "_"))}`,
          file: file.file,
          license: file.license,
          credit: file.credit,
        }))
      : [];
    return [...pageResults.flat(), ...renders];
  }));
  const found = foundByWiki.flat();

  // Doublons : même fichier servi par deux vignettes (fr/en, page + galerie).
  const seen = new Set<string>();
  const unique = found.filter((entry) => {
    const key = `${entry.wiki}|${entry.file.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Les fichiers qui portent le nom du personnage passent en premier : ce sont
  // les renders, et ils ne doivent pas être coupés par la limite de contrôle.
  unique.sort((a, b) => nameAffinity(b.file, name) - nameAffinity(a.file, name));

  let rejected = 0;
  const inspected = await mapConcurrent(unique.slice(0, 12), 8, async (entry) => {
    // Planches de BD, scans, captures et croquis : lisibles en illustration,
    // mais illisibles en vignette de carte.
    if (/(comic|manga|chapter|panel|scan)/i.test(entry.file) || NOISE_FILE.test(entry.file)) {
      return null;
    }
    const verdict = await inspectImage(entry.url);
    if (!verdict.ok) return null;
    const candidate: PortraitCandidate = {
      url: entry.url,
      source: entry.wiki.includes("fandom") ? "fandom" : "wikipedia",
      sourceName: entry.sourceName,
      wikiHost: entry.wiki.includes("fandom") ? new URL(entry.wiki).host : undefined,
      page: entry.page,
      file: entry.file,
      width: verdict.width,
      height: verdict.height,
      license: entry.license,
      credit: entry.credit,
      checkedAt: new Date().toISOString(),
      confidence: "medium" as const,
      pageTitle: entry.title,
      wiki: entry.wiki,
      named: namesCharacter(entry.url, name),
    };
    return candidate;
  });
  const candidates = inspected.filter((candidate) => candidate !== null);
  rejected = Math.min(12, unique.length) - candidates.length;

  if (unique.length === 0) notes.push("Aucun visuel trouvé sur les wikis interrogés.");
  if (rejected > 0) {
    notes.push(`${rejected} visuel(s) écarté(s) : trop petit, ratio hors bornes ou hotlink refusé.`);
  }
  if (candidates.length > 0) notes.push(`${candidates.length} visuel(s) vérifié(s) et affichable(s) tel quel.`);

  // Priorité au nom dans le fichier, puis aux visuels en portrait (une carte
  // est verticale), puis à la résolution.
  const rank = (candidate: PortraitCandidate) =>
    nameAffinity(candidate.file ?? "", name) * 1000 +
    Number(candidate.named) * 100 +
    (candidate.height > candidate.width ? 200 : 0) +
    Math.min(candidate.width * candidate.height, 4_000_000) / 10_000;
  candidates.sort((a, b) => rank(b) - rank(a));
  return { candidates, notes };
}

/**
 * Visuel fourni à la main : l'URL d'une image trouvée ailleurs que sur les
 * wikis (recherche d'images, site officiel, fan art publié).
 *
 * Les wikis de franchise n'ont pas toujours le beau visuel : on accepte donc
 * une adresse collée, mais elle passe les mêmes contrôles qu'un candidat
 * automatique — taille, ratio, type, hotlink — pour ne pas casser la carte au
 * premier affichage. Aucune page source n'est connue : l'attribution se limite
 * à l'hébergeur, et la licence reste à vérifier par celui qui ajoute la carte.
 */
export async function inspectPortraitUrl({
  url,
  name,
}: {
  url: string;
  name: string;
}): Promise<{ ok: true; candidate: PortraitCandidate } | { ok: false; error: string }> {
  const raw = url.trim();
  if (!raw) return { ok: false, error: "Colle l'adresse d'une image (elle se termine par .png, .jpg ou .webp)." };
  if (!/^https?:\/\//i.test(raw)) {
    return { ok: false, error: "L'adresse doit commencer par http:// ou https://." };
  }

  // `fresh` : une image collée n'est pas encore en cache, et celle d'une URL
  // déjà vue a pu changer. Le nom de fichier n'est pas filtré : c'est
  // l'utilisateur qui a choisi ce visuel, pas une heuristique.
  const verdict = await inspectImage(raw, { fresh: true, allowBlockedName: true });
  if (!verdict.ok) return { ok: false, error: `Ce visuel ne convient pas : ${verdict.reason}.` };

  const finalUrl = verdict.finalUrl;
  const host = new URL(finalUrl).host;
  return {
    ok: true,
    candidate: {
      url: finalUrl,
      source: "custom",
      sourceName: host,
      page: finalUrl,
      file: assetName(finalUrl) || host,
      width: verdict.width,
      height: verdict.height,
      checkedAt: new Date().toISOString(),
      confidence: "medium",
      pageTitle: "",
      wiki: new URL(finalUrl).origin,
      named: namesCharacter(finalUrl, name),
    },
  };
}

/** Nettoie du wikitexte : modèles, références, liens et emphases. */
function stripWiki(raw: string): string {
  let text = raw;
  // Modèles imbriqués : on retire les plus profonds jusqu'à stabilité.
  for (let pass = 0; pass < 6 && /\{\{[^{}]*\}\}/.test(text); pass += 1) {
    text = text.replace(/\{\{[^{}]*\}\}/g, " ");
  }
  return text
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/^[=]+.*[=]+$/gm, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

/**
 * Introduction d'une page wiki en wikitexte (section 0).
 *
 * Les wikis Fandom n'activent pas toujours l'extension `extracts` : sans ce
 * repli, la moitié des personnages n'aurait aucune fiche.
 */
async function wikitextLead(wiki: string, title: string): Promise<string> {
  try {
    const url =
      `${apiEndpoint(wiki)}?action=parse&format=json&origin=*&prop=wikitext&section=0` +
      `&page=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return "";
    const data = (await res.json()) as { parse?: { wikitext?: { "*"?: string } } };
    return stripWiki(data.parse?.wikitext?.["*"] ?? "");
  } catch {
    return "";
  }
}

/** Texte d'introduction d'une page wiki, en clair. */
async function pageExtract(wiki: string, title: string): Promise<string> {
  try {
    const url =
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&redirects=1&prop=extracts` +
      `&explaintext=1&exintro=1&titles=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return wikitextLead(wiki, title);
    const data = (await res.json()) as PageExtract;
    const page = Object.values(data.query?.pages ?? {})[0];
    const extract = (page?.extract ?? "").trim();
    return extract.length > 40 ? extract : wikitextLead(wiki, title);
  } catch {
    return wikitextLead(wiki, title);
  }
}

function cleanExtract(raw: string): string {
  // Les pages de wiki recopient parfois un article officiel : le paragraphe
  // d'ouverture est une notice de copie, pas une description du personnage.
  const paragraphs = raw
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim().replace(/^[*#;:\s]+/, ""))
    .filter(Boolean)
    .filter(
      (paragraph) =>
        !/^(this (article|section) is (a copy|based)|cet article est une copie)/i.test(paragraph),
    );

  return paragraphs
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\([^)]{0,80}\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function firstSentences(value: string, max: number): string {
  const sentences = value.split(/(?<=[.!?])\s+/);
  let out = "";
  for (const sentence of sentences) {
    if (!sentence) continue;
    if (out && out.length + sentence.length > max) break;
    out = out ? `${out} ${sentence}` : sentence;
    if (out.length >= max * 0.7) break;
  }
  return out.slice(0, max).trim();
}

/** Accroche courte : premier membre de phrase, sans point final. */
function firstClause(value: string, max = 58): string {
  const clause = value.split(/[,.;:—]/)[0]?.trim() ?? "";
  if (clause.length <= max) return clause;
  return `${clause.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/**
 * Brouillon de fiche à partir de la page du visuel retenu, puis de Wikipédia
 * français en secours. Citation et pouvoir restent vides quand la source n'en
 * donne pas : le formulaire les laisse à compléter.
 */
export async function draftLore({
  candidate,
  name,
  universe,
  universeLabel: requestedLabel,
}: {
  candidate: PortraitCandidate | null;
  name: string;
  universe: string;
  universeLabel?: string;
}): Promise<CardLore> {
  const universeLabel = requestedLabel ?? UNIVERSES[universe as keyof typeof UNIVERSES]?.label ?? universe;

  // Un article de jeu ou une page d'homonymie décrit l'œuvre, pas le
  // personnage : on l'écarte pour ne pas coller « est un jeu vidéo… » sur la
  // fiche d'un personnage.
  const unusable = /(est un jeu (vidéo|de plates-formes|d'aventure|de rôle)|is a (video )?game|is an? (action|platformer|role-playing)|peut désigner|may refer to|most commonly refers to)/i;
  const usable = (text: string): string => {
    const cleaned = cleanExtract(text);
    return cleaned.length > 40 && !unusable.test(cleaned.slice(0, 160)) ? cleaned : "";
  };

  let clean = candidate?.pageTitle
    ? usable(await pageExtract(candidate.wiki, candidate.pageTitle))
    : "";

  // Les recherches de secours sont indépendantes : interroger Wikipédia fr/en
  // en parallèle évite d'attendre les délais d'une langue avant l'autre.
  if (!clean) {
    const fallbacks = await Promise.all(["https://fr.wikipedia.org", "https://en.wikipedia.org"].map(async (wiki) => {
      const titles = await searchTitles(wiki, name, 4);
      const match = titles.find((title) => normalize(title).includes(normalize(name)));
      return match ? usable(await pageExtract(wiki, match)) : "";
    }));
    clean = fallbacks.find(Boolean) ?? "";
  }
  if (!clean) {
    return {
      tagline:
        normalize(universeLabel) === normalize(name)
          ? `Personnage de ${universeLabel}`
          : `${name}, figure de ${universeLabel}`,
      bio: `Personnage de ${universeLabel}. Biographie à compléter depuis la page officielle.`,
    };
  }

  const quoted = clean.match(/[«"“]([^»"”]{12,160})[»"”]/)?.[1]?.trim();
  const quote = quoted && normalize(quoted) !== normalize(name) ? quoted : undefined;

  // Accroche : on retire « Nom is/est… » pour ne garder que l'épithète
  // (« chosen high priestess of the goddess Elune… »).
  const stripped = clean.toLowerCase().startsWith(name.toLowerCase())
    ? clean.slice(name.length).replace(/^\s+(is|was|est|était|fut|fût)\s+/i, "")
    : clean;
  const clause = firstClause(stripped.replace(/^[,\s;:—-]+/, ""));
  // Un membre de phrase qui commence par « along with », « who »… n'est pas
  // une épithète : mieux vaut l'accroche générique que « along with Broll ».
  const connector = /^(along with|who|which|that|also|and|but|ainsi que|qui|et|mais|il|elle)\b/i;
  const tagline =
    clause && !connector.test(clause)
      ? clause.charAt(0).toUpperCase() + clause.slice(1)
      : normalize(universeLabel) === normalize(name)
        ? `Personnage de ${universeLabel}`
        : `${name}, figure de ${universeLabel}`;

  return {
    tagline,
    bio: firstSentences(clean, 260),
    ...(quote ? { quote } : {}),
  };
}

export type UniverseGuess = {
  universe: string;
  label: string;
  /** Explication affichée dans le formulaire. */
  note: string;
};

/**
 * Noms courts employés par les articles pour désigner une franchise.
 *
 * Beaucoup de pages écrivent « le jeu vidéo Warcraft » et non « World of
 * Warcraft » : sans ces alias, la déduction de franchise échouerait.
 */
const FRANCHISE_ALIASES: Record<string, string[]> = {
  wow: ["Warcraft"],
  zelda: ["Zelda"],
  gta: ["GTA"],
  cod: ["Call of Duty"],
  ff7: ["Final Fantasy 7"],
  ff6: ["Final Fantasy 6"],
  ff9: ["Final Fantasy 9"],
  ff10: ["Final Fantasy 10"],
  darksouls: ["Dark Souls"],
  eldenring: ["Elden Ring"],
  residentevil: ["Resident Evil"],
  streetfighter: ["Street Fighter"],
  kingdomhearts: ["Kingdom Hearts"],
  halflife: ["Half-Life"],
  metalgear: ["Metal Gear"],
  totalwar: ["Total War"],
  empireatwar: ["Empire at War"],
  lifeisstrange: ["Life is Strange"],
  poppyplaytime: ["Poppy Playtime"],
  ori: ["Ori and the Blind Forest", "Ori and the Will of the Wisps"],
};

/** Mots qui trahissent une page de jeu vidéo ou de personnage de jeu. */
const MEDIA_HINT =
  /(video game|jeu vidéo|metroidvania|action-adventure|action-aventure|role-playing|rpg|character|personnage|protagonist|protagoniste|series|série|franchise|developed by|développé par)/i;

function containsLabel(haystack: string, label: string): boolean {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

/**
 * Devine la franchise à partir du seul nom du personnage.
 *
 * On cherche le personnage sur Wikipédia (fr puis en), puis on regarde quelles
 * pages parlent d'une franchise déjà au catalogue. Une page doit parler de jeu
 * vidéo (ou de personnage de jeu) pour être retenue : sans ce garde-fou, la
 * page « Ori » (concept yoruba) ferait croire à la franchise Ori.
 */
export async function detectUniverse(
  name: string,
  franchises: { slug: string; label: string }[] = Object.entries(UNIVERSES).map(([slug, universe]) => ({ slug, label: universe.label })),
): Promise<UniverseGuess | null> {
  const wikis = ["https://fr.wikipedia.org", "https://en.wikipedia.org"];
  const pages = (await Promise.all(wikis.map(async (wiki) => {
    const titles = await searchTitles(wiki, name, 5);
    return titles
      .filter((title) => normalize(title).includes(normalize(name)))
      .slice(0, 3)
      .map((title) => ({ wiki, title }));
  }))).flat();

  const extracts = await Promise.all(pages.map(async (page) => ({
    ...page,
    extract: await pageExtract(page.wiki, page.title),
  })));
  const matches: { universe: string; label: string; score: number; page: string }[] = [];
  for (const page of extracts) {
    if (!page.extract || !MEDIA_HINT.test(page.extract)) continue;
    const text = normalize(page.extract);
    for (const franchise of franchises) {
      const names = [franchise.label, ...(FRANCHISE_ALIASES[franchise.slug] ?? [])]
        .map((value) => normalize(value))
        .filter((value) => value.length >= 3);
      const hit = names.find((value) => containsLabel(text, value));
      if (!hit) continue;
      const title = normalize(page.title);
      const bonus = title === hit ? 40 : title.startsWith(hit) ? 30 : 0;
      matches.push({ universe: franchise.slug, label: franchise.label, score: hit.length + bonus, page: page.title });
    }
  }

  if (matches.length === 0) return null;
  matches.sort((a, b) => b.score - a.score || a.page.localeCompare(b.page));
  const best = matches[0];
  return {
    universe: best.universe,
    label: best.label,
    note: `Franchise déduite du nom : ${best.label} (page « ${best.page} »).`,
  };
}

/** Genres les plus fréquents dans une franchise, à recopier sur la nouvelle carte. */
export function suggestedGenres(universe: string): GenreSlug[] {
  const counts = new Map<GenreSlug, number>();
  for (const card of CARDS) {
    if (card.universe !== universe) continue;
    for (const genre of CARD_GENRES[card.id] ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre);
  return ranked.length > 0 ? ranked.slice(0, 1) : [GENRES[0].slug];
}

// ————————————————————————————————————————————————————————————
//  Rareté estimée
// ————————————————————————————————————————————————————————————

type PopularityDataset = {
  cards?: { id: string; pageviewsTotal?: number | null; sitelinksCount?: number | null }[];
};

async function loadDataset(): Promise<PopularityDataset | null> {
  try {
    return JSON.parse(await fs.readFile(DATASET, "utf8")) as PopularityDataset;
  } catch {
    return null;
  }
}

/**
 * Fenêtre de 12 mois complets, au format attendu par l'API Wikimedia
 * (`AAAAMMJJ`). Le mois en cours est exclu : il n'est pas terminé.
 */
function pageviewWindow(): { from: string; to: string } {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (PAGEVIEW_MONTHS - 1), 1));
  const stamp = (date: Date) =>
    `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(
      date.getUTCDate(),
    ).padStart(2, "0")}`;
  return { from: stamp(start), to: stamp(end) };
}

/** Pages vues mensuelles d'un article, sur les 12 derniers mois complets. */
async function monthlyPageviews(lang: string, title: string): Promise<number> {
  const { from, to } = pageviewWindow();
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/` +
    `${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${from}/${to}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return 0;
    const data = (await res.json()) as { items?: { views: number }[] };
    return (data.items ?? []).reduce((sum, item) => sum + item.views, 0);
  } catch {
    return 0;
  }
}

/**
 * Titres de la page dans les autres langues, via les liens interlangues.
 * La langue d'origine est ajoutée : `langlinks` ne la contient pas.
 */
async function languageTitles(wiki: string, title: string, lang: string): Promise<Map<string, string>> {
  const titles = new Map<string, string>([[lang, title]]);
  try {
    const url =
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&prop=langlinks&lllimit=max` +
      `&titles=${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return titles;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { langlinks?: { lang: string; "*": string }[] }> };
    };
    const page = Object.values(data.query?.pages ?? {})[0];
    for (const link of page?.langlinks ?? []) {
      if (link?.lang && link["*"]) titles.set(link.lang, link["*"]);
    }
  } catch {
    // Pas de liens interlangues : on garde au moins la langue d'origine.
  }
  return titles;
}

/** Page Wikipédia qui porte le nom du personnage, en anglais puis en français. */
async function findWikipediaPage(name: string): Promise<{ wiki: string; lang: string; title: string } | null> {
  const matches = await Promise.all((["en", "fr"] as const).map(async (lang) => {
    const wiki = `https://${lang}.wikipedia.org`;
    const hits = await searchTitles(wiki, name, 5);
    const title = hits.find((item) => normalize(item).includes(normalize(name)));
    return title ? { wiki, lang, title } : null;
  }));
  return matches[0] ?? matches[1] ?? null;
}

export type RarityEstimate = {
  rarity: Rarity;
  score: number;
  pageviews: number;
  languages: number;
  /** Explication lisible, affichée sous le sélecteur de rareté. */
  note: string;
};

/**
 * Estime la rareté d'un personnage avec la méthode du jeu (pages vues
 * Wikipédia + nombre de langues, en rangs percentiles), comparée aux scores du
 * dernier jeu de données de popularité.
 *
 * C'est une estimation pour une carte isolée : le calcul officiel reste
 * `popularity:*` puis `rarity:preview`, qui redistribue tout le catalogue.
 */
export async function estimateRarity({
  universe,
  name,
}: {
  universe: string;
  name: string;
}): Promise<RarityEstimate> {
  const dataset = await loadDataset();
  if (!dataset?.cards?.length) {
    return {
      rarity: "R",
      score: 0,
      pageviews: 0,
      languages: 0,
      note: "Jeu de données de popularité absent (.popularity/dataset.json) : rareté par défaut, à ajuster à la main.",
    };
  }

  const seed = await findWikipediaPage(name);
  const titlesByLang = seed ? await languageTitles(seed.wiki, seed.title, seed.lang) : new Map<string, string>();

  const views = await Promise.all(
    LANGUAGES.map((lang) => {
      const title = titlesByLang.get(lang);
      return title ? monthlyPageviews(lang, title) : 0;
    }),
  );
  const pageviews = views.reduce((sum, value) => sum + value, 0);
  const languages = titlesByLang.size;

  const NEW_ID = "__atelier__";
  const inputs = dataset.cards.map((card) => ({
    id: card.id,
    pageviews: log10p1(card.pageviewsTotal ?? 0),
    languages: log10p1(card.sitelinksCount ?? 0),
  }));
  inputs.push({ id: NEW_ID, pageviews: log10p1(pageviews), languages: log10p1(languages) });
  const scores = popularityScores(inputs);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const allScores = ranked.map(([, value]) => value);
  const fractionOf = (value: number) =>
    allScores.length === 0 ? 1 : allScores.filter((entry) => entry > value).length / allScores.length;

  let score = scores.get(NEW_ID) ?? 0;
  let fraction = fractionOf(score);
  let note = seed
    ? `${pageviews.toLocaleString("fr-FR")} pages vues sur 12 mois, ${languages} langue(s), ` +
      `rang estimé ${Math.round(fraction * 100)} %`
    : `Aucune page Wikipédia à son nom : rareté estimée d'après la franchise`;

  // Repli du jeu : sans page Wikipédia, on prend le score médian de la
  // franchise plutôt que de classer la carte en Commune par défaut.
  if (!seed) {
    const universeOf = new Map(CARDS.map((card) => [card.id, card.universe]));
    const franchiseScores = dataset.cards
      .filter((card) => universeOf.get(card.id) === universe)
      .map((card) => scores.get(card.id) ?? 0)
      .sort((a, b) => a - b);
    if (franchiseScores.length > 0) {
      score = franchiseScores[Math.floor(franchiseScores.length / 2)];
      fraction = fractionOf(score);
      note += ` (score médian ${score.toFixed(1)} sur ${franchiseScores.length} cartes, rang ${Math.round(
        fraction * 100,
      )} %)`;
    }
  }

  // Plafonds par franchise (3 Mythiques, 8 Légendaires).
  const counts: Partial<Record<Rarity, number>> = {};
  for (const card of CARDS) {
    if (card.universe !== universe) continue;
    counts[card.rarity] = (counts[card.rarity] ?? 0) + 1;
  }
  const estimated = rarityFromRank(fraction);
  const rarity = capRarity(estimated, counts, FRANCHISE_CAPS);

  note += ` → ${rarity}`;
  if (rarity !== estimated) note += ` (plafond de la franchise : ${estimated} écrêté)`;
  note += ". À ajuster si besoin.";

  return { rarity, score, pageviews, languages, note };
}
