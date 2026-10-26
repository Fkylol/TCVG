/**
 * Genres du catalogue et rattachement des cartes.
 *
 * Un genre = un pack (phase 4) et un pool de tirage. Une carte peut avoir
 * plusieurs genres (many-to-many en base, `public.card_genres`) : c'est
 * volontaire, Minecraft est Action-Aventure, Hollow Knight est
 * Action-Aventure *et* Indé.
 *
 * Ce fichier est le miroir TypeScript de `public.card_genres` (migrations 005
 * et 006). Il sert au script de backfill `npm run db:genres`, aux tests et aux
 * filtres de l'album ; la source de vérité pour le tirage reste la base.
 */

export type GenreSlug =
  | "action-aventure"
  | "plateforme"
  | "rpg"
  | "fps"
  | "inde"
  | "combat"
  | "horreur"
  | "strategie"
  | "mmo";

export type Genre = {
  slug: GenreSlug;
  name: string;
};

/** Les 9 genres, dans l'ordre des packs de la phase 4 (le Mix n'en a pas). */
export const GENRES: Genre[] = [
  { slug: "action-aventure", name: "Action-aventure" },
  { slug: "plateforme", name: "Plateforme" },
  { slug: "rpg", name: "RPG" },
  { slug: "fps", name: "FPS" },
  { slug: "inde", name: "Indé" },
  { slug: "combat", name: "Combat" },
  { slug: "horreur", name: "Horreur" },
  { slug: "strategie", name: "Stratégie" },
  // Pack des quatre franchises en ligne : WoW, FF XIV, Dofus, Guild Wars 2.
  { slug: "mmo", name: "MMO" },
];

export function getGenreName(slug: GenreSlug): string {
  return GENRES.find((genre) => genre.slug === slug)?.name ?? slug;
}

/**
 * Genres de chaque carte, par identifiant.
 *
 * Répartition au moment de la migration 013 :
 *   action-aventure 26 · plateforme 26 · rpg 22 · fps 10 · inde 7
 *   combat 3 · horreur 2 · strategie 0
 *
 * Les genres à 0 carte existent quand même : leur pack se rabat sur le pool
 * global (voir le repli du tirage), il ne doit jamais planter.
 */
export const CARD_GENRES: Record<string, GenreSlug[]> = {
  // ——— Banjo-Kazooie ———
  "banjo-kazooie": ["plateforme"],
  gruntilda: ["plateforme"],
  mumbo: ["plateforme"],

  // ——— Castlevania ———
  alucard: ["action-aventure"],
  dracula: ["action-aventure"],
  simon: ["action-aventure"],

  // ——— Celeste ———
  madeline: ["inde", "plateforme"],

  // ——— Crash Bandicoot ———
  cortex: ["plateforme"],
  crash: ["plateforme"],

  // ——— Cuphead ———
  cuphead: ["plateforme"],
  "king-dice": ["plateforme"],

  // ——— Dark Souls ———
  artorias: ["action-aventure", "rpg"],
  gwyn: ["action-aventure", "rpg"],
  solaire: ["action-aventure", "rpg"],

  // ——— Devil May Cry ———
  dante: ["action-aventure"],
  vergil: ["action-aventure"],

  // ——— DOOM ———
  "doom-slayer": ["fps"],

  // ——— Elden Ring ———
  malenia: ["action-aventure", "rpg"],
  radahn: ["action-aventure", "rpg"],

  // ——— Final Fantasy VII ———
  aerith: ["rpg"],
  cloud: ["rpg"],
  sephiroth: ["rpg"],
  tifa: ["rpg"],

  // ——— God of War ———
  atreus: ["action-aventure"],
  baldur: ["action-aventure"],
  freya: ["action-aventure"],
  kratos: ["action-aventure"],

  // ——— Half-Life ———
  "g-man": ["fps"],
  gordon: ["fps"],

  // ——— Halo ———
  arbiter: ["fps"],
  cortana: ["fps"],
  "master-chief": ["fps"],

  // ——— Hollow Knight ———
  grimm: ["action-aventure", "inde"],
  hornet: ["action-aventure", "inde"],
  "le-chevalier": ["action-aventure", "inde"],

  // ——— Kingdom Hearts ———
  sora: ["rpg"],
  xehanort: ["rpg"],

  // ——— Kirby ———
  "king-dedede": ["plateforme"],
  kirby: ["plateforme"],
  "meta-knight": ["plateforme"],

  // ——— Super Mario ———
  bowser: ["plateforme"],
  luigi: ["plateforme"],
  mario: ["plateforme"],
  peach: ["plateforme"],
  yoshi: ["plateforme"],

  // ——— Metroid ———
  ridley: ["action-aventure"],
  samus: ["action-aventure"],

  // ——— Minecraft ———
  creeper: ["action-aventure"],
  "ender-dragon": ["action-aventure"],
  steve: ["action-aventure"],

  // ——— NieR ———
  "2b": ["rpg"],

  // ——— Overwatch ———
  mercy: ["fps"],
  reaper: ["fps"],
  tracer: ["fps"],

  // ——— Persona ———
  joker: ["rpg"],

  // ——— Pokémon ———
  charizard: ["rpg"],
  mewtwo: ["rpg"],
  pikachu: ["rpg"],

  // ——— Portal ———
  chell: ["plateforme"],
  wheatley: ["plateforme"],

  // ——— Resident Evil ———
  leon: ["horreur"],
  nemesis: ["horreur"],

  // ——— Sonic ———
  eggman: ["plateforme"],
  knuckles: ["plateforme"],
  shadow: ["plateforme"],
  sonic: ["plateforme"],

  // ——— Splatoon ———
  inkling: ["fps"],

  // ——— Spyro ———
  hunter: ["plateforme"],
  ripto: ["plateforme"],
  spyro: ["plateforme"],

  // ——— Street Fighter ———
  bison: ["combat"],
  "chun-li": ["combat"],
  ryu: ["combat"],

  // ——— Undertale ———
  flowey: ["inde", "rpg"],
  papyrus: ["inde", "rpg"],
  sans: ["inde", "rpg"],

  // ——— The Witcher ———
  ciri: ["rpg"],
  geralt: ["rpg"],
  yennefer: ["rpg"],

  // ——— The Legend of Zelda ———
  ganondorf: ["action-aventure"],
  link: ["action-aventure"],
  majora: ["action-aventure"],
  zelda: ["action-aventure"],
  // ——— Bubsy ———
  "bubsy-bobcat": ["plateforme"],
  "terry-bobcat": ["plateforme"],
  "terri-bobcat": ["plateforme"],
  "oinker-p-hamm": ["plateforme"],

  // ——— Bully ———
  "gary-smith": ["action-aventure"],
  "peter-kowalski": ["action-aventure"],
  "johnny-vincent": ["action-aventure"],
  "lefty-mancini": ["action-aventure"],
  "lola-lombardi": ["action-aventure"],
  "derby-harrington": ["action-aventure"],
  "ted-thompson": ["action-aventure"],
  "james-hopkins": ["action-aventure"],

  // ——— Clair Obscur ———
  "gustave": ["rpg"],
  "renoir": ["rpg"],
  "sophie": ["rpg"],
  "maelle": ["rpg"],
  "lune": ["rpg"],
  "the-paintress": ["rpg"],
  "verso": ["rpg"],
  "sciel": ["rpg"],
  "monoco": ["rpg"],
  "curator": ["rpg"],

  // ——— Code Vein ———
  "valentin-voda": ["rpg"],
  "josee-anjou": ["rpg"],
  "lavinia-voda": ["rpg"],
  "holly-asturias": ["rpg"],
  "juzo-mido": ["rpg"],
  "louis-amamiya": ["rpg"],
  "lou-magmell": ["rpg"],
  "lyle-mcleish": ["rpg"],
  "zenon-gryfgote": ["rpg"],
  "noah-g-magmell": ["rpg"],
  "iris-magmell": ["rpg"],
  "cruz-silva": ["rpg"],
  "jadwiga": ["rpg"],
  "gregorio-silva": ["rpg"],

  // ——— Code Violet ———

  // ——— Crimson Desert ———
  "kliff-macduff": ["action-aventure"],
  "damiane": ["action-aventure"],
  "oongka": ["action-aventure"],
  "myurdin": ["action-aventure"],
  "split-horn": ["action-aventure"],
  "naira": ["action-aventure"],

  // ——— Duke Nukem ———
  "duke-nukem": ["fps"],
  "dr-proton": ["fps"],
  "cycloid-empero": ["fps"],

  // ——— Final Fantasy IX ———
  "beate": ["rpg"],
  "kweena-quen": ["rpg"],
  "kuja": ["rpg"],
  "steiner-adelbert": ["rpg"],
  "freyja-crescent": ["rpg"],
  "eiko-carol": ["rpg"],
  "tarask-coral": ["rpg"],
  "djidane-tribal": ["rpg"],
  "grenat-til-alexandros-xvii": ["rpg"],
  "bibi-orunitia": ["rpg"],
  "frank": ["rpg"],
  "markus": ["rpg"],
  "cid-fabul-ix": ["rpg"],
  "branet-raza-alexandros-xvi": ["rpg"],
  "garland": ["rpg"],
  "necron": ["rpg"],

  // ——— Final Fantasy VI ———
  "terra-branford": ["rpg"],
  "mog": ["rpg"],
  "locke-cole": ["rpg"],
  "celes-chere": ["rpg"],
  "kefka-palazzo": ["rpg"],
  "ultros": ["rpg"],
  "setzer-gabbiani": ["rpg"],
  "strago-magus": ["rpg"],
  "relm-arrowny": ["rpg"],
  "gogo": ["rpg"],
  "edgar-roni-figaro": ["rpg"],
  "sabin-rene-figaro": ["rpg"],
  "gestahl": ["rpg"],
  "shadow-2": ["rpg"],
  "cyan-garamonde": ["rpg"],
  "gau": ["rpg"],

  // ——— Final Fantasy VII ———
  "barret-wallace": ["rpg"],
  "rufus-shinra": ["rpg"],
  "reno": ["rpg"],
  "jessie-rasberry": ["rpg"],
  "yuffie-kisaragi": ["rpg"],
  "cait-sith": ["rpg"],
  "jenova": ["rpg"],
  "zack-fair": ["rpg"],
  "elena": ["rpg"],
  "cid-highwind": ["rpg"],
  "vincent-valentine": ["rpg"],
  "biggs": ["rpg"],
  "tseng": ["rpg"],
  "wedge": ["rpg"],
  "red-xiii": ["rpg"],
  "rude": ["rpg"],
  "professeur-hojo": ["rpg"],

  // ——— Final Fantasy X ———
  "tidus": ["rpg"],
  "auron": ["rpg"],
  "yuna": ["rpg"],
  "seymour-guado": ["rpg"],
  "wakka": ["rpg"],
  "lulu": ["rpg"],
  "kimahri-ronso": ["rpg"],
  "jecht": ["rpg"],
  "braska": ["rpg"],
  "belgemine": ["rpg"],
  "maitre-mika": ["rpg"],
  "wen-kinoc": ["rpg"],
  "rikku": ["rpg"],
  "sir-jyscal-guado": ["rpg"],
  "kelk-ronso": ["rpg"],
  "zaon": ["rpg"],
  "dona": ["rpg"],


  // ——— Ōkami ———
  issun: ["action-aventure"],

  // ——— Grand Theft Auto ———
  "carl-johnson": ["action-aventure"],
  "niko-bellic": ["action-aventure"],
  "tommy-vercetti": ["action-aventure"],
  "franklin-clinton": ["action-aventure"],
  "jimmy-de-santa": ["action-aventure"],
  "melvin-harris": ["action-aventure"],
  "roman-bellic": ["action-aventure"],
  "lucia-caminos": ["action-aventure"],
  "jason-duval": ["action-aventure"],
  "boobie-ike": ["action-aventure"],
  "michael-de-santa": ["action-aventure"],
  "raul-bautista": ["action-aventure"],
  "trevor-philips": ["action-aventure"],
  "ricardo-diaz": ["action-aventure"],
  "little-jacob": ["action-aventure"],
  "lance-vance": ["action-aventure"],
  "dave-norton": ["action-aventure"],
  "ken-rosenberg": ["action-aventure"],
  "lance-wilson": ["action-aventure"],
  "sonny-forelli": ["action-aventure"],
  "jeffrey-cross": ["action-aventure"],
  "dre-quan-priest": ["action-aventure"],
  "kent-paul": ["action-aventure"],
  "playboy-x": ["action-aventure"],
  "claude": ["action-aventure"],
  "jimmy-pegorino": ["action-aventure"],
  "dimitri-rascalov": ["action-aventure"],
  "tanisha-jackson": ["action-aventure"],
  "8-ball": ["action-aventure"],
  "lester-crest": ["action-aventure"],
  "darko-brevic": ["action-aventure"],
  "cal-hampton": ["action-aventure"],
  "amanda-de-santa": ["action-aventure"],
  "tracy-de-santa": ["action-aventure"],
  "sean-johnson": ["action-aventure"],
  "floyd-hebert": ["action-aventure"],
  "steve-haines": ["action-aventure"],
  "denise-clinton": ["action-aventure"],
  "wei-cheng": ["action-aventure"],
  "catalina": ["action-aventure"],
  "ray-bulgarin": ["action-aventure"],
  "frank-tenpenny": ["action-aventure"],
  "stretch": ["action-aventure"],
  "miguel": ["action-aventure"],
  "chef": ["action-aventure"],
  "mikhail-faustin": ["action-aventure"],
  "cesar-vialpando": ["action-aventure"],
  "lamar-davis": ["action-aventure"],
  "solomon-richards": ["action-aventure"],
  "vladimir-glebov": ["action-aventure"],
  "mallorie-bardas": ["action-aventure"],
  "luigi-goterelli": ["action-aventure"],
  "patrick-mcreary": ["action-aventure"],
  "joey-leone": ["action-aventure"],
  "brucie-kibbutz": ["action-aventure"],
  "juan-garcia-cortez": ["action-aventure"],
  "dwayne-forge": ["action-aventure"],
  "avery-carrington": ["action-aventure"],
  "ron-jakowski": ["action-aventure"],
  "karen-daniels": ["action-aventure"],
  "brian-heder": ["action-aventure"],
  "wade-hebert": ["action-aventure"],
  "bernie-crane": ["action-aventure"],
  "devin-weston": ["action-aventure"],

  // ——— Kirby ———
  "bandana-waddle-dee": ["plateforme"],
  "marx": ["plateforme"],
  "magolor": ["plateforme"],

  // ——— Life is Strange ———
  "max-caulfield": ["action-aventure"],
  "chloe-price": ["action-aventure"],
  "nathan-prescott": ["action-aventure"],
  "sean-diaz": ["action-aventure"],
  "mark-jefferson": ["action-aventure"],
  "safiya-llewellyn-fayyad": ["action-aventure"],
  "daniel-diaz": ["action-aventure"],
  "alexandra-chen": ["action-aventure"],
  "damon-merrick": ["action-aventure"],
  "hank-stamper": ["action-aventure"],
  "lisbeth-fischer": ["action-aventure"],
  "jedediah-lucan": ["action-aventure"],
  "rachel-amber": ["action-aventure"],
  "yasmin-fayyad": ["action-aventure"],
  "lucas-colmenero": ["action-aventure"],
  "ryan-lucan": ["action-aventure"],

  // ——— Mafia ———
  "isabella-torrisi": ["action-aventure"],
  "enzo-favani": ["action-aventure"],
  "luca-trapani": ["action-aventure"],
  "corrado-bastoni": ["action-aventure"],

  // ——— Metal Gear ———
  "solid-snake": ["action-aventure"],
  "big-boss": ["action-aventure"],
  "revolver-ocelot": ["action-aventure"],
  "otacon": ["action-aventure"],
  "raiden": ["action-aventure"],
  "gray-fox": ["action-aventure"],

  // ——— Metroid ———
  "mother-brain": ["action-aventure"],
  "myles-mackenzie": ["action-aventure"],
  "sergent-duke": ["action-aventure"],
  "kraid": ["action-aventure"],
  "tokabi": ["action-aventure"],
  "sylux": ["action-aventure"],
  "armstrong": ["action-aventure"],
  "vue-995": ["action-aventure"],

  // ——— Poppy Playtime ———
  "catnap": ["horreur"],
  "prototype-experience-1006": ["horreur"],
  "huggy-wuggy": ["horreur"],
  "mommy-long-legs": ["horreur"],
  "kissy-missy": ["horreur"],
  "yarnaby": ["horreur"],
  "poppy-ludwig": ["horreur"],
  "miss-delight": ["horreur"],
  "boxy-boo": ["horreur"],
  "bunzo-bunny": ["horreur"],
  "doey-the-doughman": ["horreur"],
  "the-player": ["horreur"],
  "dr-harley-sawyer": ["horreur"],
  "pj-pug-a-pillar": ["horreur"],

  // ——— Red Dead Redemption ———
  "micah-bell": ["action-aventure"],
  "john-marston": ["action-aventure"],
  "jack-marston": ["action-aventure"],
  "arthur-morgan": ["action-aventure"],
  "bill-williamson": ["action-aventure"],
  "dutch-van-der-linde": ["action-aventure"],
  "javier-escuella": ["action-aventure"],
  "edgar-ross": ["action-aventure"],
  "agustin-allende": ["action-aventure"],

  // ——— Resident Evil ———
  "victor-gideon": ["horreur"],
  "grace-ashcroft": ["horreur"],
  "emily": ["horreur"],
  "chris-redfield": ["horreur"],
  "claire-redfield": ["horreur"],
  "jill-valentine": ["horreur"],
  "zeno": ["horreur"],
  "ada-wong": ["horreur"],
  "alyssa-ashcroft": ["horreur"],
  "hunk": ["horreur"],
  "piers-nivans": ["horreur"],
  "ethan-winters": ["horreur"],
  "billy-coen": ["horreur"],
  "helena-harper": ["horreur"],
  "carlos-oliveira": ["horreur"],
  "nathan-dempsy": ["horreur"],
  "rebecca-chambers": ["horreur"],
  "sheva-alomar": ["horreur"],
  "jake-muller": ["horreur"],
  "sherry-birkin": ["horreur"],

  // ——— Shenmue ———
  "ryo-hazuki": ["action-aventure"],
  "shenhua-ling": ["action-aventure"],
  "nozomi-harasaki": ["action-aventure"],
  "joy": ["action-aventure"],
  "iwao-hazuki": ["action-aventure"],
  "xiuying-hong": ["action-aventure"],
  "guizhang-chen": ["action-aventure"],
  "chai": ["action-aventure"],
  "longsun-zhao": ["action-aventure"],

  // ——— SoulCalibur ———
  "nightmare": ["combat"],
  "astaroth": ["combat"],
  "voldo": ["combat"],
  "heishiro-mitsurugi": ["combat"],
  "siegfried-schtauffen": ["combat"],
  "seong-mi-na": ["combat"],
  "kilik": ["combat"],
  "ivy-valentine": ["combat"],
  "yoshimitsu": ["combat"],
  "sophitia-alexandra": ["combat"],
  "taki": ["combat"],
  "raphael-sorel": ["combat"],
  "chai-xianghua": ["combat"],
  "maxi": ["combat"],
  "natsu": ["combat"],

  // ——— Star Fox ———
  "fox-mccloud": ["action-aventure"],
  "falco-lombardi": ["action-aventure"],
  "krystal": ["action-aventure"],
  "slippy-toad": ["action-aventure"],
  "peppy-hare": ["action-aventure"],

  // ——— The Legend of Zelda ———
  "revali": ["action-aventure"],
  "mipha": ["action-aventure"],
  "mineru": ["action-aventure"],
  "josha": ["action-aventure"],
  "teba": ["action-aventure"],
  "sidon": ["action-aventure"],
  "riju": ["action-aventure"],
  "rauru": ["action-aventure"],
  "jerrin": ["action-aventure"],
  "sonia": ["action-aventure"],
  "mazli": ["action-aventure"],
  "purah": ["action-aventure"],
  "impa": ["action-aventure"],
  "urbosa": ["action-aventure"],
  "yunobo": ["action-aventure"],
  "daruk": ["action-aventure"],
  "robbie": ["action-aventure"],
  "tatl": ["action-aventure"],
  "skull-kid": ["action-aventure"],
  "midna": ["action-aventure"],
  "paya": ["action-aventure"],
  "vaati": ["action-aventure"],
  "tulin": ["action-aventure"],

  // ——— The Witcher ———
  "meve-de-lyria": ["rpg"],
  "jaskier": ["rpg"],
  "eredin-breacc-glas": ["rpg"],
  "imlerith": ["rpg"],
  "caranthir-ar-feiniel": ["rpg"],
  "letho-de-guleta": ["rpg"],
  "jacques-de-aldersberg": ["rpg"],
  "azar-javed": ["rpg"],
  "triss-merigold-de-maribor": ["rpg"],

  // ——— MMO (World of Warcraft, FF XIV, Dofus, Guild Wars 2) ———
  // Rattachement volontairement exclusif : ces cartes ne sortent que du
  // booster MMO, pour que les quatre franchises forment un pool lisible.
  "arthas": ["mmo"],
  "illidan": ["mmo"],
  "sylvanas": ["mmo"],
  "thrall": ["mmo"],
  "jaina": ["mmo"],
  "anduin": ["mmo"],
  "emet-selch": ["mmo"],
  "yshtola": ["mmo"],
  "alphinaud": ["mmo"],
  "alisaie": ["mmo"],
  "estinien": ["mmo"],
  "urianger": ["mmo"],
  "goultard": ["mmo"],
  "dark-vlad": ["mmo"],
  "nox": ["mmo"],
  "joris-jurgen": ["mmo"],
  "kerubim": ["mmo"],
  "dathura": ["mmo"],
  "aurene": ["mmo"],
  "rytlock": ["mmo"],
  "caithe": ["mmo"],
  "logan-thackeray": ["mmo"],
  "zojja": ["mmo"],
  "trahearne": ["mmo"],

  // ——— Compléments MMO (octobre 2026) ———
  "tirion-fordring": ["mmo"],
  "garrosh": ["mmo"],
  "venat": ["mmo"],
  "haurchefant": ["mmo"],
  "zenos": ["mmo"],
  "aymeric": ["mmo"],
  "graha-tia": ["mmo"],
  "arpagone": ["mmo"],
  "rushu": ["mmo"],
  "palawa-joko": ["mmo"],
  "king-black-dragon": ["mmo"],
  "zamorak": ["mmo"],
  "zaros": ["mmo"],
  "wise-old-man": ["mmo"],
  "mannimarco": ["mmo"],
  "cadwell": ["mmo"],
  "kadan": ["mmo"],
  "brelshaza": ["mmo"],
  "malgus": ["mmo"],
  "satele-shan": ["mmo"],

  // ——— Vague MMO de fin octobre 2026 ———
  "kerafyrm": ["mmo"],
  "firiona-vie": ["mmo"],
  "antharas": ["mmo"],
  "baium": ["mmo"],
  "baphomet": ["mmo"],
  "valkyrie-randgris": ["mmo"],
  "black-mage": ["mmo"],
  "zakum": ["mmo"],
  "tiamat": ["mmo"],
  "marchutan": ["mmo"],
  "elion-dulas": ["mmo"],
  "jin-soyeon": ["mmo"],
  "hong-seokkeun": ["mmo"],
  "black-spirit": ["mmo"],
  "illezra": ["mmo"],
  "jack-boone": ["mmo"],
  "kirsten-geary": ["mmo"],
  "dark-falz-persona": ["mmo"],
  "conan": ["mmo"],
  "statesman": ["mmo"],
  "lord-recluse": ["mmo"],
  "ferumbras": ["mmo"],
  "avatus": ["mmo"],
  "artemis-zin": ["mmo"],

  // ——— Vague MMO de fin octobre 2026 (suite) ———
  "clockworks": ["mmo"],
  "maflon": ["mmo"],
  "tcharzanek": ["mmo"],
  "malekith": ["mmo"],
  "morgana": ["mmo"],
  "arthur-corrompu": ["mmo"],
  "kundun": ["mmo"],
  "yugo": ["mmo"],
  "qilby": ["mmo"],
  "jula": ["mmo"],
  "lex-luthor": ["mmo"],
  "brainiac": ["mmo"],
  "velskud": ["mmo"],
  "crucia": ["mmo"],
  "abhuva": ["mmo"],

  // ——— Vague MMO de fin octobre 2026 (dernière) ———
  "witch-king": ["mmo"],
  "tom-bombadil": ["mmo"],
  "xizor": ["mmo"],
  "dark-falz-pso": ["mmo"],
  "surt": ["mmo"],
  "yura": ["mmo"],
  "sage-de-licorne": ["mmo"],
  "shilen": ["mmo"],
  "antares": ["mmo"],
  "ulysse": ["mmo"],
  "reto": ["mmo"],
  "pan-gu": ["mmo"],

  // ——— Horreur (octobre 2026) ———
  "james-sunderland": ["horreur"],
  "xenomorphe": ["horreur"],
  "amanda-ripley": ["horreur"],
  "sebastian-castellanos": ["horreur"],
  "the-keeper": ["horreur"],

  // ——— Horreur (octobre 2026, suite) ———
  "trager": ["horreur"],
  "regenerateur": ["horreur"],
  "springtrap": ["horreur"],
  "wendigo": ["horreur"],
  "peintre": ["horreur"],
  "femme-cheveux-denoues": ["horreur"],
  "demon": ["horreur"],
  "ghost-face": ["horreur"],
  "simon-jarrett": ["horreur"],
  "passant": ["horreur"],

  // ——— Horreur (octobre 2026, troisième vague) ———
  "mercer": ["horreur"],
  "bete": ["horreur"],
  "demon-morsure": ["horreur"],
  "pilote": ["horreur"],
  "james-earl-cash": ["horreur"],
  "monika": ["horreur"],
  "chasseuse": ["horreur"],
  "kusabi": ["horreur"],
  "leviatan-faucheur": ["horreur"],
  "elster": ["horreur"],

  // ——— Ori (octobre 2026) ———
  "kuro": ["action-aventure", "plateforme"],
  "shriek": ["action-aventure", "plateforme"],

  // ——— Elden Ring, Bloodborne, Cyberpunk 2077 (octobre 2026) ———
  "tarnished": ["action-aventure", "rpg"],
  "ranni": ["action-aventure", "rpg"],
  "hunter-bloodborne": ["action-aventure", "rpg"],
  "v": ["rpg", "fps"],

  // ——— Skyrim, Fallout, Mass Effect, Borderlands (octobre 2026) ———
  "lydia": ["rpg", "action-aventure"],
  "maiq": ["rpg", "action-aventure"],
  "dogmeat": ["rpg", "fps"],
  "vendeur-vault-tec": ["rpg", "fps"],
  "conrad-verner": ["rpg", "fps"],
  "claptrap": ["rpg", "fps"],
  "face-mcshooty": ["rpg", "fps"],
  "jackie-welles": ["rpg", "fps"],
  "johnny-sasaki": ["action-aventure"],
  "villageois": ["action-aventure"],

  // ——— Seconds rôles et indés (octobre 2026) ———
  "louis": ["fps", "horreur"],
  "spy": ["fps"],
  "heavy": ["fps"],
  "m-qi": ["rpg", "inde"],
  "cornifer": ["action-aventure", "inde"],
  "hypnos": ["action-aventure", "inde"],
  "diable": ["plateforme"],
  "prisonnier": ["action-aventure", "inde", "plateforme"],
  "zombie-cone": ["strategie"],
  "zero": ["action-aventure", "inde", "plateforme"],
  "oie": ["inde"],

  // ——— Indés délirants (octobre 2026) ———
  "jacket": ["action-aventure", "inde"],
  "wilson": ["action-aventure", "inde"],
  "tournesol": ["strategie"],
  "imposteur": ["inde", "strategie"],
  "fall-guy": ["plateforme"],
  "pilgor": ["action-aventure", "inde"],
  "shovel-knight": ["plateforme", "action-aventure", "inde"],
  "meat-boy": ["plateforme", "inde"],
  "petit-garcon": ["plateforme", "inde"],
  "inspecteur": ["strategie", "inde"],

  // ——— Récits et curiosités (octobre 2026) ———
  "harry": ["rpg", "action-aventure"],
  "andreas": ["action-aventure", "rpg"],
  "explorateur": ["action-aventure", "inde"],
  "prince": ["action-aventure", "inde"],
  "croise": ["rpg", "action-aventure"],
  "biker": ["action-aventure", "inde"],
  "jorji": ["strategie", "inde"],
  "beatrix": ["action-aventure", "inde"],
  "jardinier": ["inde"],
  "baroness": ["plateforme"],
  "marchand": ["action-aventure"],
  "rodeur": ["action-aventure", "horreur"],

  // ——— Stratégie (octobre 2026) ———
  "tanner": ["action-aventure"],
  "thrawn": ["strategie"],
  "napoleon": ["strategie"],
  "cesar": ["strategie"],
  "duc-de-paille": ["strategie"],
};

/** Genres d'une carte (vide si la carte n'est pas rattachée). */
export function genresOf(cardId: string): GenreSlug[] {
  return CARD_GENRES[cardId] ?? [];
}

/** Identifiants des cartes rattachées à un genre. */
export function cardIdsOfGenre(slug: GenreSlug | null): string[] {
  const entries = Object.entries(CARD_GENRES);
  if (slug === null) return entries.map(([id]) => id);
  return entries.filter(([, genres]) => genres.includes(slug)).map(([id]) => id);
}
