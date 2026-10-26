/**
 * Récupère les visuels de personnages et écrit src/data/portraits.json.
 *
 * Deux sources, dans cet ordre :
 *   1. Wikipédia (anglophone) — article dédié, pour 64 cartes ;
 *   2. Fandom — wiki de la franchise, pour les personnages qui n'ont pas d'article
 *      Wikipédia avec visuel (Ripto, Gruntilda, Artorias…).
 *
 * Les images NE SONT PAS téléchargées : on ne stocke que l'URL distante et les crédits.
 * Les deux sources sont majoritairement en « fair use » : voir la note légale du README.
 *
 * La correspondance carte → page est volontairement explicite : la recherche
 * automatique ramenait des pages hors sujet (Baldur → Baldur's Gate, etc.).
 *
 * Usage : npm run portraits
 */

import fs from "node:fs/promises";
import path from "node:path";
import { CARDS } from "../src/lib/cards";

const USER_AGENT = "TCVG-fan-project/1.0 (projet de collection de cartes, usage personnel)";
// 500 px : la carte la plus grande affiche l'artwork sur ~380 px de large, donc
// au-delà on ne paie que des octets. Wikipédia n'accepte d'ailleurs que des
// tailles de vignette normalisées (250, 500, 960…) depuis 2025.
const THUMB_SIZE = 500;
const OUTPUT = path.join(process.cwd(), "src", "data", "portraits.json");
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";

/** Carte → article Wikipédia portant le visuel du personnage. */
const WIKI_TITLES: Record<string, string> = {
  kratos: "Kratos (God of War)",
  mario: "Mario",
  luigi: "Luigi (character)",
  bowser: "Bowser",
  peach: "Princess Peach",
  yoshi: "Yoshi",
  "banjo-kazooie": "Banjo & Kazooie",
  spyro: "Spyro (character)",
  zelda: "Princess Zelda",
  ganondorf: "Ganondorf",
  shadow: "Shadow the Hedgehog",
  cloud: "Cloud Strife",
  sephiroth: "Sephiroth (Final Fantasy)",
  aerith: "Aerith Gainsborough",
  tifa: "Tifa Lockhart",
  solaire: "Solaire of Astora",
  hornet: "Hornet (Hollow Knight)",
  chell: "Chell (Portal)",
  wheatley: "Wheatley (Portal)",
  "master-chief": "Master Chief (Halo)",
  cortana: "Cortana (Halo)",
  arbiter: "Arbiter (Halo)",
  steve: "Steve (Minecraft)",
  creeper: "Creeper (Minecraft)",
  "doom-slayer": "Doomguy",
  geralt: "Geralt of Rivia",
  crash: "Crash Bandicoot (character)",
  cortex: "Doctor Neo Cortex",
  samus: "Samus Aran",
  ridley: "Ridley (Metroid)",
  alucard: "Alucard (Castlevania)",
  dracula: "Dracula (Castlevania)",
  simon: "Simon Belmont",
  sans: "Sans (Undertale)",
  papyrus: "Papyrus (Undertale)",
  flowey: "Flowey",
  malenia: "Malenia",
  radahn: "Starscourge Radahn",
  reaper: "Reaper (Overwatch)",
  mercy: "Mercy (Overwatch)",
  sora: "Sora (Kingdom Hearts)",
  dante: "Dante (Devil May Cry)",
  vergil: "Vergil (Devil May Cry)",
  nemesis: "Nemesis (Resident Evil)",
  ryu: "Ryu (Street Fighter)",
  bison: "M. Bison",
  kirby: "Kirby (character)",
  "meta-knight": "Meta Knight",
  pikachu: "Pikachu",
  mewtwo: "Mewtwo",
  charizard: "Charizard",
  gordon: "Gordon Freeman",
  cuphead: "Cuphead (character)",
  "king-dice": "King Dice",
  madeline: "Madeline (Celeste)",
  joker: "Joker (Persona 5)",
  "2b": "2B (Nier: Automata)",
  // Pas de wiki Fandom vivant pour Slender : l'article Wikipédia porte le
  // montage qui a popularisé le personnage.
  "slender-man": "Slender Man",
  napoleon: "Napoleon",
  cesar: "Julius Caesar",
};

/**
 * Carte → page du wiki de la franchise, pour les personnages absents de
 * Wikipédia. `prefix` sert aux wikis localisés (`/fr`), dont les titres
 * diffèrent : « Frank » est le nom français de Blank dans FF IX.
 */
const FANDOM_TITLES: Record<string, { wiki: string; title: string; prefix?: string }> = {
  // Ces personnages ont un article Wikipédia, mais son image d'illustration
  // n'est pas le personnage : logo de la franchise (Sonic), boîte du jeu
  // (Le Chevalier), planche de tous les designs (Link, Knuckles), ou décor
  // vide. Le wiki de la franchise, lui, expose un rendu du personnage.
  sonic: { wiki: "sonic.fandom.com", title: "Sonic the Hedgehog" },
  eggman: { wiki: "sonic.fandom.com", title: "Doctor Eggman" },
  knuckles: { wiki: "sonic.fandom.com", title: "Knuckles the Echidna" },
  link: { wiki: "zelda.fandom.com", title: "Link" },
  "le-chevalier": { wiki: "hollowknight.fandom.com", title: "The Knight" },
  xehanort: { wiki: "kingdomhearts.fandom.com", title: "Master Xehanort" },
  atreus: { wiki: "godofwar.fandom.com", title: "Atreus" },
  baldur: { wiki: "godofwar.fandom.com", title: "Baldur" },
  freya: { wiki: "godofwar.fandom.com", title: "Freya" },
  gruntilda: { wiki: "banjokazooie.fandom.com", title: "Gruntilda" },
  mumbo: { wiki: "banjokazooie.fandom.com", title: "Mumbo Jumbo" },
  ripto: { wiki: "spyro.fandom.com", title: "Ripto" },
  hunter: { wiki: "spyro.fandom.com", title: "Hunter" },
  majora: { wiki: "zelda.fandom.com", title: "Majora" },
  artorias: { wiki: "darksouls.fandom.com", title: "Artorias" },
  gwyn: { wiki: "darksouls.fandom.com", title: "Gwyn" },
  "ender-dragon": { wiki: "minecraft.fandom.com", title: "Ender Dragon" },
  ciri: { wiki: "witcher.fandom.com", title: "Ciri" },
  yennefer: { wiki: "witcher.fandom.com", title: "Yennefer" },
  tracer: { wiki: "overwatch.fandom.com", title: "Tracer" },
  leon: { wiki: "residentevil.fandom.com", title: "Leon S. Kennedy" },
  "chun-li": { wiki: "streetfighter.fandom.com", title: "Chun-Li" },
  "king-dedede": { wiki: "kirby.fandom.com", title: "King Dedede" },
  "g-man": { wiki: "half-life.fandom.com", title: "G-Man" },
  inkling: { wiki: "splatoon.fandom.com", title: "Inkling" },

  // ——— Code Vein II (2026) : le wiki dédié porte les rendus officiels ———
  "lou-magmell": { wiki: "code-vein-ii.fandom.com", title: "Lou MagMell" },
  "valentin-voda": { wiki: "code-vein-ii.fandom.com", title: "Valentin Voda" },
  "noah-g-magmell": { wiki: "code-vein-ii.fandom.com", title: "Noah G. MagMell" },
  "josee-anjou": { wiki: "code-vein-ii.fandom.com", title: "Josée Anjou" },
  "lyle-mcleish": { wiki: "code-vein-ii.fandom.com", title: "Lyle McLeish" },
  "holly-asturias": { wiki: "code-vein-ii.fandom.com", title: "Holly Asturias" },
  "zenon-gryfgote": { wiki: "code-vein-ii.fandom.com", title: "Zenon Gryfgote" },
  "lavinia-voda": { wiki: "code-vein-ii.fandom.com", title: "Lavinia Voda" },
  "iris-magmell": { wiki: "code-vein-ii.fandom.com", title: "Iris MagMell" },
  jadwiga: { wiki: "code-vein-ii.fandom.com", title: "Jadwiga" },

  // ——— Code Vein premier du nom ———
  "cruz-silva": { wiki: "codevein.fandom.com", title: "Cruz Silva" },
  "juzo-mido": { wiki: "codevein.fandom.com", title: "Juzo Mido" },

  // ——— Compléments ———
  // Le wiki Mafia vit sur mafiagame.fandom.com ; le héros s'appelle Enzo Favara.
  "enzo-favani": { wiki: "mafiagame.fandom.com", title: "Enzo Favara" },
  // La page « Jenova » expose l'artwork du film Advent Children.
  jenova: { wiki: "finalfantasy.fandom.com", title: "Jenova" },
  // Le wiki Final Fantasy a une page par épisode pour les Mogs.
  mog: { wiki: "finalfantasy.fandom.com", title: "Mog (Final Fantasy VI)" },
  "bandana-waddle-dee": { wiki: "kirby.fandom.com", title: "Bandana Waddle Dee" },
  // « Stretch » est aussi un véhicule : la page du personnage lève l'ambiguïté.
  stretch: { wiki: "gta.fandom.com", title: "Stretch (character)" },
  // Les jumeaux Bobcat partagent une seule page et un seul rendu.
  "terry-bobcat": { wiki: "bubsy.fandom.com", title: "Terry and Terri Bobcat" },
  "terri-bobcat": { wiki: "bubsy.fandom.com", title: "Terry and Terri Bobcat" },
  // La carte s'appelle « James Hopkins » mais le personnage est Jimmy Hopkins.
  "james-hopkins": { wiki: "bully.fandom.com", title: "Jimmy Hopkins" },
  // La page anglaise « Frank » n'existe pas : la recherche y renvoie le
  // comédien Jeff Schine. Le wiki français a la bonne page (Frank = Blank).
  frank: { wiki: "finalfantasy.fandom.com", title: "Frank", prefix: "/fr" },

  // ——— MMO (octobre 2026) ———
  // Le wiki Dofus ne propose que des sprites de 128 px agrandis : les
  // personnages de la série sont repris du wiki Wakfu (voir FANDOM_FILES).
  // « Joris Jurgen » y vit sous le titre « Joris », et Kerubim sous « Kerub
  // Crepin » (sans accents).
  "dark-vlad": { wiki: "dofuswiki.fandom.com", title: "Dark Vlad" },
  kerubim: { wiki: "dofuswiki.fandom.com", title: "Kerub Crepin" },

  // ——— Compléments MMO (octobre 2026) ———
  "tirion-fordring": { wiki: "warcraft.fandom.com", title: "Tirion Fordring" },
  garrosh: { wiki: "warcraft.fandom.com", title: "Garrosh Hellscream" },
  // La page « Venat » est celle de FF XII : le personnage de FF XIV a la sienne.
  venat: { wiki: "finalfantasy.fandom.com", title: "Venat (Final Fantasy XIV)" },
  haurchefant: { wiki: "finalfantasy.fandom.com", title: "Haurchefant Greystone" },
  zenos: { wiki: "finalfantasy.fandom.com", title: "Zenos yae Galvus" },
  aymeric: { wiki: "finalfantasy.fandom.com", title: "Aymeric de Borel" },
  "graha-tia": { wiki: "finalfantasy.fandom.com", title: "G'raha Tia" },
  // Arpagone n'a pas de page sur le wiki Dofus : elle vit sur celui de Wakfu.
  arpagone: { wiki: "wakfu.fandom.com", title: "Arpagone" },
  "king-black-dragon": { wiki: "runescape.fandom.com", title: "King Black Dragon" },
  zamorak: { wiki: "runescape.fandom.com", title: "Zamorak" },
  zaros: { wiki: "runescape.fandom.com", title: "Zaros" },
  "wise-old-man": { wiki: "runescape.fandom.com", title: "Wise Old Man" },
  mannimarco: { wiki: "elderscrolls.fandom.com", title: "Mannimarco" },
  cadwell: { wiki: "elderscrolls.fandom.com", title: "Cadwell" },
  kadan: { wiki: "lostark.fandom.com", title: "Kadan" },
  brelshaza: { wiki: "lostark.fandom.com", title: "Brelshaza" },
  malgus: { wiki: "starwars.fandom.com", title: "Darth Malgus" },
  "satele-shan": { wiki: "starwars.fandom.com", title: "Satele Shan" },

  // ——— Vague MMO de fin octobre 2026 ———
  // Certains wikis nomment le personnage autrement que la carte : « Randgris »
  // pour Valkyrie Randgris, « Jinsoyun » pour Jin Soyeon, « Hong Sokyun » pour
  // Maître Hong. Le wiki Phantasy Star renvoie « Dark Falz Persona » vers
  // « Persona ».
  antharas: { wiki: "lineage2.fandom.com", title: "Antharas" },
  zakum: { wiki: "maplestory.fandom.com", title: "Zakum" },
  tiamat: { wiki: "aion.fandom.com", title: "Tiamat" },
  marchutan: { wiki: "aion.fandom.com", title: "Marchutan" },
  "jin-soyeon": { wiki: "bladeandsoul.fandom.com", title: "Jinsoyun" },
  "hong-seokkeun": { wiki: "bladeandsoul.fandom.com", title: "Hong Sokyun" },
  "dark-falz-persona": { wiki: "phantasystar.fandom.com", title: "Dark Falz Persona" },
  conan: { wiki: "aoc.fandom.com", title: "Conan" },
  statesman: { wiki: "cityofheroes.fandom.com", title: "Statesman" },
  "lord-recluse": { wiki: "cityofheroes.fandom.com", title: "Lord Recluse" },
  ferumbras: { wiki: "tibia.fandom.com", title: "Ferumbras" },
  avatus: { wiki: "wildstar.fandom.com", title: "Avatus" },
  "artemis-zin": { wiki: "wildstar.fandom.com", title: "Artemis Zin" },

  // ——— Vague MMO de fin octobre 2026 (suite) ———
  // Warhammer Online n'a plus de wiki Fandom dédié : Tchar'zanek et Malekith
  // vivent sur le wiki Warhammer généraliste. J'Ula (STO) est documentée sur
  // Memory Beta, le wiki Star Trek des produits dérivés.
  clockworks: { wiki: "flyff.fandom.com", title: "Clockworks" },
  tcharzanek: { wiki: "warhammerfantasy.fandom.com", title: "Tchar'zanek" },
  malekith: { wiki: "warhammerfantasy.fandom.com", title: "Malekith" },
  yugo: { wiki: "wakfu.fandom.com", title: "Yugo" },
  qilby: { wiki: "wakfu.fandom.com", title: "Qilby" },
  jula: { wiki: "memory-beta.fandom.com", title: "J'Ula" },
  velskud: { wiki: "dragonnest.fandom.com", title: "Velskud" },
  abhuva: { wiki: "rappelz.fandom.com", title: "Abhuva" },

  // ——— Vague MMO de fin octobre 2026 (dernière) ———
  // Le wiki Phantasy Star a une page par épisode : celle de PSO classique est
  // « Dark Falz (Phantasy Star Online) ».
  "witch-king": { wiki: "lotr.fandom.com", title: "Witch-king of Angmar" },
  "tom-bombadil": { wiki: "lotr.fandom.com", title: "Tom Bombadil" },
  "dark-falz-pso": { wiki: "phantasystar.fandom.com", title: "Dark Falz (Phantasy Star Online)" },
  yura: { wiki: "bladeandsoul.fandom.com", title: "Yura" },
  shilen: { wiki: "lineage2.fandom.com", title: "Shilen" },
  lakan: { wiki: "tera.fandom.com", title: "Lakan" },

  // ——— Horreur (octobre 2026) ———
  // « Xenomorph » redirige vers « Xenomorph XX121 (Alien) » sur le wiki AVP.
  "james-sunderland": { wiki: "silenthill.fandom.com", title: "James Sunderland" },
  xenomorphe: { wiki: "avp.fandom.com", title: "Xenomorph" },
  "amanda-ripley": { wiki: "avp.fandom.com", title: "Amanda Ripley" },
  "sebastian-castellanos": { wiki: "theevilwithin.fandom.com", title: "Sebastian Castellanos" },
  "the-keeper": { wiki: "theevilwithin.fandom.com", title: "The Keeper" },

  // ——— Horreur (octobre 2026, suite) ———
  // Darkwood nomme son héros « Protagonist » ; Springtrap redirige vers
  // « William Afton », donc le rendu vient d'un fichier choisi à la main.
  wendigo: { wiki: "untildawn.fandom.com", title: "Wendigo" },
  peintre: { wiki: "layersoffear.fandom.com", title: "The Painter" },
  "simon-jarrett": { wiki: "soma.fandom.com", title: "Simon Jarrett" },
  passant: { wiki: "darkwood.fandom.com", title: "Protagonist" },

  // ——— Horreur (octobre 2026, troisième vague) ———
  // Le wiki Dead by Daylight nomme la Chasseuse « Anna » ; le wiki DDLC a un
  // tiret dans son domaine et sa page Monika est « Monika (DDLC) ».
  mercer: { wiki: "deadspace.fandom.com", title: "Challus Mercer" },
  bete: { wiki: "amnesia.fandom.com", title: "The Beast" },
  "james-earl-cash": { wiki: "manhunt.fandom.com", title: "James Earl Cash" },
  monika: { wiki: "doki-doki-literature-club.fandom.com", title: "Monika" },
  chasseuse: { wiki: "deadbydaylight.fandom.com", title: "The Huntress" },
  kusabi: { wiki: "fatalframe.fandom.com", title: "Kusabi" },
  "leviatan-faucheur": { wiki: "subnautica.fandom.com", title: "Reaper Leviathan" },

  // ——— Ori (octobre 2026) ———
  ori: { wiki: "ori.fandom.com", title: "Ori" },
  kuro: { wiki: "ori.fandom.com", title: "Kuro" },
  shriek: { wiki: "ori.fandom.com", title: "Shriek" },

  // ——— Elden Ring, Bloodborne, Cyberpunk 2077 (octobre 2026) ———
  // La page « Tarnished » expose le portrait de Godfrey : le visuel du héros
  // joueur vient du fichier E3 choisi à la main.
  ranni: { wiki: "eldenring.fandom.com", title: "Ranni" },
  "hunter-bloodborne": { wiki: "bloodborne.fandom.com", title: "The Hunter" },
  v: { wiki: "cyberpunk.fandom.com", title: "V" },

  // ——— Skyrim, Fallout, Mass Effect, Borderlands (octobre 2026) ———
  // Le wiki Elder Scrolls a une page « Lydia » fourre-tout : celle de Skyrim
  // porte le rendu du personnage. Le wiki Fallout nomme le vendeur
  // « Vault-Tec rep », et distingue les Dogmeat par épisode.
  lydia: { wiki: "elderscrolls.fandom.com", title: "Lydia (Skyrim)" },
  maiq: { wiki: "elderscrolls.fandom.com", title: "M'aiq the Liar" },
  dogmeat: { wiki: "fallout.fandom.com", title: "Dogmeat (Fallout 4)" },
  "vendeur-vault-tec": { wiki: "fallout.fandom.com", title: "Vault-Tec rep" },
  "conrad-verner": { wiki: "masseffect.fandom.com", title: "Conrad Verner" },
  claptrap: { wiki: "borderlands.fandom.com", title: "Claptrap" },
  "face-mcshooty": { wiki: "borderlands.fandom.com", title: "Face McShooty" },
  "jackie-welles": { wiki: "cyberpunk.fandom.com", title: "Jackie Welles" },
  "johnny-sasaki": { wiki: "metalgear.fandom.com", title: "Johnny Sasaki" },
  villageois: { wiki: "minecraft.fandom.com", title: "Villager" },

  // ——— Seconds rôles et indés (octobre 2026) ———
  louis: { wiki: "left4dead.fandom.com", title: "Louis" },
  spy: { wiki: "teamfortress.fandom.com", title: "Spy" },
  heavy: { wiki: "teamfortress.fandom.com", title: "Heavy" },
  "m-qi": { wiki: "stardewvalley.fandom.com", title: "Mr. Qi" },
  hypnos: { wiki: "hades.fandom.com", title: "Hypnos" },
  // Le wiki Plants vs. Zombies nomme la variante « Conehead Zombie ».
  "zombie-cone": { wiki: "plantsvszombies.fandom.com", title: "Conehead Zombie" },

  // ——— Indés délirants (octobre 2026) ———
  // Le wiki Among Us n'a pas de page « The Impostor » : le personnage est
  // documenté sous sa couleur, « Red ». Le wiki Fall Guys vit sur
  // fallguysultimateknockout.fandom.com. Limbo nomme son héros « Nameless Boy ».
  wilson: { wiki: "dontstarve.fandom.com", title: "Wilson" },
  tournesol: { wiki: "plantsvszombies.fandom.com", title: "Sunflower" },
  imposteur: { wiki: "amongus.fandom.com", title: "Red" },
  "fall-guy": { wiki: "fallguysultimateknockout.fandom.com", title: "Fall Guy" },
  pilgor: { wiki: "goatsimulator.fandom.com", title: "Goat" },
  "shovel-knight": { wiki: "shovelknight.fandom.com", title: "Shovel Knight" },
  "meat-boy": { wiki: "supermeatboy.fandom.com", title: "Meat Boy" },
  "petit-garcon": { wiki: "limbo.fandom.com", title: "Nameless Boy" },

  // ——— Récits et curiosités (octobre 2026) ———
  // Disco Elysium nomme le héros « Harrier Du Bois ». Outer Wilds documente le
  // joueur sous « Hatchling » (la page redirige vers « The protagonist »). Le
  // jardinier de Untitled Goose Game s'appelle « Groundskeeper ».
  harry: { wiki: "discoelysium.fandom.com", title: "Harrier Du Bois" },
  andreas: { wiki: "pentiment.fandom.com", title: "Andreas Maler" },
  explorateur: { wiki: "outerwilds.fandom.com", title: "Hatchling" },
  tressa: { wiki: "octopathtraveler.fandom.com", title: "Tressa Colzione" },
  croise: { wiki: "darkestdungeon.fandom.com", title: "Crusader" },
  biker: { wiki: "hotlinemiami.fandom.com", title: "Biker" },
  jorji: { wiki: "papersplease.fandom.com", title: "Jorji Costava" },
  beatrix: { wiki: "slimerancher.fandom.com", title: "Beatrix LeBeau" },
  jardinier: { wiki: "untitledgoosegame.fandom.com", title: "Groundskeeper" },
  baroness: { wiki: "cuphead.fandom.com", title: "Baroness Von Bon Bon" },
  marchand: { wiki: "minecraft.fandom.com", title: "Wandering Trader" },
  rodeur: { wiki: "subnautica.fandom.com", title: "Stalker" },
};

/**
 * Visuels choisis explicitement à la main : la page du wiki renvoie une capture
 * de jeu ou une image de costume plutôt qu'un rendu du personnage.
 */
const FANDOM_FILES: Record<string, { wiki: string; file: string }> = {
  grimm: { wiki: "hollowknight.fandom.com", file: "Grimm Idle.png" },
  glados: { wiki: "half-life.fandom.com", file: "GladosArms2 TRANSPARENT.png" },
  // La page « Pete Kowalski » n'expose pas d'image d'infobox : le fichier est
  // choisi à la main.
  "peter-kowalski": { wiki: "bully.fandom.com", file: "Pete.png" },

  // ——— MMO (octobre 2026) ———
  // Les infobox de Warcraft et Final Fantasy XIV exposent souvent une scène
  // (cinématique, capture de raid) ou un rendu de 160 px de large. Ces fichiers
  // sont des rendus officiels choisis un par un.
  // La couverture du roman ne montrait que le casque et le titre du livre :
  // l'illustration de carte à jouer est un portrait en pied de 2000 px.
  arthas: { wiki: "warcraft.fandom.com", file: "Arthas TCG.jpg" },
  illidan: { wiki: "warcraft.fandom.com", file: "Illidan.jpg" },
  sylvanas: { wiki: "warcraft.fandom.com", file: "Sylvanas 9.2.png" },
  thrall: { wiki: "warcraft.fandom.com", file: "Thrall01.jpg" },
  jaina: { wiki: "warcraft.fandom.com", file: "Jaina Proudmoore of Kul Tiras.jpg" },
  anduin: { wiki: "warcraft.fandom.com", file: "Anduin HoW.jpg" },
  "emet-selch": { wiki: "finalfantasy.fandom.com", file: "Emet-Selch from Final Fantasy XIV EW render.png" },
  yshtola: { wiki: "finalfantasy.fandom.com", file: "FFXIV SH Y'shtola 2.png" },
  alphinaud: { wiki: "finalfantasy.fandom.com", file: "Alphinaud from Final Fantasy XIV Endwalker render.png" },
  alisaie: { wiki: "finalfantasy.fandom.com", file: "Alisaie EW CG Artwork.jpg" },
  estinien: { wiki: "finalfantasy.fandom.com", file: "Estinien 6.0 from Final Fantasy XIV.png" },
  urianger: { wiki: "finalfantasy.fandom.com", file: "Urianger Augurelt FFXIV 5.0.png" },

  // ——— Vague MMO de fin octobre 2026 ———
  // Kerafyrm et Firiona Vie n'ont pas d'image d'infobox sur le wiki EverQuest :
  // le wiki EverQuest II expose les rendus des mêmes personnages. Baium n'a
  // pas de page sur le wiki Lineage II, mais le wiki Echoes of Darkness si.
  kerafyrm: { wiki: "eq2.fandom.com", file: "Kerafyrm.jpg" },
  "firiona-vie": { wiki: "eq2.fandom.com", file: "Firiona Vie.png" },
  baium: { wiki: "echoesofdarkness.fandom.com", file: "Baium.png" },
  // L'infobox du wiki MapleStory pointe une capture panoramique de 2011 ; le
  // rendu du PNJ est plus lisible sur une carte verticale.
  "black-mage": { wiki: "maplestory.fandom.com", file: "NPC Black Mage.png" },
  // La page de l'Esprit occulte expose une bannière de 360×140 px.
  "black-spirit": { wiki: "blackdesertonline.fandom.com", file: "BlackSpirit Stage 6.png" },

  // ——— Elden Ring, Bloodborne, Cyberpunk 2077 (octobre 2026) ———
  tarnished: { wiki: "eldenring.fandom.com", file: "Tarnished E3 2021.jpg" },

  // ——— Vague MMO de fin octobre 2026 (suite) ———
  // Les pages Kundun et Crucia existent, mais sans image d'infobox.
  kundun: { wiki: "muonline.fandom.com", file: "Kundun.jpg" },
  crucia: { wiki: "rift.fandom.com", file: "Crucia.jpg" },

  // ——— Vague MMO de fin octobre 2026 (dernière) ———
  // Page sans image d'infobox : le portrait de Kyprosa et celui de Xizor sont
  // choisis dans les fichiers du wiki (le premier Xizor trouvé est une
  // planche de croquis à deux personnages).
  kyprosa: { wiki: "archeage.fandom.com", file: "Kyprosa.jpg" },
  xizor: { wiki: "starwars.fandom.com", file: "Xizor-MP-Square.png" },

  // ——— Horreur (octobre 2026, suite) ———
  // La page de Trager n'expose qu'une capture Steam Workshop : le rendu du
  // personnage est choisi dans les fichiers. Sae Kurosawa est la femme aux
  // cheveux dénoués de Project Zero. Ghost Face n'a que des visuels larges :
  // la planche de concept art est la moins écrasée par le cadrage 2:3.
  trager: { wiki: "outlast.fandom.com", file: "TragerHeadFront.jpeg" },
  regenerateur: { wiki: "deadspace.fandom.com", file: "Regenerator.png" },
  springtrap: { wiki: "fnaf.fandom.com", file: "Springtrap-AR.png" },
  "femme-cheveux-denoues": { wiki: "fatalframe.fandom.com", file: "Sae2.png" },
  "ghost-face": { wiki: "deadbydaylight.fandom.com", file: "Ghost Default Concept Art.jpeg" },
  // La page Elster existe mais sans image d'infobox.
  elster: { wiki: "signalis.fandom.com", file: "Elster.png" },
  // Phasmophobia n'a pas de rendu du Démon : son icône de crâne cornu, l'image
  // d'infobox, est écartée par le filtre anti-logo (son nom contient « cover »).
  demon: { wiki: "phasmophobia.fandom.com", file: "Demon Discovered.jpg" },

  // ——— Seconds rôles et indés (octobre 2026) ———
  // Cornifer : la page expose une planche large, le fichier circulaire est un
  // rendu carré du personnage. Le Diable : l'infobox est une capture de
  // cinématique, le rendu détouré est plus propre. Le Prisonnier et Zéro : la
  // page expose des captures ou des sprites, leurs illustrations officielles
  // sont choisies à la main. L'Oie : l'image d'infobox est une photo d'oie,
  // l'artwork du jeu est le bon fichier.
  cornifer: { wiki: "hollowknight.fandom.com", file: "Cornifer Circle.png" },
  diable: { wiki: "cuphead.fandom.com", file: "DevilCuphead.png" },
  prisonnier: { wiki: "deadcells.fandom.com", file: "Beheaded-Island-BG.png" },
  zero: { wiki: "katanazero.fandom.com", file: "ZeroSteamCard.png" },
  oie: { wiki: "untitledgoosegame.fandom.com", file: "Gooseoriginal.jpg" },

  // ——— Indés délirants (octobre 2026) ———
  // La page Jacket expose une capture de masque sur un mur : l'artwork complet
  // du personnage est choisi. L'Inspecteur n'a que son portrait d'archive en
  // couleur, la version N&B étant bloquée.
  jacket: { wiki: "hotlinemiami.fandom.com", file: "JacketArtwork.png" },
  inspecteur: { wiki: "papersplease.fandom.com", file: "Inspector.png" },

  // ——— Récits et curiosités (octobre 2026) ———
  // La page du Prince expose une jaquette de jeu : le rendu détouré du
  // personnage est choisi à la main.
  prince: { wiki: "katamari.fandom.com", file: "PrincePose.png" },

  // ——— Conduite et stratégie (octobre 2026) ———
  // Les wikis Driver et Stronghold n'exposent pas d'image de fiche : le fichier
  // est choisi à la main.
  tanner: { wiki: "driver.fandom.com", file: "TannerDSF.png" },
  thrawn: { wiki: "starwars.fandom.com", file: "Grand Admiral Thrawn DoR.png" },
  "duc-de-paille": { wiki: "stronghold.fandom.com", file: "The Pig1.jpg" },

  // ——— Visuels MMO repris un par un (octobre 2026) ———
  // Les infobox de ces wikis exposent un sprite agrandi, une carte à jouer
  // encadrée, une capture de cinématique ou une scène de groupe : le personnage
  // n'y est pas lisible. Chaque fichier ci-dessous est un rendu du personnage,
  // vérifié à l'œil sur une planche de contrôle.
  goultard: { wiki: "wakfu.fandom.com", file: "Goultard.png" },
  nox: { wiki: "wakfu.fandom.com", file: "Noximilien.png" },
  "joris-jurgen": { wiki: "wakfu.fandom.com", file: "Joris.jpg" },
  dathura: { wiki: "wakfu.fandom.com", file: "Dathura true face.png" },
  julith: { wiki: "wakfu.fandom.com", file: "Julith.jpg" },
  rushu: { wiki: "wakfu.fandom.com", file: "Rushu 3.jpg" },
  brainiac: { wiki: "dcuniverseonline.fandom.com", file: "BrainiacCM3.png" },
  "lex-luthor": { wiki: "dcuniverseonline.fandom.com", file: "LexLuthorHoD.png" },
  // Les fiches Ragnarok n'exposent que les cartes à jouer (cadre, texte et
  // numéro de série) : les rendus « super deformed » montrent le monstre seul.
  baphomet: { wiki: "ragnarok.fandom.com", file: "RO Baphomet(SD).png" },
  "valkyrie-randgris": { wiki: "ragnarok.fandom.com", file: "RO Randgris(SD).png" },
  surt: { wiki: "ragnarok.fandom.com", file: "RO Surt2(SD).png" },

  // ——— Visuels MMO manquants, comblés (octobre 2026) ———
  // La page « Kirsten Geary » n'a qu'une bannière pour image d'infobox ; le
  // wiki détient en revanche le portrait vertical utilisé par le jeu.
  "kirsten-geary": { wiki: "secretworld.fandom.com", file: "Kirstengeary desc.jpg" },
};

/**
 * Cartes dont le visuel vient du wiki officiel de Guild Wars 2.
 *
 * Ce wiki est inaccessible depuis fin 2025 (page de maintenance sur toutes ses
 * langues, images comprises) : on lit donc la copie archivée de la page par
 * l'Internet Archive et on garde l'URL de l'image telle qu'il la sert. Les
 * crédits, eux, renvoient toujours à la page du wiki.
 */
const ARCHIVED_TITLES: Record<string, { wiki: string; title: string }> = {
  aurene: { wiki: "wiki.guildwars2.com", title: "Aurene" },
  rytlock: { wiki: "wiki.guildwars2.com", title: "Rytlock Brimstone" },
  caithe: { wiki: "wiki.guildwars2.com", title: "Caithe" },
  "logan-thackeray": { wiki: "wiki.guildwars2.com", title: "Logan Thackeray" },
  zojja: { wiki: "wiki.guildwars2.com", title: "Zojja" },
  trahearne: { wiki: "wiki.guildwars2.com", title: "Trahearne" },
  "palawa-joko": { wiki: "wiki.guildwars2.com", title: "Palawa Joko" },
};

/**
 * Les visuels Fandom sont servis par un CDN Cloudflare qui exige des en-têtes
 * navigateur (`Sec-Fetch-*` ou `Referer`). Un navigateur les envoie toujours,
 * donc le hotlink fonctionne — mais un client HTTP nu (curl, bots) reçoit un 403.
 */

type WikiPage = {
  title: string;
  missing?: boolean;
  pageimage?: string;
  pageprops?: { disambiguation?: string };
  thumbnail?: { source: string; width: number; height: number };
  imageinfo?: { thumburl?: string; url?: string; width?: number; height?: number }[];
};

type QueryResponse = {
  query?: {
    pages?: WikiPage[];
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
  };
};

type Portrait = {
  url: string;
  source: "wikipedia" | "fandom";
  wikiHost?: string;
  wikiTitle: string;
  page: string;
  file: string;
  width: number;
  height: number;
  credit?: string;
  license?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** L'API anonyme limite vite le débit : un appel toutes les 1,2 s minimum. */
const MIN_INTERVAL_MS = 1200;
let lastRequestAt = 0;

async function waitForSlot() {
  const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function api(
  baseUrl: string,
  params: Record<string, string>,
  attempt = 0,
): Promise<QueryResponse> {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params }).toString();

  await waitForSlot();

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!response.ok) {
    if (attempt < 6) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(30_000, 3000 * 2 ** attempt);
      console.warn(`   … ${response.status} sur ${new URL(baseUrl).host}, pause ${Math.round(delay / 1000)} s`);
      await sleep(delay);
      return api(baseUrl, params, attempt + 1);
    }
    throw new Error(`API ${new URL(baseUrl).host} → ${response.status} (${params.titles ?? ""})`);
  }

  const raw = await response.text();
  try {
    return JSON.parse(raw) as QueryResponse;
  } catch {
    if (attempt < 6) {
      await sleep(5000 * (attempt + 1));
      return api(baseUrl, params, attempt + 1);
    }
    throw new Error(`Réponse illisible de ${new URL(baseUrl).host} : ${raw.slice(0, 120)}`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Wikipédia ajoute des paramètres de tracking ; Fandom utilise ses query strings pour la mise à l'échelle. */
function cleanUrl(source: string): string {
  const host = new URL(source).hostname;
  return host.endsWith("wikimedia.org") ? source.split("?")[0] : source;
}

function resolveAlias(data: QueryResponse, wanted: string): string {
  let title = wanted;
  for (const entry of data.query?.normalized ?? []) if (entry.from === title) title = entry.to;
  for (const entry of data.query?.redirects ?? []) if (entry.from === title) title = entry.to;
  return title;
}

/** Les titres de fichiers utilisent des espaces, les réponses de l'API parfois des underscores. */
function normalizeFileName(value: string): string {
  return value.replace(/_/g, " ").trim();
}

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || undefined;
}

/**
 * Un logo ou une jaquette n'est pas un portrait. Les articles de franchise les
 * exposent volontiers comme image d'illustration (Sonic → logo Sega), d'où ce
 * filtre : une carte concernée est signalée puis laissée à une autre source.
 */
const NOT_A_PORTRAIT = /\.svg$|logo|cover|box art|montage/i;

function toPortrait(
  page: WikiPage,
  source: "wikipedia" | "fandom",
  pageUrl: (title: string) => string,
  wikiHost?: string,
): Portrait | null {
  if (!page.thumbnail?.source || page.pageprops?.disambiguation) return null;
  if (NOT_A_PORTRAIT.test(page.pageimage ?? "")) {
    console.warn(`   ! visuel écarté (logo/jaquette) sur « ${page.title} » : ${page.pageimage}`);
    return null;
  }
  return {
    url: cleanUrl(page.thumbnail.source),
    source,
    wikiHost,
    wikiTitle: page.title,
    page: pageUrl(page.title),
    file: normalizeFileName(page.pageimage ?? ""),
    width: page.thumbnail.width,
    height: page.thumbnail.height,
  };
}

/** Sans horodatage, l'archive redirige vers la copie la plus proche. */
const ARCHIVE_PREFIX = "https://web.archive.org/web/2026im_/";
/** Années tentées, de la plus récente à la plus ancienne. */
const ARCHIVE_SNAPSHOT_YEARS = ["2026", "2025", "2024"];
/** Largeur de vignette visée : une carte affiche l'art sur ~380 px. */
const ARCHIVE_THUMB_WIDTH = 640;

/**
 * Vignette MediaWiki d'un fichier : `images/a/ab/Nom.jpg` donne
 * `images/thumb/a/ab/Nom.jpg/640px-Nom.jpg`.
 */
function wikiThumb(original: string, width: number): string {
  const match = original.match(/^(.*\/images)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/);
  if (!match) return original;
  const [, base, shard, bucket, file] = match;
  return `${base}/thumb/${shard}/${bucket}/${file}/${width}px-${file}`;
}

/**
 * Fichier d'origine d'une URL de vignette : `images/thumb/a/ab/Nom.jpg/300px-Nom.jpg`
 * donne `images/a/ab/Nom.jpg`.
 */
function wikiOriginal(url: string): string {
  const match = url.match(/^(.*\/images)\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)/);
  return match ? `${match[1]}/${match[2]}/${match[3]}/${match[4]}` : url;
}

/** Vérifie qu'une URL de l'archive sert bien une image. */
async function archiveServesImage(url: string): Promise<boolean> {
  await waitForSlot();
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "image/*" } });
    if (!response.ok) return false;
    if (!(response.headers.get("content-type") ?? "").startsWith("image/")) return false;
    await response.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Visuel d'une page de wiki lue dans l'Internet Archive.
 *
 * Le wiki officiel de Guild Wars 2 répond une page de maintenance sur toutes
 * ses URL, images comprises. On lit donc la copie archivée de la page pour
 * retrouver l'image d'infobox, puis on garde le lien que l'archive sert. Une
 * vignette de 640 px suffit largement pour une carte et pèse deux à trois fois
 * moins que le fichier d'origine ; on retombe sur l'original si elle manque.
 */
async function archivedPortrait(
  wikiHost: string,
  title: string,
  pageUrl: string,
): Promise<Portrait | null> {
  await waitForSlot();

  // Les copies récentes tombent parfois sur la page de maintenance : on
  // remonte les années jusqu'à trouver une version avec l'image d'infobox.
  for (const year of ARCHIVE_SNAPSHOT_YEARS) {
    await waitForSlot();

    let html: string;
    try {
      const response = await fetch(`https://web.archive.org/web/${year}/${pageUrl}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) {
        console.warn(`   ! archive ${title} (${year}) → ${response.status}`);
        continue;
      }
      html = await response.text();
    } catch (error) {
      console.warn(`   ! archive ${title} (${year}) → ${(error as Error).message}`);
      continue;
    }

    const originals = [
      ...new Set(
        [...html.matchAll(/https:\/\/web\.archive\.org\/web\/\d{14}(?:im_|if_)\/(https:\/\/wiki\.guildwars2\.com\/images\/[^"' ]+?\.(?:png|jpe?g))/gi)]
          // La page n'expose souvent que des vignettes (`/images/thumb/…`) : on
          // remonte au fichier d'origine pour pouvoir en redemander une taille.
          .map((match) => wikiOriginal(match[1]))
          .filter((url) => url.includes("/images/") && !url.includes("/thumb/")),
      ),
    ];

    const primary = originals[0];
    if (!primary) continue;

    for (const candidate of [wikiThumb(primary, ARCHIVE_THUMB_WIDTH), primary]) {
      const url = `${ARCHIVE_PREFIX}${candidate}`;
      if (!(await archiveServesImage(url))) continue;

      return {
        url,
        source: "fandom",
        wikiHost,
        wikiTitle: title,
        page: pageUrl,
        file: decodeURIComponent(candidate.split("/").pop() ?? ""),
        width: Number(candidate.match(/\/(\d+)px-/)?.[1] ?? 0),
        // L'archive n'annonce pas la hauteur : le cadrage des cartes ne s'appuie
        // que sur `object-fit`, donc la valeur n'est pas utilisée.
        height: 0,
      };
    }
  }

  console.warn(`   ! archive ${title} : aucune image servie`);
  return null;
}

async function main() {
  const portraits: Record<string, Portrait> = {};
  const missing: string[] = [];

  // ————— 1. Wikipédia —————
  const fromWikipedia = CARDS.filter((card) => WIKI_TITLES[card.id]).map((card) => ({
    card,
    title: WIKI_TITLES[card.id],
  }));

  console.log(`→ Wikipédia : ${fromWikipedia.length} cartes`);

  const pagesByTitle = new Map<string, WikiPage>();
  for (const group of chunk(fromWikipedia, 45)) {
    const titles = Array.from(new Set(group.map((item) => item.title)));
    const data = await api(WIKIPEDIA_API, {
      action: "query",
      prop: "pageimages|pageprops",
      piprop: "thumbnail|name",
      pilicense: "any",
      pithumbsize: String(THUMB_SIZE),
      redirects: "1",
      titles: titles.join("|"),
    });

    for (const title of titles) {
      const finalTitle = resolveAlias(data, title);
      const page = data.query?.pages?.find((candidate) => candidate.title === finalTitle);
      if (page) pagesByTitle.set(title, page);
    }
  }

  for (const { card, title } of fromWikipedia) {
    const page = pagesByTitle.get(title);
    const portrait = page
      ? toPortrait(
          page,
          "wikipedia",
          (wikiTitle) => `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
        )
      : null;

    if (portrait) portraits[card.id] = portrait;
    else missing.push(`${card.id} (wikipédia : ${title})`);
  }

  // ————— 2. Fandom —————
  const byWiki = new Map<string, { cardId: string; title: string }[]>();
  const siteByKey = new Map<string, { wiki: string; prefix: string }>();
  for (const card of CARDS) {
    if (portraits[card.id]) continue;
    const entry = FANDOM_TITLES[card.id];
    if (!entry) continue;
    const prefix = entry.prefix ?? "";
    const key = `${entry.wiki}${prefix}`;
    const list = byWiki.get(key) ?? [];
    list.push({ cardId: card.id, title: entry.title });
    byWiki.set(key, list);
    siteByKey.set(key, { wiki: entry.wiki, prefix });
  }

  const fandomTotal = Array.from(byWiki.values()).reduce((sum, list) => sum + list.length, 0);
  console.log(`→ Fandom : ${fandomTotal} cartes sur ${byWiki.size} wikis`);

  for (const [key, items] of byWiki) {
    const site = siteByKey.get(key)!;
    const base = `https://${site.wiki}${site.prefix}`;
    const pages = new Map<string, WikiPage>();

    // L'API anonyme plafonne à 50 titres par requête : au-delà elle refuse la
    // requête entière, et le wiki perdrait ses visuels d'un coup.
    for (const group of chunk(Array.from(new Set(items.map((item) => item.title))), 45)) {
      try {
        const data = await api(`${base}/api.php`, {
          action: "query",
          prop: "pageimages|pageprops",
          piprop: "thumbnail|name",
          pithumbsize: String(THUMB_SIZE),
          redirects: "1",
          titles: group.join("|"),
        });

        for (const title of group) {
          const finalTitle = resolveAlias(data, title);
          const page = data.query?.pages?.find((candidate) => candidate.title === finalTitle);
          if (page) pages.set(title, page);
        }
      } catch (error) {
        console.warn(`   ! ${site.wiki} : ${(error as Error).message}`);
      }
    }

    for (const item of items) {
      const page = pages.get(item.title);
      const portrait = page
        ? toPortrait(
            page,
            "fandom",
            (wikiTitle) => `${base}/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
            site.wiki,
          )
        : null;

      if (portrait) portraits[item.cardId] = portrait;
      else missing.push(`${item.cardId} (${site.wiki} : ${item.title})`);
    }
  }

  // ————— 2 bis. Visuels choisis fichier par fichier —————
  const filesByWiki = new Map<string, { cardId: string; file: string }[]>();
  for (const card of CARDS) {
    if (portraits[card.id]) continue;
    const entry = FANDOM_FILES[card.id];
    if (!entry) continue;
    const list = filesByWiki.get(entry.wiki) ?? [];
    list.push({ cardId: card.id, file: entry.file });
    filesByWiki.set(entry.wiki, list);
  }

  for (const [wiki, items] of filesByWiki) {
    let data: QueryResponse | null = null;

    try {
      data = await api(`https://${wiki}/api.php`, {
        action: "query",
        prop: "imageinfo",
        iiprop: "url|size",
        iiurlwidth: String(THUMB_SIZE),
        titles: items.map((item) => `File:${item.file}`).join("|"),
      });
    } catch (error) {
      console.warn(`   ! ${wiki} : ${(error as Error).message}`);
    }

    for (const item of items) {
      const page = data?.query?.pages?.find(
        (candidate) => normalizeFileName(candidate.title.replace(/^File:/, "")) === item.file,
      );
      const info = page?.imageinfo?.[0];
      const source = info?.thumburl ?? info?.url;

      if (!page || !source) {
        missing.push(`${item.cardId} (${wiki} : File:${item.file})`);
        continue;
      }

      portraits[item.cardId] = {
        url: cleanUrl(source),
        source: "fandom",
        wikiHost: wiki,
        wikiTitle: item.file,
        page: `https://${wiki}/wiki/${encodeURIComponent(`File:${item.file}`.replace(/ /g, "_"))}`,
        file: item.file,
        width: info?.width ?? 0,
        height: info?.height ?? 0,
      };
    }
  }

  // ————— 2 ter. Wiki officiel inaccessible : copie archivée —————
  const archivedCount = CARDS.filter(
    (card) => !portraits[card.id] && ARCHIVED_TITLES[card.id],
  ).length;
  if (archivedCount > 0) console.log(`→ Archives GW2 : ${archivedCount} cartes`);

  for (const card of CARDS) {
    if (portraits[card.id]) continue;
    const entry = ARCHIVED_TITLES[card.id];
    if (!entry) continue;

    const pageUrl = `https://${entry.wiki}/wiki/${encodeURIComponent(entry.title.replace(/ /g, "_"))}`;
    const portrait = await archivedPortrait(entry.wiki, entry.title, pageUrl);

    if (portrait) portraits[card.id] = portrait;
    else missing.push(`${card.id} (archive : ${pageUrl})`);
  }

  // ————— 3. Crédits Wikipédia —————
  const wikipediaFiles = Array.from(
    new Set(
      Object.values(portraits)
        .filter((portrait) => portrait.source === "wikipedia")
        .map((portrait) => portrait.file)
        .filter(Boolean),
    ),
  );

  for (const group of chunk(wikipediaFiles, 40)) {
    try {
      const data = await api(WIKIPEDIA_API, {
        action: "query",
        prop: "imageinfo",
        iiprop: "extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName",
        titles: group.map((file) => `File:${file}`).join("|"),
      });

      for (const page of data.query?.pages ?? []) {
        const file = normalizeFileName(page.title.replace(/^File:/, ""));
        const meta = (page as unknown as { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] })
          .imageinfo?.[0]?.extmetadata;

        for (const portrait of Object.values(portraits)) {
          if (portrait.source !== "wikipedia") continue;
          if (normalizeFileName(portrait.file) !== file || !meta) continue;
          portrait.credit = stripHtml(meta.Artist?.value);
          portrait.license = stripHtml(meta.LicenseShortName?.value);
        }
      }
    } catch (error) {
      console.warn(`   ! crédits partiels : ${(error as Error).message}`);
    }
  }

  // Une requête manquée (débit, maintenance) ne doit pas effacer un visuel déjà
  // connu : on reprend l'entrée du passage précédent pour les cartes qui n'ont
  // rien obtenu cette fois.
  let previous: Record<string, Portrait> = {};
  try {
    const raw = JSON.parse(await fs.readFile(OUTPUT, "utf8")) as { items?: Record<string, Portrait> };
    previous = raw.items ?? {};
  } catch {
    // Premier passage : rien à conserver.
  }

  const kept = CARDS.filter((card) => !portraits[card.id] && previous[card.id]).map((card) => {
    portraits[card.id] = previous[card.id];
    return card.id;
  });
  if (kept.length > 0) console.log(`→ Repris du passage précédent : ${kept.length} visuels`);

  const sorted = Object.fromEntries(Object.entries(portraits).sort(([a], [b]) => a.localeCompare(b)));

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(
    OUTPUT,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: "Visuels hotlinkés (Wikipédia, puis Fandom pour les personnages sans article). Projet de fan non officiel : la plupart de ces images sont en fair use (voir README).",
        items: sorted,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`✓ ${Object.keys(sorted).length}/${CARDS.length} visuels écrits dans src/data/portraits.json`);

  const withoutArt = missing.filter((entry) => !portraits[entry.split(" ")[0]]);
  if (withoutArt.length > 0) {
    console.log(`\nSans visuel (fallback dégradé + emoji) :\n  ${withoutArt.join("\n  ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
