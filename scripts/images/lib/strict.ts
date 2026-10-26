/**
 * Règles strictes d'acceptation d'un visuel de carte.
 *
 * La chasse précédente acceptait n'importe quelle image dont le nom de fichier
 * citait le personnage : « Croisé » a reçu une église, « Kirby » une photo de
 * Jack Kirby, « Luigi » une rue de Wuppertal. Ici c'est la source qui fait foi,
 * jamais le nom du fichier :
 *
 *   — Wiki de la franchise (Fandom) : la page doit porter exactement le nom du
 *     personnage, sur un wiki dont le domaine correspond à la franchise, et son
 *     image principale (infobox) doit exister. C'est la source interrogée en
 *     premier : elle expose les artworks du jeu.
 *   — Wikidata : à défaut, l'entité doit être un personnage fictif ET être
 *     rattachée à la franchise de la carte (œuvre d'appartenance
 *     `P1441`/`P1080`, personnage cité par la franchise `P674`, ou entité de la
 *     franchise elle-même).
 *
 * Ce module est pur : aucune requête réseau, aucune écriture. Les tests de
 * non-régression s'appuient dessus avec les faux positifs déjà rencontrés.
 */

/** Niveau de confiance affiché dans l'audit des visuels. */
export type Confidence = "high" | "medium";

/** Pas de correspondance : la raison est écrite pour être lue telle quelle. */
export type Verdict = { ok: true; confidence: Confidence; reason: string } | { ok: false; reason: string };

export type CharacterFacts = {
  id: string;
  labels: string[];
  descriptions?: string[];
  isFictionalCharacter: boolean;
  isDisambiguation: boolean;
  isList: boolean;
  /** Œuvres d'appartenance (`P1441`, `P1080`, `P170`). */
  works: string[];
};

export type FranchiseScope = {
  /** Libellé de la franchise, tel qu'affiché (« Final Fantasy IX »). */
  name: string;
  /** Entités qui représentent la franchise (elle-même, sa série, son univers). */
  anchors: string[];
  /** Œuvres de la franchise (`P179`) plus les ancres elles-mêmes. */
  works: string[];
  /** Personnages cités par la franchise (`P674`). */
  characters: string[];
};

/** Nom comparable : sans accents, minuscules, séparateurs réduits à un espace. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Libellé sans précision entre parenthèses (« Kirby (character) » → « Kirby »). */
export function baseName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/**
 * Le libellé désigne-t-il le personnage de la carte ?
 *
 * Comparaison exacte d'abord (« Cloud » ↔ « Cloud »), puis préfixe d'un côté ou
 * de l'autre : les fiches Wikidata portent souvent le nom complet (« Samus
 * Aran ») quand la carte est abrégée (« Samus »), et inversement.
 */
export function nameMatches(cardName: string, labels: string[]): boolean {
  const wanted = normalize(cardName);
  if (wanted.length < 3) return false;
  const wantedWords = wanted.split(" ");

  for (const label of labels) {
    const base = baseName(label);
    const candidate = normalize(base);
    if (!candidate) continue;
    if (candidate === wanted) return true;

    const candidateWords = candidate.split(" ");

    // « Samus » (carte) → « Samus Aran » (fiche) : le nom de la carte ouvre le
    // libellé et le complément est un nom propre (« Aran », « Strife »). Un nom
    // d'œuvre (« Luigi's Mansion ») ne compte pas : possessif refusé, et chaque
    // mot ajouté doit être un vrai mot, pas une particule d'un caractère.
    if (wantedWords.length < candidateWords.length) {
      const prefix = candidateWords.slice(0, wantedWords.length).join(" ");
      if (prefix !== wanted) continue;
      if (/['\u2019]s\b/.test(base)) continue;
      const extra = candidateWords.slice(wantedWords.length);
      if (extra.length > 2) continue;
      if (extra.every((word) => word.length >= 2)) return true;
      continue;
    }

    // « Terra Branford » (carte) → « Terra » (fiche) : la fiche donne le nom
    // court, la carte le nom complet. On n'accepte ce sens que si la fiche
    // n'est pas un simple préfixe de mot (« Vitry-le-Croisé » pour « Croisé »).
    if (candidateWords.length < wantedWords.length) {
      const prefix = wantedWords.slice(0, candidateWords.length).join(" ");
      if (prefix === candidate) return true;
    }
  }
  return false;
}

/** Entités rattachées à la franchise : ses œuvres et ses personnages cités. */
export function isInFranchise(entity: CharacterFacts, scope: FranchiseScope): boolean {
  const members = new Set([...scope.anchors, ...scope.works, ...scope.characters]);
  if (members.has(entity.id)) return true;
  return entity.works.some((work) => members.has(work));
}

/**
 * Accepte (ou non) une entité Wikidata comme visuel de la carte.
 *
 * Une entité acceptée est forcément un personnage fictif rattaché à la
 * franchise : une personne réelle, un lieu, une œuvre ou une page d'homonymie
 * sont refusés même si leur libellé contient le nom du personnage.
 */
export function acceptWikidataCharacter(
  entity: CharacterFacts,
  scope: FranchiseScope,
  cardName: string,
): Verdict {
  if (entity.isDisambiguation) return { ok: false, reason: "page d'homonymie" };
  if (entity.isList) return { ok: false, reason: "liste, pas un personnage" };
  if (!entity.isFictionalCharacter) {
    return { ok: false, reason: `pas un personnage fictif (${entity.id})` };
  }
  if (!nameMatches(cardName, entity.labels)) {
    return { ok: false, reason: `nom absent de l'entité ${entity.id}` };
  }
  if (!isInFranchise(entity, scope)) {
    return { ok: false, reason: `aucun lien avec ${scope.name}` };
  }
  const exact = entity.labels.some((label) => normalize(baseName(label)) === normalize(cardName));
  return {
    ok: true,
    confidence: exact ? "high" : "medium",
    reason: `${entity.id} « ${entity.labels[0] ?? entity.id} » rattaché à ${scope.name}`,
  };
}

/**
 * Le domaine du wiki correspond-il à la franchise ?
 * « finalfantasy.fandom.com » pour « Final Fantasy IX », « zelda.fandom.com »
 * pour « The Legend of Zelda ». On compare des formes sans séparateurs.
 */
export function hostMatchesFranchise(host: string, franchiseName: string): boolean {
  const subdomain = host.split(".")[0]?.toLowerCase() ?? "";
  if (!subdomain) return false;
  const slug = (value: string) => value.replace(/[^a-z0-9]/g, "");
  const hostSlug = slug(subdomain);
  const franchiseSlug = slug(
    franchiseName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );
  if (hostSlug.length < 4 || franchiseSlug.length < 4) return false;
  if (hostSlug === franchiseSlug) return true;
  if (franchiseSlug.includes(hostSlug) || hostSlug.includes(franchiseSlug)) return true;
  // « poppy-playtime » (jeu) pour « Poppy Playtime » : le domaine est une
  // contraction du titre, on exige alors que les mots de la franchise y soient.
  const words = normalize(franchiseName).split(" ").filter((word) => word.length >= 4);
  return words.length > 0 && words.every((word) => hostSlug.includes(slug(word)));
}

export type FandomPageInput = {
  /** Titre de la page tel que retourné par l'API du wiki. */
  title: string;
  /** Nom du personnage dans le catalogue. */
  cardName: string;
  /** Domaine du wiki (« zelda.fandom.com »). */
  host: string;
  franchiseName: string;
  /** La page est-elle une page d'homonymie ? */
  disambiguation: boolean;
  /** La page a-t-elle une image principale (infobox) ? */
  hasLeadImage: boolean;
};

/** Tirets, apostrophes et espaces ne changent pas le titre d'une page. */
function sameTitle(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}

/**
 * Accepte (ou non) la page d'un wiki de franchise comme source du visuel.
 *
 * Le titre doit être exactement le nom du personnage (ou ce nom suivi d'une
 * précision entre parenthèses, cas des wikis qui désambiguïsent), la page ne
 * doit être ni une homonymie ni une liste, le wiki doit correspondre à la
 * franchise et la page doit avoir une image principale.
 */
export function acceptFandomPage(page: FandomPageInput): Verdict {
  const title = page.title.trim();
  if (/^(category|file|template|list of)\b/i.test(title)) {
    return { ok: false, reason: "page de catégorie, de fichier ou de liste" };
  }
  if (/\(disambiguation\)$/i.test(title) || page.disambiguation) {
    return { ok: false, reason: "page d'homonymie" };
  }
  if (!sameTitle(title, page.cardName)) {
    return { ok: false, reason: `titre « ${title} » différent du personnage` };
  }
  if (!hostMatchesFranchise(page.host, page.franchiseName)) {
    return { ok: false, reason: `wiki « ${page.host} » hors franchise` };
  }
  if (!page.hasLeadImage) {
    return { ok: false, reason: "aucune image principale sur la page" };
  }
  return { ok: true, confidence: "medium", reason: `page « ${title} » du wiki ${page.host}` };
}
