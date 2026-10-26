/**
 * Recherche d'une image de personnage sur les sources publiques, dans l'ordre
 * du cahier des charges : Wikidata (P18 / Commons), wiki de la franchise
 * (Fandom), puis Wikipédia (`pageimages`).
 *
 * Aucune URL n'est devinée : chaque candidat vient d'une réponse d'API qui
 * nomme le fichier, la page et éventuellement la licence. La vérification des
 * dimensions et du rendu hotlink se fait ensuite (`validate.ts`).
 */

import { getJson } from "./http";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

export type Candidate = {
  url: string;
  source: "wikidata" | "fandom" | "wikipedia";
  sourceName: string;
  page: string;
  file: string;
  license?: string;
  credit?: string;
};

type CommonsImageInfo = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: {
          url?: string;
          thumburl?: string;
          width?: number;
          height?: number;
          extmetadata?: Record<string, { value?: string }>;
        }[];
      }
    >;
  };
};

/**
 * Fichier Commons (P18) d'une entité Wikidata, avec vignette de 800 px.
 * La propriété P18 désigne le fichier ; l'URL réelle vient de l'API Commons.
 */
export async function wikidataCandidates(wikidataId: string, label: string): Promise<Candidate[]> {
  try {
    const data = await getJson<{ results?: { bindings?: { image?: { value: string } }[] } }>(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(
        `SELECT ?image WHERE { wd:${wikidataId} wdt:P18 ?image } LIMIT 3`,
      )}`,
    );
    const files = (data.results?.bindings ?? [])
      .map((row) => row.image?.value)
      .filter((value): value is string => Boolean(value))
      .map((value) => decodeURIComponent(value.split("/").pop() ?? ""))
      .filter(Boolean);
    if (files.length === 0) return [];

    const titles = files.map((file) => `File:${file}`).join("|");
    const info = await getJson<CommonsImageInfo>(
      `${COMMONS_API}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=800&titles=${encodeURIComponent(titles)}`,
    );

    const out: Candidate[] = [];
    for (const page of Object.values(info.query?.pages ?? {})) {
      const image = page.imageinfo?.[0];
      const url = image?.thumburl ?? image?.url;
      if (!url) continue;
      const meta = image?.extmetadata ?? {};
      out.push({
        url,
        source: "wikidata",
        sourceName: "Wikidata (P18)",
        page: `https://www.wikidata.org/wiki/${wikidataId}`,
        file: page.title?.replace(/^File:/, "") ?? label,
        license: meta.LicenseShortName?.value,
        credit: meta.Artist?.value?.replace(/<[^>]+>/g, "").slice(0, 120),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Point d'entrée de l'API MediaWiki d'un wiki.
 * Wikipédia sert son API sous `/w/api.php`, Fandom sous `/api.php`.
 */
export function apiEndpoint(wiki: string): string {
  return `${wiki}${wiki.includes("wikipedia.org") ? "/w" : ""}/api.php`;
}

type WikiPageImages = {
  query?: {
    pages?: Record<string, { title?: string; missing?: string; thumbnail?: { source: string; width: number; height: number } }>;
  };
};

/** Image principale (infobox) d'une page de wiki, via `pageimages`. */
export async function pageImage(wiki: string, title: string, size = 800): Promise<Candidate | null> {
  try {
    const data = await getJson<WikiPageImages>(
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail%7Cname&pithumbsize=${size}&titles=${encodeURIComponent(title)}`,
    );
    const page = Object.values(data.query?.pages ?? {})[0];
    if (!page || page.missing !== undefined || !page.thumbnail?.source) return null;
    return {
      url: page.thumbnail.source,
      source: wiki.includes("fandom") ? "fandom" : "wikipedia",
      sourceName: wiki.includes("fandom") ? new URL(wiki).host : new URL(wiki).host,
      page: `${wiki}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      file: decodeURIComponent(page.thumbnail.source.split("/").pop() ?? title),
    };
  } catch {
    return null;
  }
}

/** Résultats de recherche plein texte d'un wiki, titres uniquement. */
export async function searchTitles(wiki: string, term: string, limit = 5): Promise<string[]> {
  try {
    const data = await getJson<{ query?: { search?: { title: string }[] } }>(
      `${apiEndpoint(wiki)}?action=query&format=json&origin=*&list=search&srnamespace=0&srlimit=${limit}&srsearch=${encodeURIComponent(term)}`,
    );
    return (data.query?.search ?? []).map((hit) => hit.title);
  } catch {
    return [];
  }
}

/**
 * Hôte du wiki Fandom d'une franchise.
 *
 * L'annuaire historique (`Wikis/ByString`) est fermé (403/404) : on essaie
 * des formes dérivées du nom de la franchise et on ne retient que celles qui
 * répondent réellement (`meta=siteinfo`). Un hôte qui n'existe pas échoue
 * proprement, il n'est jamais enregistré.
 */
export async function fandomHost(franchise: string): Promise<string | null> {
  const base = franchise
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = (value: string) => value.replace(/[^a-z0-9]/g, "");
  const words = base.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && word !== "the");
  const forms = new Set<string>([slug(base)]);
  if (words.length > 0) forms.add(slug(words[words.length - 1]));
  if (words.length > 1) forms.add(slug(words.slice(0, 2).join("")));

  for (const form of forms) {
    if (!form) continue;
    const host = `${form}.fandom.com`;
    try {
      const info = await getJson<{ query?: { general?: { sitename?: string } } }>(
        `https://${host}/api.php?action=query&format=json&meta=siteinfo&siprop=general`,
      );
      if (info.query?.general?.sitename) return host;
    } catch {
      // hôte inexistant : on essaie le suivant
    }
  }
  return null;
}

/**
 * Fichiers de la page Wikipédia qui portent le nom du personnage.
 *
 * `pageimages` ne renvoie que les images libres : les visuels de personnages
 * de jeu vidéo (fair use) en sont exclus. On lit donc la liste des fichiers de
 * l'article et on ne garde que ceux dont le nom contient un mot du personnage.
 */
export async function wikipediaFileCandidates(
  name: string,
  franchise: string,
  langs: string[],
): Promise<Candidate[]> {
  const tokens = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5 || (token.length >= 4 && !["the", "der", "les"].includes(token)));
  const out: Candidate[] = [];

  for (const lang of langs) {
    const wiki = `https://${lang}.wikipedia.org`;
    const titles = (await searchTitles(wiki, `${name} ${franchise}`, 3))
      .filter((title) => titleMatches(title, name))
      .slice(0, 2);
    for (const title of titles) {
      let files: string[] = [];
      try {
        const data = await getJson<{
          query?: { pages?: Record<string, { images?: { title: string }[] }> };
        }>(
          `${apiEndpoint(wiki)}?action=query&format=json&origin=*&prop=images&imlimit=40&titles=${encodeURIComponent(title)}`,
        );
        const page = Object.values(data.query?.pages ?? {})[0];
        files = (page?.images ?? []).map((image) => image.title.replace(/^File:/, ""));
      } catch {
        files = [];
      }

      const matching = files.filter((file) => {
        const normalized = file
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return tokens.some((token) => normalized.includes(token));
      });

      for (const file of matching.slice(0, 2)) {
        try {
          const info = await getJson<CommonsImageInfo>(
            `${apiEndpoint(wiki)}?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=800&titles=${encodeURIComponent(`File:${file}`)}`,
          );
          const pageInfo = Object.values(info.query?.pages ?? {})[0];
          const image = pageInfo?.imageinfo?.[0];
          const url = image?.thumburl ?? image?.url;
          if (!url) continue;
          const meta = image?.extmetadata ?? {};
          out.push({
            url,
            source: "wikipedia",
            sourceName: `${lang}.wikipedia`,
            page: `${wiki}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
            file,
            license: meta.LicenseShortName?.value,
            credit: meta.Artist?.value?.replace(/<[^>]+>/g, "").slice(0, 120),
          });
        } catch {
          // fichier sans imageinfo : on passe
        }
      }
    }
  }

  return out;
}

/**
 * Candidats Wikipédia : recherche du personnage dans la langue demandée, puis
 * `pageimages` sur les trois premières pages. La franchise est ajoutée au
 * terme de recherche pour écarter les homonymes.
 */
/** Le titre de page cite-t-il le nom du personnage (mot entier ≥ 4 lettres) ? */
function titleMatches(title: string, name: string): boolean {
  const squash = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");
  const haystack = ` ${squash(title)} `;
  const tokens = squash(name)
    .split(" ")
    .filter((token) => token.length >= 4 && !["the", "der", "les", "des"].includes(token));
  if (tokens.length === 0) return true;
  return tokens.some((token) => haystack.includes(` ${token}`));
}

export async function wikipediaCandidates(name: string, franchise: string, langs: string[]): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const lang of langs) {
    const wiki = `https://${lang}.wikipedia.org`;
    const titles = new Set<string>();
    for (const term of [`${name} ${franchise}`, name]) {
      for (const title of await searchTitles(wiki, term, 3)) titles.add(title);
      if (titles.size >= 3) break;
    }
    for (const title of [...titles].filter((item) => titleMatches(item, name)).slice(0, 3)) {
      const candidate = await pageImage(wiki, title);
      if (candidate) out.push({ ...candidate, sourceName: `${lang}.wikipedia` });
    }
  }
  return out;
}

/** Candidats Fandom : page du personnage sur le wiki de la franchise. */
export async function fandomCandidates(host: string, name: string): Promise<Candidate[]> {
  const wiki = `https://${host}`;
  const titles = new Set<string>();
  for (const term of [name]) {
    for (const title of await searchTitles(wiki, term, 3)) titles.add(title);
  }
  const out: Candidate[] = [];
  for (const title of [...titles].filter((item) => titleMatches(item, name)).slice(0, 2)) {
    const candidate = await pageImage(wiki, title);
    if (candidate) out.push({ ...candidate, sourceName: host });
  }
  return out;
}
