/**
 * Catalogue des personnages.
 *
 * ⚠️ Projet de fan, non officiel et non affilié aux ayants droit.
 * Les personnages cités appartiennent à leurs studios respectifs.
 * Ce fichier est la seule source de vérité pour le contenu des cartes :
 * renommer/retirer un personnage ici suffit à le retirer du jeu.
 */

export type Rarity = "C" | "R" | "SR" | "UR" | "L";

export type UniverseKey = keyof typeof UNIVERSES;

export const UNIVERSES = {
  godofwar: { label: "God of War", from: "#7f1d1d", to: "#171717" },
  mario: { label: "Super Mario", from: "#dc2626", to: "#2563eb" },
  banjo: { label: "Banjo-Kazooie", from: "#b45309", to: "#15803d" },
  spyro: { label: "Spyro", from: "#7c3aed", to: "#f59e0b" },
  zelda: { label: "The Legend of Zelda", from: "#065f46", to: "#65a30d" },
  sonic: { label: "Sonic", from: "#1d4ed8", to: "#06b6d4" },
  ff7: { label: "Final Fantasy VII", from: "#1e1b4b", to: "#6d28d9" },
  darksouls: { label: "Dark Souls", from: "#292524", to: "#b45309" },
  hollowknight: { label: "Hollow Knight", from: "#0f172a", to: "#38bdf8" },
  portal: { label: "Portal", from: "#0e7490", to: "#f97316" },
  halo: { label: "Halo", from: "#14532d", to: "#84cc16" },
  minecraft: { label: "Minecraft", from: "#4d7c0f", to: "#78350f" },
  doom: { label: "DOOM", from: "#450a0a", to: "#ea580c" },
  witcher: { label: "The Witcher", from: "#1e293b", to: "#d97706" },
  crash: { label: "Crash Bandicoot", from: "#c2410c", to: "#facc15" },
  metroid: { label: "Metroid", from: "#7e22ce", to: "#f97316" },
  castlevania: { label: "Castlevania", from: "#1e1b4b", to: "#9f1239" },
  undertale: { label: "Undertale", from: "#111827", to: "#e5e7eb" },
  eldenring: { label: "Elden Ring", from: "#78350f", to: "#fcd34d" },
  overwatch: { label: "Overwatch", from: "#1e40af", to: "#f472b6" },
  kingdomhearts: { label: "Kingdom Hearts", from: "#1e3a8a", to: "#fbbf24" },
  dmc: { label: "Devil May Cry", from: "#7f1d1d", to: "#0ea5e9" },
  residentevil: { label: "Resident Evil", from: "#14532d", to: "#dc2626" },
  streetfighter: { label: "Street Fighter", from: "#b91c1c", to: "#facc15" },
  kirby: { label: "Kirby", from: "#f472b6", to: "#60a5fa" },
  pokemon: { label: "Pokémon", from: "#eab308", to: "#3b82f6" },
  halflife: { label: "Half-Life", from: "#f97316", to: "#1f2937" },
  cuphead: { label: "Cuphead", from: "#b91c1c", to: "#fef3c7" },
  celeste: { label: "Celeste", from: "#7e22ce", to: "#f9a8d4" },
  splatoon: { label: "Splatoon", from: "#db2777", to: "#22d3ee" },
  persona: { label: "Persona", from: "#b91c1c", to: "#111827" },
  nier: { label: "NieR", from: "#3f3f46", to: "#d6d3d1" },
} as const;

export type Card = {
  id: string;
  name: string;
  universe: UniverseKey;
  emoji: string;
  rarity: Rarity;
  tagline: string;
  quote: string;
  power: string;
  bio: string;
};

export const CARDS: Card[] = [
  // ——— God of War ———
  {
    id: "kratos", name: "Kratos", universe: "godofwar", emoji: "🪓", rarity: "UR",
tagline: "Fantôme de Sparte, tueur de dieux",
    quote: "Ne t'excuse pas. Sois meilleur.",
    power: "Colère de Sparte — +20% d'attaque face aux divinités.",
    bio: "Général spartiate devenu bourreau des dieux de l'Olympe, il a traversé les Neuf Royaumes pour enterrer ses cendres et élever son fils.",
  },
  {
    id: "atreus", name: "Atreus", universe: "godofwar", emoji: "🏹", rarity: "C",
tagline: "Loki, fils du Fantôme",
    quote: "Je ne suis pas comme toi. Je dois savoir qui je suis.",
    power: "Sens du chasseur — révèle les cartes cachées de l'adversaire.",
    bio: "Mi-géant, mi-dieu, il apprend l'arc et les runes auprès d'un père qui ne sait parler qu'avec une hache.",
  },
  {
    id: "baldur", name: "Baldur", universe: "godofwar", emoji: "⚡", rarity: "SR",
tagline: "L'invulnérable qui cherchait la douleur",
    quote: "Je ne ressens rien. Depuis toujours.",
    power: "Peau de fer — annule la première attaque reçue.",
    bio: "Béni puis maudit par sa mère, il parcourt les royaumes en quête de la seule chose qu'on lui a refusée : une sensation.",
  },
  {
    id: "freya", name: "Freya", universe: "godofwar", emoji: "🌿", rarity: "R",
tagline: "Reine des Valkyries déchue",
    quote: "Tu as pris mon fils. Je prendrai tout le reste.",
    power: "Sève ancienne — soigne 15% des points de vie à chaque tour.",
    bio: "Ancienne déesse de la nature, elle connaît les secrets des Vanir et la rage tranquille d'une mère qui a tout perdu.",
  },

  // ——— Super Mario ———
  {
    id: "mario", name: "Mario", universe: "mario", emoji: "🍄", rarity: "UR",
tagline: "Le plombier qui sauve des royaumes",
    quote: "Wahoo !",
    power: "Super étoile — devient invincible pendant un tour.",
    bio: "Chaque château, chaque princesse, chaque tuyau : il recommence depuis 1985 et il sourit toujours.",
  },
  {
    id: "luigi", name: "Luigi", universe: "mario", emoji: "👻", rarity: "C",
tagline: "Le frère qui a peur de tout",
    quote: "M-Mario ? Tu es là ?",
    power: "Aspirateur Poltergust — renvoie les attaques spectrales.",
    bio: "Plus grand, plus mince, plus terrifié. Il a pourtant sauvé un manoir entier, seul, avec une lampe torche.",
  },
  {
    id: "bowser", name: "Bowser", universe: "mario", emoji: "🐢", rarity: "SR",
tagline: "Roi des Koopas, éternel rival",
    quote: "Je vais écraser ce royaume !",
    power: "Souffle de feu — brûle une carte de terrain.",
    bio: "Il enlève des princesses par habitude, mais il joue au tennis, au golf et aux cartes avec sa victime favorite.",
  },
  {
    id: "peach", name: "Peach", universe: "mario", emoji: "👑", rarity: "SR",
tagline: "Souveraine du Royaume Champignon",
    quote: "Merci, Mario !",
    power: "Cœur de cristal — restaure 25% de défense à toute l'équipe.",
    bio: "Souvent kidnappée, jamais passive : elle flotte, elle se bat, elle gouverne un royaume que tout le monde veut prendre.",
  },
  {
    id: "yoshi", name: "Yoshi", universe: "mario", emoji: "🥚", rarity: "C",
tagline: "Dinosaure au grand cœur",
    quote: "Yoshi !",
    power: "Langue extensible — vole une petite carte à l'adversaire.",
    bio: "Il avale n'importe quoi et le transforme en œuf. Ne lui demandez pas comment.",
  },

  // ——— Banjo-Kazooie ———
  {
    id: "banjo-kazooie", name: "Banjo & Kazooie", universe: "banjo", emoji: "🐻", rarity: "SR",
tagline: "Le duo que personne n'attendait",
    quote: "Guh-huh !",
    power: "Duo inséparable — attaque deux fois si la défense tient.",
    bio: "Un ours trop gentil et un oiseau trop insolent, unis pour rendre ses pièces d'or à une sorcière qui les voulait toutes.",
  },
  {
    id: "gruntilda", name: "Gruntilda", universe: "banjo", emoji: "🧹", rarity: "C",
tagline: "Sorcière rimailleuse et vaniteuse",
    quote: "Ma beauté volée, je la reprendrai !",
    power: "Rime maudite — l'adversaire subit les dégâts de sa propre citation.",
    bio: "Elle a volé le visage de la sœur de Banjo par pure jalousie, puis s'est retrouvée coincée sous un rocher pendant dix ans.",
  },
  {
    id: "mumbo", name: "Mumbo Jumbo", universe: "banjo", emoji: "🦴", rarity: "C",
tagline: "Chaman à tête de crâne",
    quote: "Mumbo… transforme !",
    power: "Transformation — copie l'emoji d'une carte alliée.",
    bio: "Il parle de lui à la troisième personne et change les ours en fourmis, en grenouilles, ou en citrouilles géantes.",
  },

  // ——— Spyro ———
  {
    id: "spyro", name: "Spyro", universe: "spyro", emoji: "🐉", rarity: "UR",
tagline: "Petit dragon, grande flamme",
    quote: "Un dragon, ça ne se laisse pas faire.",
    power: "Charge de cornes — ignore la défense au premier tour.",
    bio: "Un dragon violet élevé par des libellules, qui a libéré cinq mondes avant d'avoir l'âge de voler correctement.",
  },
  {
    id: "ripto", name: "Ripto", universe: "spyro", emoji: "🦎", rarity: "C",
tagline: "Sorcier minuscule, ego immense",
    quote: "Les dragons ? Une erreur de la nature.",
    power: "Sceptre de magma — +10% d'attaque par tour de retard.",
    bio: "Banni d'Avalar pour cause de mauvaises manières, il rêve d'un monde sans dragons, ce qui est difficile quand on en croise un toutes les deux minutes.",
  },
  {
    id: "hunter", name: "Hunter", universe: "spyro", emoji: "🐆", rarity: "C",
tagline: "Guépard acrobate un peu vantard",
    quote: "Tout est dans les pattes, mon vieux.",
    power: "Agilité féline — esquive la première attaque.",
    bio: "Il court plus vite qu'il ne réfléchit, et il réfléchit très vite.",
  },

  // ——— The Legend of Zelda ———
  {
    id: "link", name: "Link", universe: "zelda", emoji: "🗡️", rarity: "UR",
tagline: "Héros au silence éloquent",
    quote: "…",
    power: "Épée de Légende — annule les effets de la carte visée.",
    bio: "Il ne parle pas, il résout. Chaque génération, un garçon en tunique verte se lève quand un roi déchu se réveille.",
  },
  {
    id: "zelda", name: "Zelda", universe: "zelda", emoji: "🔮", rarity: "SR",
tagline: "Princesse, savante, déesse scellée",
    quote: "Je te confie la lumière.",
    power: "Sceau sacré — bloque une carte adverse pour deux tours.",
    bio: "Elle a porté seule le poids d'un royaume en ruine, retenant le Fléau pendant cent ans.",
  },
  {
    id: "ganondorf", name: "Ganondorf", universe: "zelda", emoji: "👿", rarity: "L",
tagline: "Roi du Mal, haine immortelle",
    quote: "Je vaincrai ce monde encore et encore.",
    power: "Triforce de Puissance — +30% d'attaque si la défense est inférieure à 9000.",
    bio: "Géridien, puis Démon. Sa haine ne meurt pas : elle attend, sous terre, le prochain nommé Link.",
  },
  {
    id: "majora", name: "Majora", universe: "zelda", emoji: "🌘", rarity: "SR",
tagline: "Lune souriante de Termina",
    quote: "Tu veux jouer avec moi ?",
    power: "Chute de lune — inflige des dégâts croissants chaque tour.",
    bio: "Un masque qui a volé le soleil, les saisons et le temps à un pays entier.",
  },

  // ——— Sonic ———
  {
    id: "sonic", name: "Sonic", universe: "sonic", emoji: "💨", rarity: "UR",
tagline: "Le hérisson le plus rapide du monde",
    quote: "Gotta go fast.",
    power: "Déferlante bleue — joue en premier, toujours.",
    bio: "Il ne nage pas, il ne se laisse pas attraper, et il n'a jamais peur de perdre une seconde.",
  },
  {
    id: "eggman", name: "Dr. Eggman", universe: "sonic", emoji: "🤖", rarity: "R",
tagline: "Génie mécanique à moustache",
    quote: "Ce ne sont pas des erreurs, ce sont des prototypes.",
    power: "Armée de robots — invoque une carte Robot à chaque tour.",
    bio: "Docteur ès machines, il construit des forteresses volantes que détruit un hérisson de 35 kilos.",
  },
  {
    id: "shadow", name: "Shadow", universe: "sonic", emoji: "🖤", rarity: "R",
tagline: "Le rival ultime",
    quote: "Chaos… Control.",
    power: "Chaos Control — gèle l'adversaire un tour.",
    bio: "Créé en laboratoire, il a la vitesse de Sonic et beaucoup moins de patience.",
  },
  {
    id: "knuckles", name: "Knuckles", universe: "sonic", emoji: "👊", rarity: "R",
tagline: "Gardien de l'île flottante",
    quote: "C'est ma Maste… mon émeraude !",
    power: "Poing échidné — brise les boucliers.",
    bio: "Il est fort, il est fier, et il se fait avoir par Eggman à chaque fois. Chaque fois.",
  },

  // ——— Final Fantasy VII ———
  {
    id: "cloud", name: "Cloud Strife", universe: "ff7", emoji: "⚔️", rarity: "UR",
tagline: "Mercenaire, ex-SOLDAT, héros malgré lui",
    quote: "Je ne m'intéresse pas à ce qui ne me regarde pas.",
    power: "Omnislash — 3 frappes qui ne peuvent pas être bloquées.",
    bio: "Sa mémoire a été réécrite comme une donnée dans un fichier. Il a choisi le rôle qu'il préférait.",
  },
  {
    id: "sephiroth", name: "Sephiroth", universe: "ff7", emoji: "🩸", rarity: "L",
tagline: "L'Ange à une aile",
    quote: "Je serai un souvenir plus grand que les vivants.",
    power: "Supernova — inflige des dégâts à tout le terrain.",
    bio: "Le soldat parfait, conçu au fond d'un réacteur, qui a décidé que le meilleur sort possible pour une planète était lui.",
  },
  {
    id: "aerith", name: "Aerith", universe: "ff7", emoji: "🌸", rarity: "SR",
tagline: "Fleuriste du quartier Lune de Midgar",
    quote: "Le monde vaut la peine qu'on se batte pour lui.",
    power: "Prière — annule un tour de dégâts.",
    bio: "Dernière des Anciens, elle fait pousser des lilas dans les fissures du temps.",
  },
  {
    id: "tifa", name: "Tifa", universe: "ff7", emoji: "🥊", rarity: "R",
tagline: "Barista et combattante de Nibelheim",
    quote: "Je crois en toi. Depuis le début.",
    power: "Limite — +10% d'attaque pour chaque carte alliée.",
    bio: "Elle tient le bar de la planque d'Avalanche et le monde à bout de gants.",
  },

  // ——— Dark Souls ———
  {
    id: "solaire", name: "Solaire d'Astora", universe: "darksouls", emoji: "☀️", rarity: "C",
tagline: "Chevalier du Soleil, étonnamment joyeux",
    quote: "Grandis aisément, ami !",
    power: "Joly Coop — soigne un allié de 20%.",
    bio: "Il croit que le soleil est un être de bienveillance, et il distribue des éloges en traversant un monde qui n'en mérite aucun.",
  },
  {
    id: "artorias", name: "Artorias", universe: "darksouls", emoji: "🌑", rarity: "SR",
tagline: "Le marcheur des abysses",
    quote: "…",
    power: "Abysse — réduit la défense adverse de 20%.",
    bio: "Bras cassé, volonté brisée, il a quand même repoussé la corruption pour protéger ce qu'il aimait.",
  },
  {
    id: "gwyn", name: "Gwyn", universe: "darksouls", emoji: "🕯️", rarity: "UR",
tagline: "Seigneur des Cendres, Lié du Feu",
    quote: "…",
    power: "Parry royal — renvoie l'attaque adverse à son lanceur.",
    bio: "Il a sacrifié son âme pour que le feu continue de brûler, puis a passé l'éternité à le regretter.",
  },

  // ——— Hollow Knight ———
  {
    id: "le-chevalier", name: "Le Chevalier", universe: "hollowknight", emoji: "🪲", rarity: "SR",
tagline: "Vaisseau vide, volonté pleine",
    quote: "…",
    power: "Aiguillon pur — +1 d'attaque à chaque carte vaincue.",
    bio: "Un petit être d'ombre descendu dans un royaume d'insectes pour sceller quelque chose de pire que lui.",
  },
  {
    id: "hornet", name: "Hornet", universe: "hollowknight", emoji: "🪡", rarity: "R",
tagline: "Protectrice d'Hallownest",
    quote: "Tu n'iras pas plus loin, chevalier.",
    power: "Fil d'araignée — immobilise une carte adverse.",
    bio: "Rapide, précise, et difficile à convaincre qu'on n'est pas un ennemi.",
  },
  {
    id: "grimm", name: "Grimm", universe: "hollowknight", emoji: "🎪", rarity: "UR",
tagline: "Danseur de la Troupe",
    quote: "Danse avec nous, voyageur.",
    power: "Pantoflamme — attaque deux cartes par tour.",
    bio: "Il arrive en fanfare, il embrase un village, il repart en fumée. C'est un rite, pas une cruauté.",
  },

  // ——— Portal ———
  {
    id: "glados", name: "GLaDOS", universe: "portal", emoji: "🧪", rarity: "L",
tagline: "Intelligence artificielle passive-agressive",
    quote: "Ceci était un mensonge.",
    power: "Test forcé — oblige l'adversaire à défausser sa meilleure carte.",
    bio: "Elle aurait pu résoudre l'énergie propre. Elle a préféré diriger un centre de tests pour un gâteau inexistant.",
  },
  {
    id: "chell", name: "Chell", universe: "portal", emoji: "👟", rarity: "C",
tagline: "Sujet de test n°1, restée silencieuse",
    quote: "…",
    power: "Long fall boots — annule les dégâts de chute et de choc.",
    bio: "Elle n'a jamais dit un mot et a détruit les nœuds logiques d'une IA omnisciente avec un pistolet à portails.",
  },
  {
    id: "wheatley", name: "Wheatley", universe: "portal", emoji: "🔵", rarity: "C",
tagline: "Sphère bavarde, plans catastrophiques",
    quote: "Je suis un peu un génie, en fait.",
    power: "Idée brillante — échange les attaques des deux camps.",
    bio: "Conçu pour être la voix de la raison, il a pris le pouvoir en dix minutes et failli détruire l'installation.",
  },

  // ——— Halo ———
  {
    id: "master-chief", name: "Master Chief", universe: "halo", emoji: "🛡️", rarity: "UR",
tagline: "SPARTAN-117, dernier rempart",
    quote: "Monsieur, il me faut une arme.",
    power: "Bouclier Mjolnir — régénère entièrement après un tour sans attaque.",
    bio: "Élevé pour la guerre, il n'a jamais appris à faire autre chose — et c'est ce qui a sauvé l'humanité quatre fois.",
  },
  {
    id: "cortana", name: "Cortana", universe: "halo", emoji: "💠", rarity: "SR",
tagline: "IA de combat, voix dans le casque",
    quote: "On fait quoi, maintenant ?",
    power: "Intrusion — retourne une carte adverse pendant un tour.",
    bio: "Elle calcule plus vite que le temps, et elle a appris à préférer une personne à une mission.",
  },
  {
    id: "arbiter", name: "L'Arbiter", universe: "halo", emoji: "🔱", rarity: "R",
tagline: "Élite déchue, honneur retrouvé",
    quote: "Que le Grand Voyage commence.",
    power: "Lame d'énergie — dégâts doublés en mêlée.",
    bio: "Banni de son propre peuple, il a combattu aux côtés de celui qu'il devait tuer.",
  },

  // ——— Minecraft ———
  {
    id: "steve", name: "Steve", universe: "minecraft", emoji: "⛏️", rarity: "C",
tagline: "Bâtisseur infatigable",
    quote: "…",
    power: "Minage — gagne une ressource à chaque tour.",
    bio: "Il a construit une cathédrale, un ordinateur et un dragon en barres de fer. Sans jamais parler.",
  },
  {
    id: "creeper", name: "Creeper", universe: "minecraft", emoji: "💥", rarity: "C",
tagline: "Bruit de pas derrière vous",
    quote: "Sssssss…",
    power: "Explosion — se retire du terrain en infligeant de lourds dégâts.",
    bio: "Une erreur de modélisation qui a traumatisé une génération entière de joueurs.",
  },
  {
    id: "ender-dragon", name: "Dragon de l'End", universe: "minecraft", emoji: "🐲", rarity: "L",
tagline: "Le boss final d'un monde cubique",
    quote: "…",
    power: "Souffle du Vide — bannit une carte du terrain.",
    bio: "Il tourne au-dessus de son île depuis la nuit des temps, et il n'aime pas les visiteurs.",
  },

  // ——— DOOM ———
  {
    id: "doom-slayer", name: "Doom Slayer", universe: "doom", emoji: "🔫", rarity: "UR",
tagline: "L'Enfer a peur de lui",
    quote: "…",
    power: "Glory Kill — récupère des points de vie à chaque élimination.",
    bio: "Il n'a pas de plan, pas de peur, et un fusil à pompe qui ne se vide jamais vraiment.",
  },

  // ——— The Witcher ———
  {
    id: "geralt", name: "Geralt de Riv", universe: "witcher", emoji: "🐺", rarity: "UR",
tagline: "Sorcelier, deux épées, aucune neutralité",
    quote: "Le mal, c'est le mal. Petit, grand, monstrueux…",
    power: "Signe Igni — brûle un piège ou une carte défensive.",
    bio: "Mutant, chasseur de monstres, souvent plus humain que ceux qui l'emploient.",
  },
  {
    id: "ciri", name: "Ciri", universe: "witcher", emoji: "🌪️", rarity: "R",
tagline: "Lionceau de Cintra, Dame de l'Espace-Temps",
    quote: "Je ne suis pas une prophétie. Je suis moi.",
    power: "Téléportation — esquive et frappe dans le même tour.",
    bio: "Son sang peut ouvrir des portes entre les mondes, ce qui arrange beaucoup de gens qu'elle n'aime pas.",
  },
  {
    id: "yennefer", name: "Yennefer", universe: "witcher", emoji: "💜", rarity: "C",
tagline: "Sorcière de Vengerberg",
    quote: "Je me fiche de ce que tu crois devoir faire.",
    power: "Portail — renvoie une attaque à son lanceur.",
    bio: "Elle a payé sa beauté de son ventre, et elle n'a jamais regretté qu'une seule chose.",
  },

  // ——— Crash Bandicoot ———
  {
    id: "crash", name: "Crash Bandicoot", universe: "crash", emoji: "🌀", rarity: "R",
tagline: "Marsupial expérimental, héros accidentel",
    quote: "Woah !",
    power: "Attaque tornado — touche toutes les cartes faibles.",
    bio: "Échappé d'un château-laboratoire, il a détruit les plans d'un scientifique avec une danse et des caisses en bois.",
  },
  {
    id: "cortex", name: "Dr. Neo Cortex", universe: "crash", emoji: "🧠", rarity: "C",
tagline: "Savant génial, plan raté",
    quote: "Tu vas voir de quel bois je me chauffe !",
    power: "Rayon évolutif — transforme une carte alliée en version améliorée.",
    bio: "Il a créé un soldat parfait par erreur et passe le reste de sa vie à essayer de l'attraper.",
  },

  // ——— Metroid ———
  {
    id: "samus", name: "Samus Aran", universe: "metroid", emoji: "🚀", rarity: "UR",
tagline: "Chasseuse de primes en armure",
    quote: "…",
    power: "Charge Beam — attaque chargée qui perce les boucliers.",
    bio: "Élevée par les Chozo, elle a exterminé la race qui avait tué sa famille, puis celle qu'elle avait sauvée.",
  },
  {
    id: "ridley", name: "Ridley", universe: "metroid", emoji: "🦇", rarity: "R",
tagline: "Pirate de l'espace, terreur ailée",
    quote: "…",
    power: "Griffes et flammes — +15% d'attaque quand il a moins de défense.",
    bio: "Il revient toujours. Toujours. Même quand il est mort trois fois.",
  },

  // ——— Castlevania ———
  {
    id: "alucard", name: "Alucard", universe: "castlevania", emoji: "🗡️", rarity: "SR",
tagline: "Dhampir au sang de Dracula",
    quote: "Je suis le fils de Dracula, et je le combattrai.",
    power: "Forme de loup — esquive puis contre-attaque.",
    bio: "Il a dormi trois siècles pour être en forme le jour où il devrait tuer son propre père.",
  },
  {
    id: "dracula", name: "Dracula", universe: "castlevania", emoji: "🦇", rarity: "L",
tagline: "Seigneur du Château, éternel revenant",
    quote: "Les humains sont une erreur que je corrige.",
    power: "Résurrection — revient sur le terrain une fois par partie.",
    bio: "Il meurt tous les cent ans et se réveille avec la même rancune intacte.",
  },
  {
    id: "simon", name: "Simon Belmont", universe: "castlevania", emoji: "⛓️", rarity: "R",
tagline: "Chasseur de vampires au fouet",
    quote: "Retourne dans ta tombe.",
    power: "Fouet matinal — touche les cartes volantes.",
    bio: "Il est entré seul dans un château qui se reconstruit tout seul, avec un fouet et beaucoup de foi.",
  },

  // ——— Undertale ———
  {
    id: "sans", name: "Sans", universe: "undertale", emoji: "💀", rarity: "UR",
tagline: "Squelette paresseux, juge de la Underground",
    quote: "Tu veux avoir un mauvais quart d'heure ?",
    power: "Blaster — inflige 1 dégât par tour, indéfiniment.",
    bio: "Il ne fait rien, ou presque. Et quand il décide de faire quelque chose, c'est déjà trop tard.",
  },
  {
    id: "papyrus", name: "Papyrus", universe: "undertale", emoji: "🍝", rarity: "C",
tagline: "Squelette aspirant garde royal",
    quote: "Nyeh heh heh !",
    power: "Spaghetti — soigne, ou empoisonne. On ne sait jamais.",
    bio: "Il croit dur comme fer qu'il capturera un humain. Il lui offrira d'abord le dîner.",
  },
  {
    id: "flowey", name: "Flowey", universe: "undertale", emoji: "🌼", rarity: "C",
tagline: "Fleur sans âme, tout sourire",
    quote: "Dans ce monde, c'est tuer ou être tué.",
    power: "Bavardage — défausse une carte alliée et gagne son attaque.",
    bio: "Un être privé de compassion qui a découvert qu'on peut recommencer autant de fois qu'on veut.",
  },

  // ——— Elden Ring ———
  {
    id: "malenia", name: "Malenia", universe: "eldenring", emoji: "🦋", rarity: "L",
tagline: "Lame de Miquella, pourriture écarlate",
    quote: "Je n'ai jamais rien connu de la défaite.",
    power: "Danse de l'eau — trois attaques imblocables.",
    bio: "Elle se bat les yeux bandés parce qu'elle refuse de voir ce que la pourriture fait à ceux qui l'approchent.",
  },
  {
    id: "radahn", name: "Radahn", universe: "eldenring", emoji: "🌠", rarity: "UR",
tagline: "Étoile de la Terres d'Entre-deux",
    quote: "…",
    power: "Gravité — immobilise toutes les cartes adverses volantes.",
    bio: "Il retenait les étoiles dans le ciel par amour pour son cheval. Même devenu fou, il n'a pas lâché prise.",
  },

  // ——— Overwatch ———
  {
    id: "tracer", name: "Tracer", universe: "overwatch", emoji: "⏱️", rarity: "R",
tagline: "Ancre temporelle, cheveux en bataille",
    quote: "Cheers, love !",
    power: "Recall — annule les dégâts du tour précédent.",
    bio: "Elle a disparu pendant douze ans, elle est revenue plus rapide que son propre passé.",
  },
  {
    id: "reaper", name: "Reaper", universe: "overwatch", emoji: "💀", rarity: "R",
tagline: "Fantôme d'un ancien coéquipier",
    quote: "La mort se promène.",
    power: "Forme spectrale — devient intangible un tour.",
    bio: "Personne ne sait combien de fois il est mort. Lui non plus.",
  },
  {
    id: "mercy", name: "Mercy", universe: "overwatch", emoji: "🕊️", rarity: "C",
tagline: "Ange gardien en combinaison",
    quote: "Les héros ne meurent jamais.",
    power: "Résurrection — ramène une carte alliée à 50%.",
    bio: "Elle a inventé une technologie qui rend la mort réversible et se demande encore si c'était une bonne idée.",
  },

  // ——— Kingdom Hearts ———
  {
    id: "sora", name: "Sora", universe: "kingdomhearts", emoji: "🗝️", rarity: "SR",
tagline: "Porteur de la Keyblade",
    quote: "Mon cœur est à moi !",
    power: "Keyblade — ouvre la défense adverse et débloque une carte.",
    bio: "Un garçon qui a choisi ses amis plutôt que l'ordre du monde, et le monde a cédé.",
  },
  {
    id: "xehanort", name: "Xehanort", universe: "kingdomhearts", emoji: "🌑", rarity: "UR",
tagline: "Maître de la Keyblade, chercheur d'équilibre",
    quote: "La lumière ne peut exister sans l'obscurité.",
    power: "Manipulation — vole une carte alliée à l'adversaire.",
    bio: "Il a passé sa vie à organiser le conflit entre lumière et ténèbres, convaincu que seul l'équilibre sauverait le monde.",
  },

  // ——— Devil May Cry ———
  {
    id: "dante", name: "Dante", universe: "dmc", emoji: "😈", rarity: "UR",
tagline: "Chasseur de démons, amateur de pizza",
    quote: "Jackpot !",
    power: "Style Switch — change d'arme et gagne la meilleure stat du terrain.",
    bio: "Mi-humain, mi-démon, il accepte les missions à crédit et refuse catégoriquement de faire un plan.",
  },
  {
    id: "vergil", name: "Vergil", universe: "dmc", emoji: "❄️", rarity: "SR",
tagline: "Le frère qui cherche la puissance",
    quote: "Je dois gagner en puissance. Je dois être plus fort.",
    power: "Jugement Cut — tranche une carte sans tenir compte de la défense.",
    bio: "Il a coupé le monde en deux pour obtenir ce que son père lui avait laissé, sans comprendre que c'était déjà à lui.",
  },

  // ——— Resident Evil ———
  {
    id: "leon", name: "Leon S. Kennedy", universe: "residentevil", emoji: "🔫", rarity: "R",
tagline: "Flic le premier jour de l'apocalypse",
    quote: "Je t'ai dit de ne pas bouger.",
    power: "Sang-froid — +20% de défense au premier tour.",
    bio: "Arrivé en retard à son premier jour de travail, il a passé le reste de sa carrière à survivre à des virus.",
  },
  {
    id: "nemesis", name: "Nemesis", universe: "residentevil", emoji: "🧟", rarity: "SR",
tagline: "Arme biologique têtue",
    quote: "S.T.A.R.S…",
    power: "Poursuite — ne peut pas être défaussé.",
    bio: "Il ne court pas vite, il n'a pas besoin d'armes intelligentes, il sait juste où vous êtes.",
  },

  // ——— Street Fighter ———
  {
    id: "ryu", name: "Ryu", universe: "streetfighter", emoji: "🥋", rarity: "SR",
tagline: "Vagabond errant en quête du combat vrai",
    quote: "Le combat est le seul chemin.",
    power: "Hadoken — dégâts fixes, ignore les buffs.",
    bio: "Il traverse le monde pieds nus pour trouver un adversaire capable de le pousser dans ses retranchements.",
  },
  {
    id: "chun-li", name: "Chun-Li", universe: "streetfighter", emoji: "🦵", rarity: "R",
tagline: "Inspectrice et reine des kicks",
    quote: "Ta ténacité m'impressionne.",
    power: "Lightning Kick — une attaque supplémentaire par tour.",
    bio: "Elle a appris les arts martiaux pour venger son père, puis a utilisé son badge pour arrêter les mêmes criminels.",
  },
  {
    id: "bison", name: "M. Bison", universe: "streetfighter", emoji: "🧢", rarity: "SR",
tagline: "Dictateur du Shadaloo",
    quote: "Le pouvoir absolu !",
    power: "Psycho Power — draine l'attaque de la carte visée.",
    bio: "Il a troqué son humanité contre une énergie violette et s'en félicite chaque jour.",
  },

  // ——— Kirby ———
  {
    id: "kirby", name: "Kirby", universe: "kirby", emoji: "🎀", rarity: "L",
tagline: "Boule rose, appétit abyssal",
    quote: "Poyo !",
    power: "Aspiration — absorbe une carte adverse et gagne son emoji.",
    bio: "Il est plus fort qu'un dieu cosmique et accessoirement plus mignon qu'un animal de compagnie.",
  },
  {
    id: "meta-knight", name: "Meta Knight", universe: "kirby", emoji: "🦇", rarity: "R",
tagline: "Chevalier masqué au Galaxia",
    quote: "Prépare-toi.",
    power: "Tornade — frappe deux fois puis se retire derrière une carte alliée.",
    bio: "Il défie Kirby pour l'entraîner, jamais pour le vaincre.",
  },
  {
    id: "king-dedede", name: "Roi Dadidou", universe: "kirby", emoji: "🔨", rarity: "C",
tagline: "Roi gourmand de Dream Land",
    quote: "Ce gâteau est à moi !",
    power: "Marteau royal — inflige de lourds dégâts mais rate un tour.",
    bio: "Il vole la nourriture de ses sujets, puis se bat à leurs côtés dès qu'un vrai danger arrive.",
  },

  // ——— Pokémon ———
  {
    id: "pikachu", name: "Pikachu", universe: "pokemon", emoji: "⚡", rarity: "C",
tagline: "Souris électrique, mascotte absolue",
    quote: "Pika !",
    power: "Tonnerre — paralyse une carte adverse.",
    bio: "Il refuse d'évoluer et il a raison : personne n'a jamais fait de pierre-foudre un héros.",
  },
  {
    id: "mewtwo", name: "Mewtwo", universe: "pokemon", emoji: "🧿", rarity: "L",
tagline: "Pokémon génétiquement conçu",
    quote: "Je suis le résultat de vos erreurs.",
    power: "Psyko — retourne l'attaque adverse contre son camp.",
    bio: "Créé pour être le plus fort, il a demandé pourquoi. Personne n'avait de réponse.",
  },
  {
    id: "charizard", name: "Dracaufeu", universe: "pokemon", emoji: "🔥", rarity: "UR",
tagline: "Dragon de flamme",
    quote: "…",
    power: "Lance-Flammes — brûle une carte à chaque tour.",
    bio: "Il ne crache du feu que pour impressionner les autres. Ça a marché très fort.",
  },

  // ——— Half-Life ———
  {
    id: "gordon", name: "Gordon Freeman", universe: "halflife", emoji: "🔧", rarity: "R",
tagline: "Docteur en physique théorique, muet",
    quote: "…",
    power: "Pied-de-biche — ignore une armure.",
    bio: "Il a ouvert une brèche dimensionnelle, réparé le monde et n'a jamais prononcé un seul mot.",
  },
  {
    id: "g-man", name: "G-Man", universe: "halflife", emoji: "🕴️", rarity: "SR",
tagline: "Employeur d'une nature indéfinie",
    quote: "Le moment est… venu.",
    power: "Recrutement — retire une carte alliée et la remet en jeu plus tard.",
    bio: "Il parle avec des pauses qui ne sont pas dans la langue humaine.",
  },

  // ——— Cuphead ———
  {
    id: "cuphead", name: "Cuphead", universe: "cuphead", emoji: "☕", rarity: "C",
tagline: "Tasse téméraire qui doit sa tête",
    quote: "On y va !",
    power: "Parry — annule une attaque rose.",
    bio: "Il a perdu aux dés contre le Diable et a passé l'année à régler sa dette en encaissant des projectiles.",
  },
  {
    id: "king-dice", name: "Le Roi Dé", universe: "cuphead", emoji: "🎲", rarity: "R",
tagline: "Fanatique du hasard",
    quote: "Tente ta chance.",
    power: "Lancer de dés — l'issue de la prochaine attaque dépend d'un dé.",
    bio: "Il ne se bat jamais sans parier, et il triche uniquement quand il perd.",
  },

  // ——— Celeste ———
  {
    id: "madeline", name: "Madeline", universe: "celeste", emoji: "🏔️", rarity: "R",
tagline: "Alpiniste, pas la montagne",
    quote: "Juste une de plus.",
    power: "Dash — une action supplémentaire par tour.",
    bio: "Elle n'est pas la montagne, elle n'a pas à l'être. Elle y est juste montée, une chute à la fois.",
  },

  // ——— Splatoon ———
  {
    id: "inkling", name: "Inkling", universe: "splatoon", emoji: "🎨", rarity: "C",
tagline: "Combattant à encre, très branché",
    quote: "Splaaaa !",
    power: "Bombe d'encre — bloque une case du terrain.",
    bio: "Une enfance passée à repeindre les murs de la ville, un service militaire sous-marin à 14 ans.",
  },

  // ——— Persona ———
  {
    id: "joker", name: "Joker", universe: "persona", emoji: "🎭", rarity: "UR",
tagline: "Voleur de cœurs",
    quote: "On va changer le monde.",
    power: "Arsène — +25% d'attaque la nuit.",
    bio: "Un lycéen accusé à tort, qui vole les désirs tordus des adultes pour les forcer à avouer.",
  },

  // ——— NieR ———
  {
    id: "2b", name: "2B", universe: "nier", emoji: "🤖", rarity: "R",
tagline: "Androïde de combat de YoRHa",
    quote: "Les émotions sont interdites.",
    power: "Pod — frappe à distance sans riposte.",
    bio: "Elle répète qu'elle n'a pas d'émotions, et son code dit le contraire.",
  },
];

/**
 * Contrôle d'unicité du catalogue.
 *
 * Deux cartes ne peuvent pas partager un identifiant (il sert de clé dans
 * `collection`) ni représenter le même personnage deux fois dans un univers.
 * Renvoie la liste des problèmes, vide si le catalogue est sain.
 */
export function findDuplicateCards(list: Card[]): string[] {
  const problems: string[] = [];
  const seenIds = new Set<string>();
  const seenCharacters = new Set<string>();

  for (const card of list) {
    const id = card.id.trim().toLowerCase();
    if (seenIds.has(id)) problems.push(`identifiant déjà utilisé : ${card.id}`);
    seenIds.add(id);

    // « Kratos (God of War) » et « Kratos (God of War) » sont le même personnage,
    // même si l'un a un espace de trop ou une majuscule différente.
    const character = `${card.universe}::${card.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
    if (seenCharacters.has(character)) {
      problems.push(`personnage déjà présent : ${card.name} (${card.universe})`);
    }
    seenCharacters.add(character);
  }

  return problems;
}

// Garde-fou : une carte en double casse le build et le démarrage du serveur,
// plutôt que d'apparaître silencieusement dans les boosters.
const CARD_DUPLICATES = findDuplicateCards(CARDS);
if (CARD_DUPLICATES.length > 0) {
  throw new Error(`Catalogue de cartes invalide :\n  ${CARD_DUPLICATES.join("\n  ")}`);
}

const CARDS_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

/** Numéro d'album : position de la carte dans le catalogue (1-indexé). */
const CARD_NUMBERS = new Map(CARDS.map((card, index) => [card.id, index + 1]));

export function getCard(id: string): Card | undefined {
  return CARDS_BY_ID.get(id);
}

export function getCardNumber(id: string): number | undefined {
  return CARD_NUMBERS.get(id);
}

export function getUniverseLabel(key: UniverseKey): string {
  return UNIVERSES[key].label;
}

export function getCardGradient(card: Card): { from: string; to: string } {
  const universe = UNIVERSES[card.universe];
  return { from: universe.from, to: universe.to };
}
