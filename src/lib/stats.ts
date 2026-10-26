import type { Card, Rarity } from "./cards";

/**
 * Statistiques des cartes.
 *
 * Trois notions distinctes :
 * - la **rareté** (`card.rarity`) fixe les chances de tirage et ne bouge pas ;
 * - la **puissance** et l'**aura** situent la carte à l'intérieur de sa rareté ;
 * - la **qualité** est un indice qui résume les deux.
 *
 * Tout le barème est ici : changer les fourchettes ci-dessous recalcule les
 * 84 cartes d'un coup, sans toucher au catalogue.
 */

/** Fourchette d'une statistique : minimum, puis écart maximal au-dessus. */
export type StatBand = {
  /** Valeur pour un coefficient de 0. */
  min: number;
  /** Valeur ajoutée pour un coefficient de 1. */
  spread: number;
};

export type RarityStats = {
  power: StatBand;
  aura: StatBand;
};

/**
 * Barème central, par rareté.
 *
 * Les fourchettes se chevauchent volontairement : une carte Rare au sommet
 * peut dépasser une Épique en bas de sa fourchette.
 */
export const STAT_BANDS: Record<Rarity, RarityStats> = {
  C: { power: { min: 1, spread: 39 }, aura: { min: 1, spread: 39 } },
  UC: { power: { min: 41, spread: 14 }, aura: { min: 41, spread: 14 } },
  R: { power: { min: 56, spread: 14 }, aura: { min: 56, spread: 14 } },
  SR: { power: { min: 71, spread: 14 }, aura: { min: 71, spread: 14 } },
  UR: { power: { min: 86, spread: 9 }, aura: { min: 86, spread: 9 } },
  L: { power: { min: 96, spread: 4 }, aura: { min: 96, spread: 4 } },
};

/**
 * Valeurs explicites de certains personnages, dans l'échelle du barème.
 *
 * La plupart des cartes dérivent leur puissance de leur coefficient ; les
 * figures emblématiques ont en revanche des valeurs fixées à la main, qui
 * doivent rester exactes. Elles sont ramenées dans la fourchette de leur
 * rareté au calcul, pour que la règle affichée reste vraie.
 */
export const CARD_STATS: Record<string, { power: number; aura: number }> = {
  // ——— World of Warcraft ———
  arthas: { power: 99, aura: 98 },
  illidan: { power: 96, aura: 97 },
  sylvanas: { power: 92, aura: 94 },
  jaina: { power: 91, aura: 89 },
  thrall: { power: 93, aura: 95 },
  "tirion-fordring": { power: 88, aura: 90 },
  anduin: { power: 85, aura: 85 },
  garrosh: { power: 90, aura: 87 },

  // ——— Final Fantasy XIV ———
  "emet-selch": { power: 98, aura: 99 },
  venat: { power: 97, aura: 98 },
  haurchefant: { power: 86, aura: 95 },
  zenos: { power: 95, aura: 91 },
  aymeric: { power: 87, aura: 89 },
  "graha-tia": { power: 89, aura: 92 },
  estinien: { power: 90, aura: 88 },

  // ——— Dofus ———
  goultard: { power: 97, aura: 96 },
  arpagone: { power: 83, aura: 82 },
  rushu: { power: 99, aura: 96 },
  "joris-jurgen": { power: 86, aura: 91 },

  // ——— Guild Wars 2 ———
  trahearne: { power: 85, aura: 83 },
  rytlock: { power: 91, aura: 90 },
  caithe: { power: 85, aura: 85 },
  "palawa-joko": { power: 94, aura: 95 },
  aurene: { power: 98, aura: 96 },

  // ——— RuneScape ———
  "king-black-dragon": { power: 88, aura: 86 },
  zamorak: { power: 95, aura: 92 },
  zaros: { power: 99, aura: 97 },
  "wise-old-man": { power: 71, aura: 80 },

  // ——— The Elder Scrolls Online ———
  mannimarco: { power: 93, aura: 91 },
  cadwell: { power: 78, aura: 85 },

  // ——— Lost Ark ———
  kadan: { power: 95, aura: 94 },
  brelshaza: { power: 94, aura: 95 },

  // ——— Star Wars: The Old Republic ———
  malgus: { power: 95, aura: 93 },
  "satele-shan": { power: 92, aura: 90 },

  // ——— Vague MMO de fin octobre 2026 ———
  // Les valeurs demandées sont reprises à l'unité. Quand les deux tombent
  // dans deux paliers différents, la rareté suit le plus haut et l'autre
  // statistique est ramenée à la borne basse du palier (ici déjà appliqué).
  kerafyrm: { power: 100, aura: 99 },
  "firiona-vie": { power: 89, aura: 95 },
  antharas: { power: 98, aura: 97 },
  baium: { power: 95, aura: 94 },
  baphomet: { power: 91, aura: 93 },
  "valkyrie-randgris": { power: 96, aura: 96 },
  "black-mage": { power: 99, aura: 98 },
  zakum: { power: 87, aura: 90 },
  tiamat: { power: 97, aura: 96 },
  marchutan: { power: 94, aura: 93 },
  "elion-dulas": { power: 86, aura: 86 },
  "jin-soyeon": { power: 96, aura: 97 },
  "hong-seokkeun": { power: 92, aura: 94 },
  "black-spirit": { power: 96, aura: 96 },
  illezra: { power: 97, aura: 96 },
  "jack-boone": { power: 86, aura: 87 },
  "kirsten-geary": { power: 85, aura: 92 },
  "dark-falz-persona": { power: 97, aura: 96 },
  conan: { power: 98, aura: 99 },
  statesman: { power: 96, aura: 96 },
  "lord-recluse": { power: 95, aura: 95 },
  ferumbras: { power: 99, aura: 98 },
  avatus: { power: 93, aura: 90 },
  "artemis-zin": { power: 86, aura: 88 },

  // ——— Vague MMO de fin octobre 2026 (suite) ———
  // Même règle : la rareté suit le plus haut des deux chiffres, l'autre valeur
  // est ramenée à la borne basse du palier.
  clockworks: { power: 94, aura: 95 },
  maflon: { power: 71, aura: 82 },
  tcharzanek: { power: 97, aura: 96 },
  malekith: { power: 98, aura: 98 },
  morgana: { power: 95, aura: 94 },
  "arthur-corrompu": { power: 97, aura: 96 },
  kundun: { power: 99, aura: 97 },
  yugo: { power: 91, aura: 93 },
  qilby: { power: 96, aura: 96 },
  jula: { power: 91, aura: 92 },
  "lex-luthor": { power: 96, aura: 97 },
  brainiac: { power: 99, aura: 96 },
  velskud: { power: 96, aura: 96 },
  crucia: { power: 98, aura: 96 },
  abhuva: { power: 90, aura: 88 },

  // ——— Vague MMO de fin octobre 2026 (dernière) ———
  "witch-king": { power: 98, aura: 99 },
  "tom-bombadil": { power: 100, aura: 96 },
  xizor: { power: 88, aura: 93 },
  "dark-falz-pso": { power: 98, aura: 96 },
  surt: { power: 96, aura: 96 },
  yura: { power: 92, aura: 94 },
  "sage-de-licorne": { power: 86, aura: 89 },
  shilen: { power: 100, aura: 98 },
  antares: { power: 91, aura: 90 },
  ulysse: { power: 86, aura: 91 },
  reto: { power: 71, aura: 78 },
  "pan-gu": { power: 100, aura: 99 },

  // ——— Horreur (octobre 2026) ———
  "james-sunderland": { power: 73, aura: 82 },
  xenomorphe: { power: 98, aura: 98 },
  "amanda-ripley": { power: 88, aura: 92 },
  "sebastian-castellanos": { power: 86, aura: 89 },
  "the-keeper": { power: 92, aura: 91 },

  // ——— Horreur (octobre 2026, suite) ———
  trager: { power: 85, aura: 90 },
  regenerateur: { power: 94, aura: 91 },
  springtrap: { power: 96, aura: 97 },
  wendigo: { power: 92, aura: 89 },
  peintre: { power: 86, aura: 86 },
  "femme-cheveux-denoues": { power: 86, aura: 87 },
  demon: { power: 86, aura: 85 },
  "ghost-face": { power: 88, aura: 92 },
  "simon-jarrett": { power: 71, aura: 82 },
  passant: { power: 78, aura: 84 },

  // ——— Horreur (octobre 2026, troisième vague) ———
  mercer: { power: 86, aura: 91 },
  bete: { power: 97, aura: 96 },
  "demon-morsure": { power: 89, aura: 92 },
  pilote: { power: 72, aura: 84 },
  "james-earl-cash": { power: 86, aura: 86 },
  monika: { power: 96, aura: 98 },
  chasseuse: { power: 91, aura: 89 },
  kusabi: { power: 90, aura: 93 },
  "leviatan-faucheur": { power: 95, aura: 94 },
  elster: { power: 86, aura: 86 },

  // ——— Ori (octobre 2026) ———
  kuro: { power: 92, aura: 93 },
  shriek: { power: 96, aura: 96 },

  // ——— Elden Ring, Bloodborne, Cyberpunk 2077 (octobre 2026) ———
  tarnished: { power: 94, aura: 95 },
  ranni: { power: 97, aura: 98 },
  "hunter-bloodborne": { power: 96, aura: 96 },
  v: { power: 92, aura: 94 },

  // ——— Skyrim, Fallout, Mass Effect, Borderlands (octobre 2026) ———
  lydia: { power: 52, aura: 48 },
  maiq: { power: 35, aura: 40 },
  dogmeat: { power: 62, aura: 68 },
  "vendeur-vault-tec": { power: 25, aura: 38 },
  "conrad-verner": { power: 28, aura: 35 },
  claptrap: { power: 58, aura: 65 },
  "face-mcshooty": { power: 15, aura: 30 },
  "jackie-welles": { power: 68, aura: 70 },
  "johnny-sasaki": { power: 32, aura: 25 },
  villageois: { power: 10, aura: 35 },

  // ——— Seconds rôles et indés (octobre 2026) ———
  louis: { power: 50, aura: 55 },
  spy: { power: 72, aura: 80 },
  heavy: { power: 82, aura: 75 },
  "m-qi": { power: 60, aura: 78 },
  cornifer: { power: 30, aura: 45 },
  hypnos: { power: 18, aura: 50 },
  diable: { power: 91, aura: 95 },
  prisonnier: { power: 75, aura: 72 },
  "zombie-cone": { power: 22, aura: 28 },
  zero: { power: 90, aura: 93 },
  oie: { power: 65, aura: 85 },

  // ——— Indés délirants (octobre 2026) ———
  jacket: { power: 88, aura: 90 },
  wilson: { power: 65, aura: 70 },
  tournesol: { power: 12, aura: 45 },
  imposteur: { power: 70, aura: 75 },
  "fall-guy": { power: 30, aura: 50 },
  pilgor: { power: 75, aura: 82 },
  "shovel-knight": { power: 76, aura: 78 },
  "meat-boy": { power: 72, aura: 70 },
  "petit-garcon": { power: 20, aura: 60 },
  inspecteur: { power: 18, aura: 55 },

  // ——— Récits et curiosités (octobre 2026) ———
  harry: { power: 84, aura: 96 },
  andreas: { power: 65, aura: 78 },
  explorateur: { power: 70, aura: 85 },
  prince: { power: 60, aura: 75 },
  croise: { power: 78, aura: 82 },
  biker: { power: 85, aura: 88 },
  jorji: { power: 22, aura: 68 },
  beatrix: { power: 45, aura: 70 },
  jardinier: { power: 35, aura: 40 },
  baroness: { power: 86, aura: 84 },
  marchand: { power: 15, aura: 25 },
  rodeur: { power: 58, aura: 62 },

  // ——— Conduite et stratégie (octobre 2026) ———
  "tanner": { power: 72, aura: 74 },
  "thrawn": { power: 94, aura: 96 },
  "napoleon": { power: 92, aura: 98 },
  "cesar": { power: 88, aura: 90 },
  "duc-de-paille": { power: 70, aura: 75 },
};

/**
 * Coefficient interne de chaque carte, entre 0 et 1.
 *
 * 0 = bas de la fourchette de sa rareté, 1 = sommet. C'est le seul curseur à
 * toucher pour faire monter ou descendre un personnage dans sa rareté.
 */
export const CARD_COEFFICIENTS: Record<string, number> = {
  // ——— Commun ———
  atreus: 0.75,
  luigi: 0.88,
  yoshi: 0.8,
  gruntilda: 0.55,
  mumbo: 0.42,
  ripto: 0.3,
  hunter: 0.45,
  solaire: 0.62,
  chell: 0.7,
  wheatley: 0.46,
  steve: 0.85,
  creeper: 0.5,
  yennefer: 0.68,
  cortex: 0.52,
  papyrus: 0.72,
  flowey: 0.58,
  mercy: 0.74,
  "king-dedede": 0.6,
  pikachu: 0.95,
  cuphead: 0.78,
  inkling: 0.66,

  // ——— Rare ———
  freya: 0.72,
  eggman: 0.84,
  shadow: 0.9,
  knuckles: 0.76,
  tifa: 0.88,
  hornet: 0.8,
  arbiter: 0.78,
  ciri: 0.82,
  crash: 0.8,
  ridley: 0.85,
  simon: 0.74,
  tracer: 0.7,
  reaper: 0.72,
  leon: 0.68,
  "chun-li": 0.65,
  "meta-knight": 0.62,
  gordon: 0.66,
  "king-dice": 0.32,
  madeline: 0.56,
  "2b": 0.9,

  // ——— Épique ———
  baldur: 0.8,
  bowser: 0.88,
  peach: 0.72,
  "banjo-kazooie": 0.6,
  zelda: 0.85,
  majora: 0.78,
  aerith: 0.82,
  artorias: 0.75,
  "le-chevalier": 0.6,
  cortana: 0.7,
  alucard: 0.85,
  sora: 0.8,
  vergil: 0.92,
  nemesis: 0.7,
  ryu: 0.78,
  bison: 0.65,
  "g-man": 0.55,

  // ——— Légendaire ———
  kratos: 0.96,
  mario: 0.99,
  spyro: 0.85,
  link: 0.95,
  sonic: 0.9,
  cloud: 0.92,
  gwyn: 0.8,
  grimm: 0.7,
  "master-chief": 0.88,
  "doom-slayer": 0.86,
  geralt: 0.82,
  samus: 0.84,
  sans: 0.74,
  radahn: 0.9,
  xehanort: 0.66,
  dante: 0.87,
  charizard: 0.89,
  joker: 0.79,

  // ——— Mythique ———
  ganondorf: 0.9,
  sephiroth: 0.97,
  "ender-dragon": 0.7,
  dracula: 0.88,
  malenia: 0.92,
  kirby: 0.96,
  mewtwo: 0.93,

  // ——— Personnages importés de Retrogems (octobre 2026) ———
  "carl-johnson": 0.92,
  "catnap": 0.78,
  "niko-bellic": 0.86,
  "tommy-vercetti": 0.86,
  "franklin-clinton": 0.86,
  "isabella-torrisi": 0.89,
  "tidus": 0.86,
  "victor-gideon": 0.88,
  "prototype-experience-1006": 0.88,
  "grace-ashcroft": 0.88,
  "enzo-favani": 0.88,
  "huggy-wuggy": 0.86,
  "gustave": 0.87,
  "mommy-long-legs": 0.78,
  "luca-trapani": 0.87,
  "jimmy-de-santa": 0.87,
  "melvin-harris": 0.86,
  "auron": 0.86,
  "barret-wallace": 0.78,
  "roman-bellic": 0.86,
  "lucia-caminos": 0.86,
  "jason-duval": 0.85,
  "boobie-ike": 0.85,
  "renoir": 0.85,
  "kissy-missy": 0.78,
  "fox-mccloud": 0.92,
  "emily": 0.84,
  "michael-de-santa": 0.86,
  "kliff-macduff": 0.84,
  "nightmare": 0.86,
  "damiane": 0.84,
  "yarnaby": 0.83,
  "astaroth": 0.78,
  "voldo": 0.78,
  "rufus-shinra": 0.78,
  "chris-redfield": 0.86,
  "raul-bautista": 0.82,
  "poppy-ludwig": 0.78,
  "trevor-philips": 0.86,
  "miss-delight": 0.82,
  "reno": 0.78,
  "heishiro-mitsurugi": 0.81,
  "jessie-rasberry": 0.81,
  "boxy-boo": 0.81,
  "yuna": 0.86,
  "claire-redfield": 0.86,
  "yuffie-kisaragi": 0.78,
  "siegfried-schtauffen": 0.8,
  "cait-sith": 0.8,
  "max-caulfield": 0.78,
  "ricardo-diaz": 0.79,
  "jenova": 0.79,
  "bunzo-bunny": 0.79,
  "seymour-guado": 0.78,
  "jill-valentine": 0.92,
  "oongka": 0.78,
  "seong-mi-na": 0.78,
  "sophie": 0.77,
  "maelle": 0.77,
  "little-jacob": 0.76,
  "lance-vance": 0.76,
  "revali": 0.78,
  "dave-norton": 0.76,
  "ken-rosenberg": 0.75,
  "zeno": 0.75,
  "chloe-price": 0.78,
  "mother-brain": 0.78,
  "doey-the-doughman": 0.75,
  "zack-fair": 0.78,
  "solid-snake": 0.92,
  "beate": 0.74,
  "elena": 0.74,
  "valentin-voda": 0.74,
  "lance-wilson": 0.74,
  "josee-anjou": 0.73,
  "nathan-prescott": 0.73,
  "cid-highwind": 0.73,
  "wakka": 0.78,
  "sonny-forelli": 0.73,
  "kweena-quen": 0.72,
  "terra-branford": 0.78,
  "ada-wong": 0.86,
  "lulu": 0.78,
  "falco-lombardi": 0.72,
  "lune": 0.71,
  "alyssa-ashcroft": 0.71,
  "vincent-valentine": 0.78,
  "jeffrey-cross": 0.71,
  "myles-mackenzie": 0.71,
  "kuja": 0.86,
  "kimahri-ronso": 0.78,
  "krystal": 0.7,
  "dre-quan-priest": 0.7,
  "kilik": 0.78,
  "sergent-duke": 0.69,
  "micah-bell": 0.78,
  "biggs": 0.69,
  "tseng": 0.69,
  "ryo-hazuki": 0.78,
  "sean-diaz": 0.68,
  "kent-paul": 0.68,
  "wedge": 0.68,
  "jecht": 0.78,
  "hunk": 0.67,
  "red-xiii": 0.78,
  "piers-nivans": 0.67,
  "rude": 0.67,
  "shenhua-ling": 0.67,
  "braska": 0.66,
  "duke-nukem": 0.78,
  "playboy-x": 0.66,
  "lavinia-voda": 0.66,
  "the-paintress": 0.66,
  "claude": 0.66,
  "belgemine": 0.65,
  "jimmy-pegorino": 0.65,
  "maitre-mika": 0.65,
  "steiner-adelbert": 0.78,
  "mark-jefferson": 0.65,
  "big-boss": 0.86,
  "dimitri-rascalov": 0.64,
  "mog": 0.64,
  "nozomi-harasaki": 0.64,
  "tanisha-jackson": 0.64,
  "freyja-crescent": 0.63,
  "ethan-winters": 0.63,
  "revolver-ocelot": 0.78,
  "holly-asturias": 0.63,
  "wen-kinoc": 0.62,
  "mipha": 0.78,
  "8-ball": 0.62,
  "kraid": 0.78,
  "eiko-carol": 0.78,
  "locke-cole": 0.78,
  "lester-crest": 0.61,
  "slippy-toad": 0.61,
  "verso": 0.61,
  "darko-brevic": 0.61,
  "cal-hampton": 0.61,
  "mineru": 0.6,
  "tarask-coral": 0.6,
  "celes-chere": 0.78,
  "professeur-hojo": 0.6,
  "otacon": 0.78,
  "amanda-de-santa": 0.59,
  "peppy-hare": 0.59,
  "sciel": 0.59,
  "tokabi": 0.59,
  "bandana-waddle-dee": 0.58,
  "billy-coen": 0.58,
  "ivy-valentine": 0.58,
  "tracy-de-santa": 0.58,
  "juzo-mido": 0.58,
  "kefka-palazzo": 0.86,
  "sylux": 0.57,
  "safiya-llewellyn-fayyad": 0.57,
  "rikku": 0.78,
  "monoco": 0.57,
  "yoshimitsu": 0.78,
  "the-player": 0.56,
  "josha": 0.56,
  "ultros": 0.78,
  "armstrong": 0.56,
  "djidane-tribal": 0.78,
  "louis-amamiya": 0.55,
  "helena-harper": 0.55,
  "lou-magmell": 0.55,
  "grenat-til-alexandros-xvii": 0.78,
  "daniel-diaz": 0.54,
  "sean-johnson": 0.54,
  "teba": 0.54,
  "floyd-hebert": 0.54,
  "meve-de-lyria": 0.54,
  "issun": 0.53,
  "john-marston": 0.86,
  "gary-smith": 0.78,
  "sidon": 0.78,
  "bibi-orunitia": 0.78,
  "alexandra-chen": 0.53,
  "myurdin": 0.52,
  "steve-haines": 0.52,
  "riju": 0.78,
  "setzer-gabbiani": 0.78,
  "joy": 0.52,
  "denise-clinton": 0.51,
  "dr-proton": 0.51,
  "jaskier": 0.51,
  "jack-marston": 0.51,
  "peter-kowalski": 0.51,
  "rauru": 0.5,
  "split-horn": 0.5,
  "wei-cheng": 0.5,
  "jerrin": 0.5,
  "catalina": 0.49,
  "cycloid-empero": 0.49,
  "eredin-breacc-glas": 0.49,
  "ray-bulgarin": 0.49,
  "arthur-morgan": 0.92,
  "johnny-vincent": 0.49,
  "sir-jyscal-guado": 0.48,
  "sonia": 0.48,
  "naira": 0.48,
  "frank-tenpenny": 0.48,
  "stretch": 0.48,
  "mazli": 0.47,
  "frank": 0.47,
  "miguel": 0.47,
  "strago-magus": 0.47,
  "iwao-hazuki": 0.47,
  "sophitia-alexandra": 0.78,
  "chef": 0.46,
  "imlerith": 0.46,
  "mikhail-faustin": 0.46,
  "bill-williamson": 0.46,
  "lefty-mancini": 0.45,
  "purah": 0.45,
  "damon-merrick": 0.45,
  "cesar-vialpando": 0.45,
  "raiden": 0.78,
  "lamar-davis": 0.45,
  "markus": 0.44,
  "relm-arrowny": 0.44,
  "xiuying-hong": 0.44,
  "taki": 0.78,
  "solomon-richards": 0.44,
  "caranthir-ar-feiniel": 0.43,
  "vladimir-glebov": 0.43,
  "lyle-mcleish": 0.43,
  "dutch-van-der-linde": 0.86,
  "lola-lombardi": 0.43,
  "kelk-ronso": 0.42,
  "impa": 0.78,
  "hank-stamper": 0.42,
  "carlos-oliveira": 0.42,
  "gray-fox": 0.78,
  "cid-fabul-ix": 0.41,
  "mallorie-bardas": 0.41,
  "luigi-goterelli": 0.41,
  "guizhang-chen": 0.41,
  "raphael-sorel": 0.4,
  "letho-de-guleta": 0.4,
  "zenon-gryfgote": 0.4,
  "nathan-dempsy": 0.4,
  "javier-escuella": 0.4,
  "derby-harrington": 0.4,
  "lisbeth-fischer": 0.39,
  "rebecca-chambers": 0.39,
  "urbosa": 0.78,
  "patrick-mcreary": 0.39,
  "joey-leone": 0.39,
  "gogo": 0.38,
  "chai": 0.38,
  "jacques-de-aldersberg": 0.38,
  "noah-g-magmell": 0.38,
  "edgar-ross": 0.38,
  "zaon": 0.37,
  "yunobo": 0.37,
  "dr-harley-sawyer": 0.37,
  "jedediah-lucan": 0.37,
  "edgar-roni-figaro": 0.78,
  "daruk": 0.78,
  "brucie-kibbutz": 0.36,
  "bubsy-bobcat": 0.36,
  "chai-xianghua": 0.78,
  "marx": 0.36,
  "azar-javed": 0.35,
  "iris-magmell": 0.35,
  "juan-garcia-cortez": 0.35,
  "agustin-allende": 0.35,
  "ted-thompson": 0.35,
  "robbie": 0.34,
  "branet-raza-alexandros-xvi": 0.34,
  "sabin-rene-figaro": 0.78,
  "sheva-alomar": 0.34,
  "corrado-bastoni": 0.34,
  "tatl": 0.33,
  "dwayne-forge": 0.33,
  "cruz-silva": 0.33,
  "gestahl": 0.33,
  "dona": 0.32,
  "terry-bobcat": 0.32,
  "magolor": 0.32,
  "rachel-amber": 0.32,
  "jadwiga": 0.32,
  "avery-carrington": 0.32,
  "pj-pug-a-pillar": 0.31,
  "yasmin-fayyad": 0.31,
  "shadow-2": 0.31,
  "jake-muller": 0.31,
  "maxi": 0.3,
  "ron-jakowski": 0.3,
  "skull-kid": 0.3,
  "karen-daniels": 0.3,
  "gregorio-silva": 0.3,
  "terri-bobcat": 0.29,
  "natsu": 0.29,
  "midna": 0.29,
  "sherry-birkin": 0.29,
  "brian-heder": 0.29,
  "paya": 0.28,
  "garland": 0.28,
  "lucas-colmenero": 0.28,
  "cyan-garamonde": 0.28,
  "longsun-zhao": 0.28,
  "wade-hebert": 0.27,
  "vaati": 0.27,
  "triss-merigold-de-maribor": 0.27,
  "bernie-crane": 0.27,
  "curator": 0.27,
  "oinker-p-hamm": 0.26,
  "james-hopkins": 0.26,
  "vue-995": 0.26,
  "tulin": 0.26,
  "devin-weston": 0.26,
  "necron": 0.25,
  "ryan-lucan": 0.25,
  "gau": 0.25,

  // ——— MMO (octobre 2026) ———
  // Arthas, Emet-Selch, Goultard et Aurene portent les hauts faits ; les
  // seconds rôles restent dans le bas de leur rareté.
  arthas: 0.94,
  "emet-selch": 0.9,
  aurene: 0.88,
  goultard: 0.86,
  illidan: 0.82,
  sylvanas: 0.76,
  yshtola: 0.74,
  "dark-vlad": 0.72,
  rytlock: 0.7,
  nox: 0.68,
  thrall: 0.62,
  jaina: 0.6,
  alisaie: 0.56,
  alphinaud: 0.55,
  caithe: 0.52,
  kerubim: 0.5,
  "joris-jurgen": 0.48,
  "logan-thackeray": 0.46,
  anduin: 0.42,
  estinien: 0.4,
  urianger: 0.36,
  zojja: 0.34,
  dathura: 0.28,
  trahearne: 0.26,

  // ——— Compléments MMO (octobre 2026) : la valeur affichée vient de
  // `CARD_STATS`, le coefficient sert de repli cohérent.
  "tirion-fordring": 0.8,
  garrosh: 0.75,
  venat: 0.9,
  haurchefant: 0.7,
  zenos: 0.85,
  aymeric: 0.6,
  "graha-tia": 0.65,
  arpagone: 0.55,
  rushu: 0.95,
  "palawa-joko": 0.8,
  "king-black-dragon": 0.65,
  zamorak: 0.8,
  zaros: 0.95,
  "wise-old-man": 0.5,
  mannimarco: 0.75,
  cadwell: 0.45,
  kadan: 0.85,
  brelshaza: 0.8,
  malgus: 0.8,
  "satele-shan": 0.7,

  // ——— Vague MMO de fin octobre 2026 ———
  kerafyrm: 1,
  conan: 0.95,
  "black-mage": 0.95,
  antharas: 0.9,
  ferumbras: 0.9,
  "valkyrie-randgris": 0.85,
  tiamat: 0.8,
  illezra: 0.8,
  "jin-soyeon": 0.75,
  "dark-falz-persona": 0.75,
  "black-spirit": 0.7,
  statesman: 0.7,
  "firiona-vie": 0.85,
  baium: 0.9,
  "lord-recluse": 0.95,
  marchutan: 0.8,
  "hong-seokkeun": 0.8,
  baphomet: 0.65,
  "kirsten-geary": 0.6,
  zakum: 0.55,
  avatus: 0.7,
  "elion-dulas": 0.3,
  "artemis-zin": 0.3,
  "jack-boone": 0.2,

  // ——— Vague MMO de fin octobre 2026 (suite) ———
  clockworks: 0.9,
  morgana: 0.9,
  yugo: 0.7,
  jula: 0.6,
  abhuva: 0.4,
  maflon: 0.7,
  tcharzanek: 0.9,
  malekith: 0.95,
  "arthur-corrompu": 0.85,
  kundun: 0.9,
  qilby: 0.75,
  "lex-luthor": 0.8,
  brainiac: 0.95,
  velskud: 0.75,
  crucia: 0.9,

  // ——— Vague MMO de fin octobre 2026 (dernière) ———
  "tom-bombadil": 1,
  "pan-gu": 1,
  shilen: 1,
  "dark-falz-pso": 0.9,
  "witch-king": 0.85,
  surt: 0.8,
  xizor: 0.7,
  yura: 0.65,
  "sage-de-licorne": 0.5,
  antares: 0.5,
  ulysse: 0.1,
  reto: 0.5,

  // ——— Horreur (octobre 2026) ———
  xenomorphe: 1,
  "the-keeper": 0.7,
  "amanda-ripley": 0.6,
  "james-sunderland": 0.4,
  "sebastian-castellanos": 0.3,

  // ——— Horreur (octobre 2026, suite) ———
  regenerateur: 0.9,
  springtrap: 0.8,
  wendigo: 0.7,
  passant: 0.7,
  "ghost-face": 0.6,
  "simon-jarrett": 0.3,
  trager: 0.2,
  demon: 0.2,
  "femme-cheveux-denoues": 0.15,
  peintre: 0.1,

  // ——— Horreur (octobre 2026, troisième vague) ———
  "leviatan-faucheur": 0.9,
  bete: 0.85,
  monika: 0.8,
  kusabi: 0.6,
  chasseuse: 0.5,
  "demon-morsure": 0.5,
  pilote: 0.2,
  mercer: 0.1,
  "james-earl-cash": 0.1,
  elster: 0.1,

  // ——— Ori (octobre 2026) ———
  shriek: 0.9,
  kuro: 0.8,

  // ——— Elden Ring, Bloodborne, Cyberpunk 2077 (octobre 2026) ———
  tarnished: 0.9,
  ranni: 0.85,
  "hunter-bloodborne": 0.7,
  v: 0.6,

  // ——— Skyrim, Fallout, Mass Effect, Borderlands (octobre 2026) ———
  lydia: 0.8,
  maiq: 0.9,
  dogmeat: 0.7,
  "vendeur-vault-tec": 0.7,
  "conrad-verner": 0.8,
  claptrap: 0.5,
  "face-mcshooty": 0.6,
  "jackie-welles": 0.9,
  "johnny-sasaki": 0.7,
  villageois: 0.4,

  // ——— Seconds rôles et indés (octobre 2026) ———
  louis: 0.6,
  spy: 0.7,
  heavy: 0.75,
  "m-qi": 0.85,
  cornifer: 0.6,
  hypnos: 0.7,
  diable: 0.95,
  prisonnier: 0.65,
  "zombie-cone": 0.4,
  zero: 0.9,
  oie: 0.9,

  // ——— Indés délirants (octobre 2026) ———
  jacket: 0.85,
  wilson: 0.7,
  tournesol: 0.4,
  imposteur: 0.85,
  "fall-guy": 0.5,
  pilgor: 0.9,
  "shovel-knight": 0.7,
  "meat-boy": 0.6,
  "petit-garcon": 0.6,
  inspecteur: 0.5,

  // ——— Récits et curiosités (octobre 2026) ———
  harry: 0.95,
  andreas: 0.7,
  explorateur: 0.8,
  prince: 0.7,
  croise: 0.8,
  biker: 0.85,
  jorji: 0.5,
  beatrix: 0.6,
  jardinier: 0.5,
  baroness: 0.75,
  marchand: 0.4,
  rodeur: 0.5,

  // ——— Conduite et stratégie (octobre 2026) ———
  "tanner": 0.6,
  "thrawn": 0.9,
  "napoleon": 0.9,
  "cesar": 0.5,
  "duc-de-paille": 0.5,
};

/** Coefficient d'une carte, borné entre 0 et 1. */
export function coefficientOf(card: Card): number {
  const value = CARD_COEFFICIENTS[card.id] ?? 0.5;
  return Math.min(1, Math.max(0, value));
}

/** Valeur d'une statistique pour un coefficient donné, arrondie à l'unité. */
export function statValue(band: StatBand, coefficient: number): number {
  const clamped = Math.min(1, Math.max(0, coefficient));
  return Math.round(band.min + band.spread * clamped);
}

export type QualityGradeKey = "standard" | "solide" | "brillante" | "prestige" | "relique";

export type QualityGrade = {
  key: QualityGradeKey;
  label: string;
  /** Seuil bas de la note, incluse. */
  min: number;
  /** Classes Tailwind du badge. */
  tone: string;
};

/** Paliers de qualité, du plus courant au plus rare. */
export const QUALITY_GRADES: QualityGrade[] = [
  { key: "standard", label: "Standard", min: 0, tone: "bg-white/10 text-white/70" },
  { key: "solide", label: "Solide", min: 35, tone: "bg-sky-400/15 text-sky-200" },
  { key: "brillante", label: "Brillante", min: 50, tone: "bg-violet-400/15 text-violet-200" },
  { key: "prestige", label: "Prestige", min: 65, tone: "bg-amber-300/15 text-amber-200" },
  { key: "relique", label: "Relique", min: 80, tone: "bg-fuchsia-400/20 text-fuchsia-200" },
];

export function qualityGrade(quality: number): QualityGrade {
  let current = QUALITY_GRADES[0];
  for (const grade of QUALITY_GRADES) {
    if (quality >= grade.min) current = grade;
  }
  return current;
}

export type CardStats = {
  power: number;
  aura: number;
  /** Indice 0–100 : 60 % puissance, 40 % aura. */
  quality: number;
  grade: QualityGrade;
};

/** Ramène une valeur dans la fourchette d'une statistique. */
function clampToBand(band: StatBand, value: number): number {
  return Math.round(Math.min(band.min + band.spread, Math.max(band.min, value)));
}

/** Puissance, aura et qualité d'une carte. */
export function cardStats(card: Card): CardStats {
  const bands = STAT_BANDS[card.rarity];
  const coefficient = coefficientOf(card);
  const explicit = CARD_STATS[card.id];

  const power = explicit ? clampToBand(bands.power, explicit.power) : statValue(bands.power, coefficient);
  const aura = explicit ? clampToBand(bands.aura, explicit.aura) : statValue(bands.aura, coefficient);
  const quality = Math.min(100, Math.max(0, Math.round(power * 0.6 + aura * 0.4)));

  return { power, aura, quality, grade: qualityGrade(quality) };
}

/**
 * Score de duel provisoire d'une carte : la puissance pèse plus que l'aura.
 * Aucun mode de combat ne l'utilise encore, mais il est figé ici pour que le
 * futur gameplay n'ait pas à réinventer la formule.
 */
export function duelScore(stats: CardStats): number {
  return Math.round(stats.power * 0.7 + stats.aura * 0.3);
}

export type CollectionScore = {
  /** Cartes uniques prises en compte. */
  unique: number;
  power: number;
  aura: number;
  /** Somme des qualités : le score de collection affiché et classé. */
  quality: number;
  duel: number;
};

/**
 * Agrège une collection (cartes uniques) en score global.
 * Les doublons ne comptent pas : posséder deux fois la même carte n'ajoute
 * rien à la valeur de la collection.
 */
export function collectionScore(cards: Card[]): CollectionScore {
  const score: CollectionScore = { unique: cards.length, power: 0, aura: 0, quality: 0, duel: 0 };

  for (const card of cards) {
    const stats = cardStats(card);
    score.power += stats.power;
    score.aura += stats.aura;
    score.quality += stats.quality;
    score.duel += duelScore(stats);
  }

  return score;
}
