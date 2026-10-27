/**
 * Contenu éditorial des cartes (accroche, citation, pouvoir, biographie).
 *
 * ⚠️ Réservé au serveur : ne jamais importer ce module depuis un composant
 * client. La fiche /card/[id] ne l'envoie au navigateur que lorsque le joueur
 * possède la carte, pour que le texte verrouillé ne traîne pas dans le code
 * de la page.
 */

import { ATELIER_LORE } from "./atelier-lore";

export type CardLore = {
  tagline: string;
  /** Citation et pouvoir restent optionnels : certaines fiches n'ont que l'essentiel. */
  quote?: string;
  power?: string;
  bio: string;
};

const BASE_CARD_LORE: Record<string, CardLore> = {
  "kratos": {
    tagline: "Fantôme de Sparte, tueur de dieux",
    quote: "Ne t'excuse pas. Sois meilleur.",
    power: "Colère de Sparte — +20% d'attaque face aux divinités.",
    bio: "Général spartiate devenu bourreau des dieux de l'Olympe, il a traversé les Neuf Royaumes pour enterrer ses cendres et élever son fils.",
  },
  "atreus": {
    tagline: "Loki, fils du Fantôme",
    quote: "Je ne suis pas comme toi. Je dois savoir qui je suis.",
    power: "Sens du chasseur — révèle les cartes cachées de l'adversaire.",
    bio: "Mi-géant, mi-dieu, il apprend l'arc et les runes auprès d'un père qui ne sait parler qu'avec une hache.",
  },
  "baldur": {
    tagline: "L'invulnérable qui cherchait la douleur",
    quote: "Je ne ressens rien. Depuis toujours.",
    power: "Peau de fer — annule la première attaque reçue.",
    bio: "Béni puis maudit par sa mère, il parcourt les royaumes en quête de la seule chose qu'on lui a refusée : une sensation.",
  },
  "freya": {
    tagline: "Reine des Valkyries déchue",
    quote: "Tu as pris mon fils. Je prendrai tout le reste.",
    power: "Sève ancienne — soigne 15% des points de vie à chaque tour.",
    bio: "Ancienne déesse de la nature, elle connaît les secrets des Vanir et la rage tranquille d'une mère qui a tout perdu.",
  },
  "mario": {
    tagline: "Le plombier qui sauve des royaumes",
    quote: "Wahoo !",
    power: "Super étoile — devient invincible pendant un tour.",
    bio: "Chaque château, chaque princesse, chaque tuyau : il recommence depuis 1985 et il sourit toujours.",
  },
  "luigi": {
    tagline: "Le frère qui a peur de tout",
    quote: "M-Mario ? Tu es là ?",
    power: "Aspirateur Poltergust — renvoie les attaques spectrales.",
    bio: "Plus grand, plus mince, plus terrifié. Il a pourtant sauvé un manoir entier, seul, avec une lampe torche.",
  },
  "bowser": {
    tagline: "Roi des Koopas, éternel rival",
    quote: "Je vais écraser ce royaume !",
    power: "Souffle de feu — brûle une carte de terrain.",
    bio: "Il enlève des princesses par habitude, mais il joue au tennis, au golf et aux cartes avec sa victime favorite.",
  },
  "peach": {
    tagline: "Souveraine du Royaume Champignon",
    quote: "Merci, Mario !",
    power: "Cœur de cristal — restaure 25% de défense à toute l'équipe.",
    bio: "Souvent kidnappée, jamais passive : elle flotte, elle se bat, elle gouverne un royaume que tout le monde veut prendre.",
  },
  "yoshi": {
    tagline: "Dinosaure au grand cœur",
    quote: "Yoshi !",
    power: "Langue extensible — vole une petite carte à l'adversaire.",
    bio: "Il avale n'importe quoi et le transforme en œuf. Ne lui demandez pas comment.",
  },
  "banjo-kazooie": {
    tagline: "Le duo que personne n'attendait",
    quote: "Guh-huh !",
    power: "Duo inséparable — attaque deux fois si la défense tient.",
    bio: "Un ours trop gentil et un oiseau trop insolent, unis pour rendre ses pièces d'or à une sorcière qui les voulait toutes.",
  },
  "gruntilda": {
    tagline: "Sorcière rimailleuse et vaniteuse",
    quote: "Ma beauté volée, je la reprendrai !",
    power: "Rime maudite — l'adversaire subit les dégâts de sa propre citation.",
    bio: "Elle a volé le visage de la sœur de Banjo par pure jalousie, puis s'est retrouvée coincée sous un rocher pendant dix ans.",
  },
  "mumbo": {
    tagline: "Chaman à tête de crâne",
    quote: "Mumbo… transforme !",
    power: "Transformation — copie l'emoji d'une carte alliée.",
    bio: "Il parle de lui à la troisième personne et change les ours en fourmis, en grenouilles, ou en citrouilles géantes.",
  },
  "spyro": {
    tagline: "Petit dragon, grande flamme",
    quote: "Un dragon, ça ne se laisse pas faire.",
    power: "Charge de cornes — ignore la défense au premier tour.",
    bio: "Un dragon violet élevé par des libellules, qui a libéré cinq mondes avant d'avoir l'âge de voler correctement.",
  },
  "ripto": {
    tagline: "Sorcier minuscule, ego immense",
    quote: "Les dragons ? Une erreur de la nature.",
    power: "Sceptre de magma — +10% d'attaque par tour de retard.",
    bio: "Banni d'Avalar pour cause de mauvaises manières, il rêve d'un monde sans dragons, ce qui est difficile quand on en croise un toutes les deux minutes.",
  },
  "hunter": {
    tagline: "Guépard acrobate un peu vantard",
    quote: "Tout est dans les pattes, mon vieux.",
    power: "Agilité féline — esquive la première attaque.",
    bio: "Il court plus vite qu'il ne réfléchit, et il réfléchit très vite.",
  },
  "link": {
    tagline: "Héros au silence éloquent",
    quote: "…",
    power: "Épée de Légende — annule les effets de la carte visée.",
    bio: "Il ne parle pas, il résout. Chaque génération, un garçon en tunique verte se lève quand un roi déchu se réveille.",
  },
  "zelda": {
    tagline: "Princesse, savante, déesse scellée",
    quote: "Je te confie la lumière.",
    power: "Sceau sacré — bloque une carte adverse pour deux tours.",
    bio: "Elle a porté seule le poids d'un royaume en ruine, retenant le Fléau pendant cent ans.",
  },
  "ganondorf": {
    tagline: "Roi du Mal, haine immortelle",
    quote: "Je vaincrai ce monde encore et encore.",
    power: "Triforce de Puissance — +30% d'attaque si la défense est inférieure à 9000.",
    bio: "Géridien, puis Démon. Sa haine ne meurt pas : elle attend, sous terre, le prochain nommé Link.",
  },
  "majora": {
    tagline: "Lune souriante de Termina",
    quote: "Tu veux jouer avec moi ?",
    power: "Chute de lune — inflige des dégâts croissants chaque tour.",
    bio: "Un masque qui a volé le soleil, les saisons et le temps à un pays entier.",
  },
  "sonic": {
    tagline: "Le hérisson le plus rapide du monde",
    quote: "Gotta go fast.",
    power: "Déferlante bleue — joue en premier, toujours.",
    bio: "Il ne nage pas, il ne se laisse pas attraper, et il n'a jamais peur de perdre une seconde.",
  },
  "eggman": {
    tagline: "Génie mécanique à moustache",
    quote: "Ce ne sont pas des erreurs, ce sont des prototypes.",
    power: "Armée de robots — invoque une carte Robot à chaque tour.",
    bio: "Docteur ès machines, il construit des forteresses volantes que détruit un hérisson de 35 kilos.",
  },
  "shadow": {
    tagline: "Le rival ultime",
    quote: "Chaos… Control.",
    power: "Chaos Control — gèle l'adversaire un tour.",
    bio: "Créé en laboratoire, il a la vitesse de Sonic et beaucoup moins de patience.",
  },
  "knuckles": {
    tagline: "Gardien de l'île flottante",
    quote: "C'est ma Maste… mon émeraude !",
    power: "Poing échidné — brise les boucliers.",
    bio: "Il est fort, il est fier, et il se fait avoir par Eggman à chaque fois. Chaque fois.",
  },
  "cloud": {
    tagline: "Mercenaire, ex-SOLDAT, héros malgré lui",
    quote: "Je ne m'intéresse pas à ce qui ne me regarde pas.",
    power: "Omnislash — 3 frappes qui ne peuvent pas être bloquées.",
    bio: "Sa mémoire a été réécrite comme une donnée dans un fichier. Il a choisi le rôle qu'il préférait.",
  },
  "sephiroth": {
    tagline: "L'Ange à une aile",
    quote: "Je serai un souvenir plus grand que les vivants.",
    power: "Supernova — inflige des dégâts à tout le terrain.",
    bio: "Le soldat parfait, conçu au fond d'un réacteur, qui a décidé que le meilleur sort possible pour une planète était lui.",
  },
  "aerith": {
    tagline: "Fleuriste du quartier Lune de Midgar",
    quote: "Le monde vaut la peine qu'on se batte pour lui.",
    power: "Prière — annule un tour de dégâts.",
    bio: "Dernière des Anciens, elle fait pousser des lilas dans les fissures du temps.",
  },
  "tifa": {
    tagline: "Barista et combattante de Nibelheim",
    quote: "Je crois en toi. Depuis le début.",
    power: "Limite — +10% d'attaque pour chaque carte alliée.",
    bio: "Elle tient le bar de la planque d'Avalanche et le monde à bout de gants.",
  },
  "solaire": {
    tagline: "Chevalier du Soleil, étonnamment joyeux",
    quote: "Grandis aisément, ami !",
    power: "Joly Coop — soigne un allié de 20%.",
    bio: "Il croit que le soleil est un être de bienveillance, et il distribue des éloges en traversant un monde qui n'en mérite aucun.",
  },
  "artorias": {
    tagline: "Le marcheur des abysses",
    quote: "…",
    power: "Abysse — réduit la défense adverse de 20%.",
    bio: "Bras cassé, volonté brisée, il a quand même repoussé la corruption pour protéger ce qu'il aimait.",
  },
  "gwyn": {
    tagline: "Seigneur des Cendres, Lié du Feu",
    quote: "…",
    power: "Parry royal — renvoie l'attaque adverse à son lanceur.",
    bio: "Il a sacrifié son âme pour que le feu continue de brûler, puis a passé l'éternité à le regretter.",
  },
  "le-chevalier": {
    tagline: "Vaisseau vide, volonté pleine",
    quote: "…",
    power: "Aiguillon pur — +1 d'attaque à chaque carte vaincue.",
    bio: "Un petit être d'ombre descendu dans un royaume d'insectes pour sceller quelque chose de pire que lui.",
  },
  "hornet": {
    tagline: "Protectrice d'Hallownest",
    quote: "Tu n'iras pas plus loin, chevalier.",
    power: "Fil d'araignée — immobilise une carte adverse.",
    bio: "Rapide, précise, et difficile à convaincre qu'on n'est pas un ennemi.",
  },
  "grimm": {
    tagline: "Danseur de la Troupe",
    quote: "Danse avec nous, voyageur.",
    power: "Pantoflamme — attaque deux cartes par tour.",
    bio: "Il arrive en fanfare, il embrase un village, il repart en fumée. C'est un rite, pas une cruauté.",
  },
  "chell": {
    tagline: "Sujet de test n°1, restée silencieuse",
    quote: "…",
    power: "Long fall boots — annule les dégâts de chute et de choc.",
    bio: "Elle n'a jamais dit un mot et a détruit les nœuds logiques d'une IA omnisciente avec un pistolet à portails.",
  },
  "wheatley": {
    tagline: "Sphère bavarde, plans catastrophiques",
    quote: "Je suis un peu un génie, en fait.",
    power: "Idée brillante — échange les attaques des deux camps.",
    bio: "Conçu pour être la voix de la raison, il a pris le pouvoir en dix minutes et failli détruire l'installation.",
  },
  "master-chief": {
    tagline: "SPARTAN-117, dernier rempart",
    quote: "Monsieur, il me faut une arme.",
    power: "Bouclier Mjolnir — régénère entièrement après un tour sans attaque.",
    bio: "Élevé pour la guerre, il n'a jamais appris à faire autre chose — et c'est ce qui a sauvé l'humanité quatre fois.",
  },
  "cortana": {
    tagline: "IA de combat, voix dans le casque",
    quote: "On fait quoi, maintenant ?",
    power: "Intrusion — retourne une carte adverse pendant un tour.",
    bio: "Elle calcule plus vite que le temps, et elle a appris à préférer une personne à une mission.",
  },
  "arbiter": {
    tagline: "Élite déchue, honneur retrouvé",
    quote: "Que le Grand Voyage commence.",
    power: "Lame d'énergie — dégâts doublés en mêlée.",
    bio: "Banni de son propre peuple, il a combattu aux côtés de celui qu'il devait tuer.",
  },
  "steve": {
    tagline: "Bâtisseur infatigable",
    quote: "…",
    power: "Minage — gagne une ressource à chaque tour.",
    bio: "Il a construit une cathédrale, un ordinateur et un dragon en barres de fer. Sans jamais parler.",
  },
  "creeper": {
    tagline: "Bruit de pas derrière vous",
    quote: "Sssssss…",
    power: "Explosion — se retire du terrain en infligeant de lourds dégâts.",
    bio: "Une erreur de modélisation qui a traumatisé une génération entière de joueurs.",
  },
  "ender-dragon": {
    tagline: "Le boss final d'un monde cubique",
    quote: "…",
    power: "Souffle du Vide — bannit une carte du terrain.",
    bio: "Il tourne au-dessus de son île depuis la nuit des temps, et il n'aime pas les visiteurs.",
  },
  "doom-slayer": {
    tagline: "L'Enfer a peur de lui",
    quote: "…",
    power: "Glory Kill — récupère des points de vie à chaque élimination.",
    bio: "Il n'a pas de plan, pas de peur, et un fusil à pompe qui ne se vide jamais vraiment.",
  },
  "geralt": {
    tagline: "Sorcelier, deux épées, aucune neutralité",
    quote: "Le mal, c'est le mal. Petit, grand, monstrueux…",
    power: "Signe Igni — brûle un piège ou une carte défensive.",
    bio: "Mutant, chasseur de monstres, souvent plus humain que ceux qui l'emploient.",
  },
  "ciri": {
    tagline: "Lionceau de Cintra, Dame de l'Espace-Temps",
    quote: "Je ne suis pas une prophétie. Je suis moi.",
    power: "Téléportation — esquive et frappe dans le même tour.",
    bio: "Son sang peut ouvrir des portes entre les mondes, ce qui arrange beaucoup de gens qu'elle n'aime pas.",
  },
  "yennefer": {
    tagline: "Sorcière de Vengerberg",
    quote: "Je me fiche de ce que tu crois devoir faire.",
    power: "Portail — renvoie une attaque à son lanceur.",
    bio: "Elle a payé sa beauté de son ventre, et elle n'a jamais regretté qu'une seule chose.",
  },
  "crash": {
    tagline: "Marsupial expérimental, héros accidentel",
    quote: "Woah !",
    power: "Attaque tornado — touche toutes les cartes faibles.",
    bio: "Échappé d'un château-laboratoire, il a détruit les plans d'un scientifique avec une danse et des caisses en bois.",
  },
  "cortex": {
    tagline: "Savant génial, plan raté",
    quote: "Tu vas voir de quel bois je me chauffe !",
    power: "Rayon évolutif — transforme une carte alliée en version améliorée.",
    bio: "Il a créé un soldat parfait par erreur et passe le reste de sa vie à essayer de l'attraper.",
  },
  "samus": {
    tagline: "Chasseuse de primes en armure",
    quote: "…",
    power: "Charge Beam — attaque chargée qui perce les boucliers.",
    bio: "Élevée par les Chozo, elle a exterminé la race qui avait tué sa famille, puis celle qu'elle avait sauvée.",
  },
  "ridley": {
    tagline: "Pirate de l'espace, terreur ailée",
    quote: "…",
    power: "Griffes et flammes — +15% d'attaque quand il a moins de défense.",
    bio: "Il revient toujours. Toujours. Même quand il est mort trois fois.",
  },
  "alucard": {
    tagline: "Dhampir au sang de Dracula",
    quote: "Je suis le fils de Dracula, et je le combattrai.",
    power: "Forme de loup — esquive puis contre-attaque.",
    bio: "Il a dormi trois siècles pour être en forme le jour où il devrait tuer son propre père.",
  },
  "dracula": {
    tagline: "Seigneur du Château, éternel revenant",
    quote: "Les humains sont une erreur que je corrige.",
    power: "Résurrection — revient sur le terrain une fois par partie.",
    bio: "Il meurt tous les cent ans et se réveille avec la même rancune intacte.",
  },
  "simon": {
    tagline: "Chasseur de vampires au fouet",
    quote: "Retourne dans ta tombe.",
    power: "Fouet matinal — touche les cartes volantes.",
    bio: "Il est entré seul dans un château qui se reconstruit tout seul, avec un fouet et beaucoup de foi.",
  },
  "sans": {
    tagline: "Squelette paresseux, juge de la Underground",
    quote: "Tu veux avoir un mauvais quart d'heure ?",
    power: "Blaster — inflige 1 dégât par tour, indéfiniment.",
    bio: "Il ne fait rien, ou presque. Et quand il décide de faire quelque chose, c'est déjà trop tard.",
  },
  "papyrus": {
    tagline: "Squelette aspirant garde royal",
    quote: "Nyeh heh heh !",
    power: "Spaghetti — soigne, ou empoisonne. On ne sait jamais.",
    bio: "Il croit dur comme fer qu'il capturera un humain. Il lui offrira d'abord le dîner.",
  },
  "flowey": {
    tagline: "Fleur sans âme, tout sourire",
    quote: "Dans ce monde, c'est tuer ou être tué.",
    power: "Bavardage — défausse une carte alliée et gagne son attaque.",
    bio: "Un être privé de compassion qui a découvert qu'on peut recommencer autant de fois qu'on veut.",
  },
  "malenia": {
    tagline: "Lame de Miquella, pourriture écarlate",
    quote: "Je n'ai jamais rien connu de la défaite.",
    power: "Danse de l'eau — trois attaques imblocables.",
    bio: "Elle se bat les yeux bandés parce qu'elle refuse de voir ce que la pourriture fait à ceux qui l'approchent.",
  },
  "radahn": {
    tagline: "Étoile de la Terres d'Entre-deux",
    quote: "…",
    power: "Gravité — immobilise toutes les cartes adverses volantes.",
    bio: "Il retenait les étoiles dans le ciel par amour pour son cheval. Même devenu fou, il n'a pas lâché prise.",
  },
  "tracer": {
    tagline: "Ancre temporelle, cheveux en bataille",
    quote: "Cheers, love !",
    power: "Recall — annule les dégâts du tour précédent.",
    bio: "Elle a disparu pendant douze ans, elle est revenue plus rapide que son propre passé.",
  },
  "reaper": {
    tagline: "Fantôme d'un ancien coéquipier",
    quote: "La mort se promène.",
    power: "Forme spectrale — devient intangible un tour.",
    bio: "Personne ne sait combien de fois il est mort. Lui non plus.",
  },
  "mercy": {
    tagline: "Ange gardien en combinaison",
    quote: "Les héros ne meurent jamais.",
    power: "Résurrection — ramène une carte alliée à 50%.",
    bio: "Elle a inventé une technologie qui rend la mort réversible et se demande encore si c'était une bonne idée.",
  },
  "sora": {
    tagline: "Porteur de la Keyblade",
    quote: "Mon cœur est à moi !",
    power: "Keyblade — ouvre la défense adverse et débloque une carte.",
    bio: "Un garçon qui a choisi ses amis plutôt que l'ordre du monde, et le monde a cédé.",
  },
  "xehanort": {
    tagline: "Maître de la Keyblade, chercheur d'équilibre",
    quote: "La lumière ne peut exister sans l'obscurité.",
    power: "Manipulation — vole une carte alliée à l'adversaire.",
    bio: "Il a passé sa vie à organiser le conflit entre lumière et ténèbres, convaincu que seul l'équilibre sauverait le monde.",
  },
  "dante": {
    tagline: "Chasseur de démons, amateur de pizza",
    quote: "Jackpot !",
    power: "Style Switch — change d'arme et gagne la meilleure stat du terrain.",
    bio: "Mi-humain, mi-démon, il accepte les missions à crédit et refuse catégoriquement de faire un plan.",
  },
  "vergil": {
    tagline: "Le frère qui cherche la puissance",
    quote: "Je dois gagner en puissance. Je dois être plus fort.",
    power: "Jugement Cut — tranche une carte sans tenir compte de la défense.",
    bio: "Il a coupé le monde en deux pour obtenir ce que son père lui avait laissé, sans comprendre que c'était déjà à lui.",
  },
  "leon": {
    tagline: "Flic le premier jour de l'apocalypse",
    quote: "Je t'ai dit de ne pas bouger.",
    power: "Sang-froid — +20% de défense au premier tour.",
    bio: "Arrivé en retard à son premier jour de travail, il a passé le reste de sa carrière à survivre à des virus.",
  },
  "nemesis": {
    tagline: "Arme biologique têtue",
    quote: "S.T.A.R.S…",
    power: "Poursuite — ne peut pas être défaussé.",
    bio: "Il ne court pas vite, il n'a pas besoin d'armes intelligentes, il sait juste où vous êtes.",
  },
  "ryu": {
    tagline: "Vagabond errant en quête du combat vrai",
    quote: "Le combat est le seul chemin.",
    power: "Hadoken — dégâts fixes, ignore les buffs.",
    bio: "Il traverse le monde pieds nus pour trouver un adversaire capable de le pousser dans ses retranchements.",
  },
  "chun-li": {
    tagline: "Inspectrice et reine des kicks",
    quote: "Ta ténacité m'impressionne.",
    power: "Lightning Kick — une attaque supplémentaire par tour.",
    bio: "Elle a appris les arts martiaux pour venger son père, puis a utilisé son badge pour arrêter les mêmes criminels.",
  },
  "bison": {
    tagline: "Dictateur du Shadaloo",
    quote: "Le pouvoir absolu !",
    power: "Psycho Power — draine l'attaque de la carte visée.",
    bio: "Il a troqué son humanité contre une énergie violette et s'en félicite chaque jour.",
  },
  "kirby": {
    tagline: "Boule rose, appétit abyssal",
    quote: "Poyo !",
    power: "Aspiration — absorbe une carte adverse et gagne son emoji.",
    bio: "Il est plus fort qu'un dieu cosmique et accessoirement plus mignon qu'un animal de compagnie.",
  },
  "meta-knight": {
    tagline: "Chevalier masqué au Galaxia",
    quote: "Prépare-toi.",
    power: "Tornade — frappe deux fois puis se retire derrière une carte alliée.",
    bio: "Il défie Kirby pour l'entraîner, jamais pour le vaincre.",
  },
  "king-dedede": {
    tagline: "Roi gourmand de Dream Land",
    quote: "Ce gâteau est à moi !",
    power: "Marteau royal — inflige de lourds dégâts mais rate un tour.",
    bio: "Il vole la nourriture de ses sujets, puis se bat à leurs côtés dès qu'un vrai danger arrive.",
  },
  "pikachu": {
    tagline: "Souris électrique, mascotte absolue",
    quote: "Pika !",
    power: "Tonnerre — paralyse une carte adverse.",
    bio: "Il refuse d'évoluer et il a raison : personne n'a jamais fait de pierre-foudre un héros.",
  },
  "mewtwo": {
    tagline: "Pokémon génétiquement conçu",
    quote: "Je suis le résultat de vos erreurs.",
    power: "Psyko — retourne l'attaque adverse contre son camp.",
    bio: "Créé pour être le plus fort, il a demandé pourquoi. Personne n'avait de réponse.",
  },
  "charizard": {
    tagline: "Dragon de flamme",
    quote: "…",
    power: "Lance-Flammes — brûle une carte à chaque tour.",
    bio: "Il ne crache du feu que pour impressionner les autres. Ça a marché très fort.",
  },
  "gordon": {
    tagline: "Docteur en physique théorique, muet",
    quote: "…",
    power: "Pied-de-biche — ignore une armure.",
    bio: "Il a ouvert une brèche dimensionnelle, réparé le monde et n'a jamais prononcé un seul mot.",
  },
  "g-man": {
    tagline: "Employeur d'une nature indéfinie",
    quote: "Le moment est… venu.",
    power: "Recrutement — retire une carte alliée et la remet en jeu plus tard.",
    bio: "Il parle avec des pauses qui ne sont pas dans la langue humaine.",
  },
  "cuphead": {
    tagline: "Tasse téméraire qui doit sa tête",
    quote: "On y va !",
    power: "Parry — annule une attaque rose.",
    bio: "Il a perdu aux dés contre le Diable et a passé l'année à régler sa dette en encaissant des projectiles.",
  },
  "king-dice": {
    tagline: "Fanatique du hasard",
    quote: "Tente ta chance.",
    power: "Lancer de dés — l'issue de la prochaine attaque dépend d'un dé.",
    bio: "Il ne se bat jamais sans parier, et il triche uniquement quand il perd.",
  },
  "madeline": {
    tagline: "Alpiniste, pas la montagne",
    quote: "Juste une de plus.",
    power: "Dash — une action supplémentaire par tour.",
    bio: "Elle n'est pas la montagne, elle n'a pas à l'être. Elle y est juste montée, une chute à la fois.",
  },
  "inkling": {
    tagline: "Combattant à encre, très branché",
    quote: "Splaaaa !",
    power: "Bombe d'encre — bloque une case du terrain.",
    bio: "Une enfance passée à repeindre les murs de la ville, un service militaire sous-marin à 14 ans.",
  },
  "joker": {
    tagline: "Voleur de cœurs",
    quote: "On va changer le monde.",
    power: "Arsène — +25% d'attaque la nuit.",
    bio: "Un lycéen accusé à tort, qui vole les désirs tordus des adultes pour les forcer à avouer.",
  },
  "2b": {
    tagline: "Androïde de combat de YoRHa",
    quote: "Les émotions sont interdites.",
    power: "Pod — frappe à distance sans riposte.",
    bio: "Elle répète qu'elle n'a pas d'émotions, et son code dit le contraire.",
  },

  // ——— Grand Theft Auto ———
  "carl-johnson": {
    tagline: "Le retour à Los Santos",
    bio: "Après cinq ans d'exil à Liberty City, il rentre à Los Santos pour l'enterrement de sa mère et trouve le quartier, la famille et le Respect en morceaux. Il lui faudra tout reprendre, rue par rue.",
  },
  "niko-bellic": {
    tagline: "Le passé qu'on ne laisse pas derrière soi",
    bio: "Ancien soldat yougoslave débarqué à Liberty City sur les promesses de son cousin, il découvre une ville où chaque faveur se paie en sang — et où la guerre qu'il fuyait l'a suivi.",
  },
  "tommy-vercetti": {
    tagline: "Quinze ans de prison, une ville à prendre",
    bio: "Libéré après avoir gardé le silence pour la famille Forelli, il débarque à Vice City bien décidé à encaisser ce qu'on lui doit. Au lieu de rendre l'argent, il prend la ville.",
  },
  "franklin-clinton": {
    tagline: "Le pilote qui voulait sortir du quartier",
    bio: "Repéreur de voitures à Vespucci, il connaît Los Santos mieux que ses habitants et cherche la sortie. Sa rencontre avec Michael lui apprend que la vraie fortune se prend à main armée, pas au volant.",
  },
  "jimmy-de-santa": {
    tagline: "Le fils qui vit par les caméras",
    bio: "Ado accro aux jeux, aux vues en ligne et aux voitures qu'il n'a pas payées, il découvre la double vie de son père et comprend surtout qu'il peut en tirer quelque chose.",
  },
  "melvin-harris": {
    tagline: "L'ambition tranquille",
    bio: "Ami d'enfance de CJ, il prêche la patience et le business à Grove Street. Ses arrangements avec la police finissent par déchirer le quartier qu'il prétendait sauver.",
  },
  "roman-bellic": {
    tagline: "Le rêve américain en version cabaret",
    bio: "Cousin de Niko, il décrit dans ses lettres un empire de taxis et de filles à Liberty City. La réalité : un appartement minuscule, un cabaret qui ne paie pas et des dettes de jeu qui remontent jusqu'à Vlad.",
  },
  "lucia-caminos": {
    tagline: "Sortie de prison, pas assagie",
    bio: "Héroïne de GTA VI, elle retrouve la liberté à Leonida avec une seule idée en tête : ne plus jamais se faire prendre. Cette fois, elle a Jason à ses côtés et un État entier à traverser.",
  },
  "jason-duval": {
    tagline: "Le passé militaire, l'avenir criminel",
    bio: "Ancien soldat devenu homme à tout faire des Keys, il vit de petits boulots et de mauvaises fréquentations. Sa rencontre avec Lucia transforme sa fuite tranquille en cavale à travers Leonida.",
  },
  "boobie-ike": {
    tagline: "La légende de Vice City",
    bio: "Figure locale de Vice City qui se comporte comme la star qu'elle croit être, elle tient un pan de l'économie de la ville — et tient absolument à ce que tout le monde le sache.",
  },
  "michael-de-santa": {
    tagline: "Le braqueur rangé des voitures",
    bio: "Villa à Rockford Hills, thérapie de couple et whisky à midi : il joue les retraités de la cambriole. Le passé finit toujours par rappeler, généralement en voiture noire et avec un agent du FIB dedans.",
  },
  "raul-bautista": {
    tagline: "Les affaires de Leonida",
    bio: "Homme de réseaux plus que de terrain, il évolue dans les sphères où l'argent de Vice City se blanchit. Dans GTA VI, il fait partie des visages que Jason et Lucia croiseront, et pas par hasard.",
  },
  "trevor-philips": {
    tagline: "Le chaos comme méthode",
    bio: "Trafic de drogue, d'armes et de rancoeurs à Sandy Shores. Pilote imprévisible et voisin détestable, il explose dès qu'on lui ment — et son association avec Michael tient sur une trahison vieille de dix ans.",
  },
  "ricardo-diaz": {
    tagline: "Le parrain de Vice City",
    bio: "Seigneur de la drogue colombien retranché dans son manoir, il emploie Tommy puis découvre trop tard à qui il avait affaire. On ne trahit pas Diaz deux fois : la première suffit.",
  },
  "little-jacob": {
    tagline: "Le weed et la parole rare",
    bio: "Dealer rasta de Liberty City devenu l'homme de main le plus fidèle de Niko. Il parle un anglais que seuls ses proches décryptent, et tire plus vite qu'il ne s'explique.",
  },
  "lance-vance": {
    tagline: "Le frère qu'on trahit",
    bio: "Flamboyant, ambitieux et persuadé d'être le génie de la fratrie, il entraîne Tommy dans sa vendetta contre Diaz. L'argent finit par séparer les deux associés.",
  },
  "dave-norton": {
    tagline: "L'agent qui protège son dossier",
    bio: "Agent du FIB, il couvre Michael depuis des années pour garder la main sur une affaire qui pourrait le faire monter. Sa loyauté a un prix, et il en négocie chaque année la hausse.",
  },
  "ken-rosenberg": {
    tagline: "L'avocat à la dérive",
    bio: "Avocat déchu de Vice City, il sert d'intermédiaire entre les familles et noie ses névroses dans la poudre. Compétent quand il est sobre, ce qui arrive de moins en moins.",
  },
  "lance-wilson": {
    tagline: "La loyauté en question",
    bio: "Membre historique de Grove Street, il s'éloigne de CJ jusqu'à la trahison ouverte, persuadé que le quartier ne lui rendra jamais tout ce qu'il lui a donné.",
  },
  "sonny-forelli": {
    tagline: "Le parrain qui réclame son dû",
    bio: "Chef de la famille Forelli à Liberty City, il a attendu quinze ans que Tommy sorte de prison. Il veut son argent, son respect, et surtout que personne n'oublie qui commande.",
  },
  "jeffrey-cross": {
    tagline: "La scène avant tout",
    bio: "Rappeur autoproclamé de Los Santos, il vole les rimes, les contrats et les featurings, convaincu que le talent finira par suivre. Il se trompe, mais il persévère.",
  },
  "dre-quan-priest": {
    tagline: "Le son de Leonida",
    bio: "Producteur et figure de la scène musicale de Vice City dans GTA VI, il tient une part de la culture locale que personne ne peut contourner — ni les artistes, ni ceux qui les financent.",
  },
  "kent-paul": {
    tagline: "Le manager de Liverpool",
    bio: "Impresario bavard qui a fait ses classes dans les clubs de Vice City avant de suivre la scène à Liberty City. Toujours à un contrat d'avance sur le scandale.",
  },
  "playboy-x": {
    tagline: "Le roi de Bohan",
    bio: "Bras droit ambitieux d'un caïd de Liberty City, il se croit promis à l'empire. Le retour de Dwayne, son ancien patron, vient lui rappeler que la place se prend, elle ne se donne pas.",
  },
  "claude": {
    tagline: "Le muet de Liberty City",
    bio: "Il n'a pas un mot pour personne et enchaîne les contrats pour les familles de Liberty City. Sa réputation tient à une seule chose : il ne laisse jamais de témoin.",
  },
  "jimmy-pegorino": {
    tagline: "Le parrain de la dernière heure",
    bio: "Vieux caïd d'Alderney, il veut finir roi avant que la justice ne referme son dossier. Pour cela, il est prêt à s'aliéner tous ceux qui pourraient encore le sauver.",
  },
  "dimitri-rascalov": {
    tagline: "La trahison méthodique",
    bio: "Il a livré Faustin puis Niko avec la même politesse administrative. Pour lui, la loyauté n'est pas une vertu mais un poste de dépense qu'on finit toujours par couper.",
  },
  "tanisha-jackson": {
    tagline: "La vie d'avant",
    bio: "Petite amie de Franklin restée à Los Santos, elle incarne l'existence rangée qu'il n'arrive ni à quitter ni à rejoindre. Elle, de son côté, a déjà tranché.",
  },
  "8-ball": {
    tagline: "Les explosifs avant la parole",
    bio: "Fournisseur d'armes et de charges de Liberty City, il ouvre la voie à Claude avec un compte à rebours pour toute conversation. Efficace, discret, jamais en retard.",
  },
  "lester-crest": {
    tagline: "Le cerveau derrière les écrans",
    bio: "Architecte des braquages de GTA V, il préfère le plan, la spéculation boursière et l'anonymat aux armes. Il ne se salit jamais les mains, ce qui ne l'empêche pas de compter les parts.",
  },
  "darko-brevic": {
    tagline: "La trahison de la guerre",
    bio: "Celui qui a livré les camarades de Niko pendant la guerre, pour une poignée de billets. Quinze ans de culpabilité ne l'ont pas rendu plus brave, seulement plus pâle.",
  },
  "cal-hampton": {
    tagline: "L'associé des Keys",
    bio: "Homme de confiance de Brian Heder dans GTA VI, il vit du trafic maritime qui remonte la côte de Leonida. Il connaît les passages que les gardes-côtes ignorent et les gens qui paient pour ça.",
  },
  "amanda-de-santa": {
    tagline: "Le mariage en décrépitude",
    bio: "Épouse de Michael, elle dépense l'argent du couple et collectionne les scandales. La thérapie conjugale est devenue chez eux un sport de contact, avec un coach très payé.",
  },
  "tracy-de-santa": {
    tagline: "L'ado qui veut exister",
    bio: "Fille de Michael, elle cherche l'attention en ligne et les petits amis douteux. Elle comprend sa famille mieux qu'elle ne le laisse paraître, ce qui ne l'empêche pas d'en profiter.",
  },
  "sean-johnson": {
    tagline: "Le quartier d'abord",
    bio: "Frère de CJ et pilier de Grove Street, il refuse de vendre le quartier et se bat pour une loyauté que les autres ont déjà monnayée. Il a raison, et ça ne sert à rien.",
  },
  "floyd-hebert": {
    tagline: "Le cousin dépassé",
    bio: "Cousin de Wade, il héberge Trevor à contrecœur dans son appartement de Vespucci. Sa vie tranquille, son travail et sa dignité partent en fumée en une semaine.",
  },
  "steve-haines": {
    tagline: "Le FIB en costume clair",
    bio: "Agent fédéral obsédé par les caméras et les affaires retentissantes, il force Michael, Franklin et Trevor à travailler pour lui. Il confond la justice et sa propre promo.",
  },
  "denise-clinton": {
    tagline: "La tante de Franklin",
    bio: "Elle a élevé Franklin à Strawberry et garde la mémoire d'un quartier que les siens ont quitté un par un. Elle sait ce que coûte chaque départ, et qui l'a payé.",
  },
  "wei-cheng": {
    tagline: "La triade de Los Santos",
    bio: "Chef de la triade chinoise de Los Santos, il traite ses affaires avec une courtoisie glaciale qui ne pardonne aucun retard. Ses interlocuteurs préfèrent généralement ne pas tester.",
  },
  "catalina": {
    tagline: "Le caractère avant tout",
    bio: "Braqueuse volcanique, elle partage la vie de Claude puis celle de CJ, et laisse derrière elle des cendres, des dettes et quelques portes défoncées.",
  },
  "ray-bulgarin": {
    tagline: "L'argent qui traverse les frontières",
    bio: "Trafiquant installé à Liberty City, il réclame une dette à Niko avec la patience d'un créancier qui n'oublie rien et ne pardonne jamais un retard de paiement.",
  },
  "frank-tenpenny": {
    tagline: "Le flic qui tient la ville",
    bio: "Inspecteur corrompu de Los Santos, il manipule les gangs pour tenir la rue et la justice pour se tenir à l'abri. Pour lui, la loi n'est qu'une question de prix.",
  },
  "stretch": {
    tagline: "Le caïd de Chamberlain",
    bio: "Ancien camarade de Lamar devenu patron du quartier, il préfère les comptes et la peur aux armes. Il a compris avant tout le monde que la rue se gère comme un business.",
  },
  "miguel": {
    tagline: "Une silhouette de Leonida",
    bio: "Second rôle des affaires de Leonida dans GTA VI : il tient les comptes et les passages pendant que les stars du milieu prennent tous les risques.",
  },
  "chef": {
    tagline: "La cuisine du crime",
    bio: "Cuisinier et dealer de Sandy Shores, il fournit la méthamphétamine de Trevor et se méfie de tout le monde, y compris de ceux qui paient comptant.",
  },
  "mikhail-faustin": {
    tagline: "Le parrain qui a perdu la tête",
    bio: "Caïd russe de Broker, il ordonne l'impensable sur un coup de colère et entraîne Niko dans sa chute. Sa générosité et sa paranoïa grandissent au même rythme.",
  },
  "cesar-vialpando": {
    tagline: "Le cousin des Aztecas",
    bio: "Meneur des Aztecas à Los Santos, il aide CJ à reprendre le contrôle de la ville et finit par épouser Kendl. Le seul à peu près sain dans l'histoire.",
  },
  "lamar-davis": {
    tagline: "Le frère de toujours",
    bio: "Ami d'enfance de Franklin, il reste fidèle au quartier, aux vannes et aux mauvais plans. Il parle plus vite qu'il ne réfléchit, et ça lui coûte cher.",
  },
  "solomon-richards": {
    tagline: "Le producteur de cinéma",
    bio: "Vieux producteur hollywoodien endetté, il confie à Michael un rôle et, sans le savoir, un braquage. Il croit encore que les studios se relèvent avec de l'argent frais.",
  },
  "vladimir-glebov": {
    tagline: "Le Russe du bar",
    bio: "Petit caïd de Broker, il rançonne Niko et Roman avec la morgue d'un homme qui se croit intouchable. Son bar est son royaume, et son royaume tient en une pièce.",
  },
  "mallorie-bardas": {
    tagline: "La patronne du cabaret",
    bio: "Compagne de Roman, elle gère l'entreprise familiale avec plus de bon sens que lui et rêve d'une vie qui ne dépende pas du prochain pari de son homme.",
  },
  "luigi-goterelli": {
    tagline: "Le club de Liberty City",
    bio: "Patron du club de Portland, il distribue les sales besognes à Claude au nom de la famille Leone et se garde bien de mettre les mains dans le cambouis.",
  },
  "patrick-mcreary": {
    tagline: "Le braqueur irlandais",
    bio: "Membre de la famille McReary, il participe aux braquages de GTA IV et tient ses nerfs à coups d'humour noir. Sa famille est un piège dont il ne sortira pas indemne.",
  },
  "joey-leone": {
    tagline: "L'héritier de la famille",
    bio: "Fils de Salvatore Leone, il gère l'atelier et les contrats du clan à Liberty City. Il attend son tour avec la patience de ceux qui n'ont jamais eu à se battre pour rien.",
  },
  "brucie-kibbutz": {
    tagline: "Le bodybuildé surchauffé",
    bio: "Sosie nerveux de Liberty City, il finance ses protéines et sa caisse avec des missions pour Niko. Son vocabulaire est une langue à part entière, et il ne s'en rend pas compte.",
  },
  "juan-garcia-cortez": {
    tagline: "Le colonel de Vice City",
    bio: "Ancien colonel et trafiquant cultivé, il joue les esthètes dans sa villa et les affaires dangereuses sur les docks. Il apprécie Tommy, ce qui n'est pas forcément une bonne nouvelle.",
  },
  "dwayne-forge": {
    tagline: "Le vieux roi déchu",
    bio: "Ancien caïd de Liberty City sorti de prison sans influence ni réseau, il retrouve le goût du pouvoir grâce à Niko. Le retour est plus douloureux que la chute.",
  },
  "avery-carrington": {
    tagline: "L'arnaque immobilière",
    bio: "Promoteur véreux de Vice City, il spécule sur les terrains et laisse les autres se salir les mains. Chaque parcelle qu'il achète arrive avec un cadavre ou une dette.",
  },
  "ron-jakowski": {
    tagline: "Le complotiste de Sandy Shores",
    bio: "Voix de la radio conspirationniste locale, il suit Trevor dans ses pires idées avec l'enthousiasme d'un homme qui n'a plus rien à perdre — ni grand-chose à comprendre.",
  },
  "karen-daniels": {
    tagline: "L'agent infiltrée",
    bio: "Agent infiltrée dans les milieux criminels de Liberty City, elle change de mission et de nom plus vite que de chemise. Ses supérieurs ne savent plus très bien pour qui elle travaille.",
  },
  "brian-heder": {
    tagline: "Le trafic des Keys",
    bio: "Dans GTA VI, il règne sur la contrebande maritime des Keys depuis son chantier naval. Il embarque Jason dans ses affaires avec la désinvolture d'un homme qui ne risque jamais sa propre peau.",
  },
  "wade-hebert": {
    tagline: "Le cousin perdu",
    bio: "Cousin de Floyd, il suit Trevor avec une fidélité de chien perdu et une mémoire assez vague des événements. Il est souvent là où il ne faut pas, sans savoir comment.",
  },
  "bernie-crane": {
    tagline: "L'ancien de Liberty",
    bio: "Compagnon d'armes de Niko pendant la guerre, devenu Bernie Crane à Liberty City. Il a refait sa vie loin des Balkans et aide Niko à retrouver celui qui les a trahis.",
  },
  "devin-weston": {
    tagline: "Le raider du cinéma",
    bio: "Financier sans scrupules de Los Santos, il mise sur les studios, les actifs et les vies humaines avec le même mépris. Il ne perd jamais : il rachète.",
  },

  // ——— Final Fantasy VI ———
  "terra-branford": {
    tagline: "Mi-humaine, mi-Esper",
    bio: "Élevée par l'Empire comme une arme vivante, elle découvre l'amitié et la peur avant de comprendre ce qu'elle est. Son pouvoir détruit ce qu'elle veut protéger, et c'est exactement pour ça qu'on le lui a donné.",
  },
  "mog": {
    tagline: "Le kupo qui danse",
    bio: "Mog de la tribu de Narshe, il parle en dansant et se bat en dansant. Sous son air de peluche, c'est l'un des meilleurs soutiens de l'équipe.",
  },
  "locke-cole": {
    tagline: "Le voleur au grand cœur",
    bio: "Chasseur de trésors qui se présente comme voleur, il vole surtout pour les autres et court après une femme qu'il n'a pas pu sauver. Son sourire cache une culpabilité qu'il ne nomme jamais.",
  },
  "celes-chere": {
    tagline: "La générale qui a changé de camp",
    bio: "Générale impériale augmentée par magie, elle trahit l'Empire pour la cause des Returners. Seule survivante du cataclysme, elle porte la reconstruction du monde sur ses épaules.",
  },
  "kefka-palazzo": {
    tagline: "Le bouffon qui a gagné",
    bio: "Magicien de l'Empire rendu fou par une expérience ratée, il ne veut ni richesse ni empire : il veut voir le monde s'effondrer. Et il y parvient, ce qui le rend unique dans la série.",
  },
  "ultros": {
    tagline: "La pieuvre de service",
    bio: "Poulpe bavard embauché par l'Empire, il revient à chaque occasion pour se faire battre et insulter l'équipe. Le seul antagoniste du jeu qui soit surtout un running gag.",
  },
  "setzer-gabbiani": {
    tagline: "Le pilote qui parie tout",
    bio: "Aviateur et joueur invétéré, il mise son airship sur une partie de cartes et perd. Il rejoint la cause avec la désinvolture de celui qui mise sa vie de la même façon.",
  },
  "strago-magus": {
    tagline: "Le vieux mage bleu",
    bio: "Grand-père de Relm et dernier des Magi, il connaît les sorts des monstres pour les avoir étudiés toute sa vie. Il suit l'équipe pour protéger sa petite-fille — et pour la gloire.",
  },
  "relm-arrowny": {
    tagline: "La gamine au pinceau",
    bio: "Enfant peintre au caractère bien trempé, elle dessine ce qu'elle voit et le fige sur la toile. Elle tient tête aux adultes avec une insolence qui cache une peur très simple.",
  },
  "gogo": {
    tagline: "Le mimique",
    bio: "Être mystérieux venu d'une autre dimension, il imite les techniques de ses alliés sans jamais montrer son visage ni expliquer d'où il vient.",
  },
  "edgar-roni-figaro": {
    tagline: "Le roi aux mille outils",
    bio: "Roi de Figaro, il règne en jouant les séducteurs et les ingénieurs. Derrière la vanité, un frère qui a accepté le trône pour que Sabin puisse partir.",
  },
  "sabin-rene-figaro": {
    tagline: "Les poings du royaume",
    bio: "Prince qui a fui le château pour le monastère, il préfère ses poings aux protocoles. Il soulève des trains, retient des ruines et ne regrette rien.",
  },
  "gestahl": {
    tagline: "L'empereur magicien",
    bio: "Souverain de l'Empire, il veut fusionner magie et technologie pour dominer le monde. Il croit encore contrôler Kefka, ce qui résume assez bien son jugement.",
  },
  "shadow-2": {
    tagline: "Le ninja sans nom",
    bio: "Mercenaire masqué qui loue ses services au plus offrant et disparaît dès le travail fini. Son chien Interceptor en sait plus long que lui sur son passé.",
  },
  "cyan-garamonde": {
    tagline: "Le samouraï déchu",
    bio: "Chevalier de Doma, il a perdu sa famille et son roi face à l'Empire. Sa discipline du bushido est tout ce qui lui reste, et elle ne suffit pas.",
  },
  "gau": {
    tagline: "L'enfant sauvage",
    bio: "Élevé par les bêtes des Veldt, il apprend les techniques des monstres et parle par onomatopées. Il ne demande qu'un père.",
  },

  // ——— Final Fantasy VII ———
  "barret-wallace": {
    tagline: "Le bras de la révolte",
    bio: "Mineur de Corel devenu chef d'AVALANCHE, il veut faire tomber Shinra et ses réacteurs qui saignent la planète. Sous les cris, un père qui a tout perdu à cause d'une fusillade.",
  },
  "rufus-shinra": {
    tagline: "Le fils qui veut mieux faire",
    bio: "Héritier de Shinra, il remplace son père avec l'ambition de rendre le groupe fréquentable — en conservant les mêmes méthodes. Il finit par financer la lutte contre Sephiroth.",
  },
  "reno": {
    tagline: "Le Turc à la tignasse rouge",
    bio: "Membre des Turks, il arrondit les angles avec un sourire et une matraque électrique. Il travaille pour Shinra sans états d'âme, jusqu'à ce que ses collègues soient menacés.",
  },
  "jessie-rasberry": {
    tagline: "La mécanicienne d'AVALANCHE",
    bio: "Elle fabrique les bombes du groupe et rêve d'une carrière d'actrice. Son passé chez Shinra la rend plus lucide que les autres sur ce qu'ils détruisent vraiment.",
  },
  "yuffie-kisaragi": {
    tagline: "La ninja cleptomane",
    bio: "Princesse de Wutai en fuite, elle collectionne les matéria et les ennuis. Elle prétend ne penser qu'à son pays, mais elle pense d'abord à elle.",
  },
  "cait-sith": {
    tagline: "Le chat qui triche",
    bio: "Gros mog et chat mécanique pilotés à distance par un espion de Shinra, il rejoint le groupe sans dire pour qui il travaille. Sa loyauté se décide à la fin, pas avant.",
  },
  "jenova": {
    tagline: "La calamité venue du ciel",
    bio: "Entité extraterrestre qui a décimé les Cetra avant d'être exhumée par Shinra. Sephiroth n'est que la plus réussie de ses marionnettes.",
  },
  "zack-fair": {
    tagline: "Le héros oublié",
    bio: "Soldat de deuxième classe devenu l'ami de Cloud, il porte les rêves de ses camarades jusqu'au bout et meurt en les protégeant. Le monde ne saura jamais son nom.",
  },
  "elena": {
    tagline: "La recrue des Turks",
    bio: "Nouvelle venue chez les Turks, sérieuse jusqu'à l'excès, elle veut prouver sa valeur et se fait systématiquement dépasser par les événements.",
  },
  "cid-highwind": {
    tagline: "Le pilote qui rêve d'espace",
    bio: "Ingénieur et pilote de fusée, il a sacrifié sa carrière et sa relation amoureuse à un lancement annulé par Shinra. Il jure comme il respire.",
  },
  "vincent-valentine": {
    tagline: "Le Turc qui dort debout",
    bio: "Ancien Turk transformé par Hojo en cobaye d'expériences démoniaques, il sort de sa crypte pour régler une dette vieille de trente ans.",
  },
  "biggs": {
    tagline: "Le pilier d'AVALANCHE",
    bio: "Membre d'AVALANCHE, il suit Barret sans discuter et connaît le prix de ce qu'il fait. Il avance quand même.",
  },
  "tseng": {
    tagline: "Le chef des Turks",
    bio: "Chef des Turks, il obéit à Shinra avec une élégance glacée et une loyauté qui ne va pas toujours au bon camp.",
  },
  "wedge": {
    tagline: "Le cœur d'AVALANCHE",
    bio: "Le plus doux des membres d'AVALANCHE, il panique vite, parle trop et reste quand même. Sa peur rend son courage plus visible que celui des autres.",
  },
  "red-xiii": {
    tagline: "Le dernier des siens",
    bio: "Fils de Seto, il a passé sa vie à croire son père lâche avant de découvrir la vérité. Il garde le silence sur son âge, comme sur tout le reste.",
  },
  "rude": {
    tagline: "Le Turc aux lunettes noires",
    bio: "Partenaire taciturne de Reno, il frappe sans un mot et laisse son collègue parler. Il a un faible pour Tifa qu'il n'avouera jamais.",
  },
  "professeur-hojo": {
    tagline: "Le scientifique sans limites",
    bio: "Chercheur de Shinra, il expérimente sur les vivants avec l'enthousiasme d'un enfant et aucune considération morale. Sephiroth est son chef-d'œuvre et sa catastrophe.",
  },

  // ——— Final Fantasy IX ———
  "beate": {
    tagline: "La générale de la reine",
    bio: "Béatrix, générale d'Alexandrie, sert la reine Brahne jusqu'au moment où elle comprend ce que sa souveraine est devenue. Son sens de l'honneur finit par la retourner contre son propre camp.",
  },
  "kweena-quen": {
    tagline: "Le gourmet sans frontières",
    bio: "Quina Quen, cuisinier de la tribu Qu, voyage pour goûter à tout ce qui existe. Le monde peut bien s'effondrer : il reste des monstres à manger.",
  },
  "kuja": {
    tagline: "L'ange déchu de Terra",
    bio: "Créé par Garland pour détruire Gaia, il décide de détruire tout le monde, y compris son créateur. Sa beauté et sa cruauté sont exactement la même chose.",
  },
  "steiner-adelbert": {
    tagline: "Le chevalier au grand cœur",
    bio: "Capitaine des Pluto Knights, il applique le règlement à la lettre même quand la situation exige l'inverse. Sa loyauté à la princesse le rend plus grand que son armure.",
  },
  "freyja-crescent": {
    tagline: "La dragonnière de Burmecia",
    bio: "Chevalière de Burmecia, elle rentre d'un long voyage pour trouver sa patrie en ruines. Elle jure de la reconstruire, saut après saut.",
  },
  "eiko-carol": {
    tagline: "La dernière des Invocateurs",
    bio: "Petite fille solitaire de Madain Sari, elle invoque des créatures qui n'existent presque plus et s'invente une famille auprès de Zidane.",
  },
  "tarask-coral": {
    tagline: "Le chasseur de primes",
    bio: "Mercenaire engagé pour capturer la princesse, il reste finalement pour la bagarre. Il ne croit ni aux causes ni aux sentiments, ce qui ne l'empêche pas d'en avoir.",
  },
  "djidane-tribal": {
    tagline: "Le singe de Tantalus",
    bio: "Voleur de la troupe de Tantalus, il se prend pour le héros de l'histoire et découvre qu'il n'est qu'une pièce dans le plan de quelqu'un d'autre. Il choisit quand même d'être gentil.",
  },
  "grenat-til-alexandros-xvii": {
    tagline: "La princesse en fuite",
    bio: "Héritière d'Alexandrie, elle s'échappe du château pour voir le monde et revient reine, avec une couronne trop lourde et une promesse à tenir.",
  },
  "bibi-orunitia": {
    tagline: "Le mage noir qui doute",
    bio: "Petit être de toile et de magie fabriqué en série, il cherche ce qu'il est et découvre qu'il n'a pas beaucoup de temps. Sa question la plus simple est la plus profonde du jeu.",
  },
  "markus": {
    tagline: "Le comédien de Tantalus",
    bio: "Marcus, membre de Tantalus, participe au kidnapping raté de la princesse et se retrouve embarqué dans une aventure bien plus grande que prévu.",
  },
  "cid-fabul-ix": {
    tagline: "Le régent changé en oglop",
    bio: "Cid Fabool IX, régent de Lindblum, est transformé en oglop par sa femme furieuse. Il pilote mieux ses airships qu'il ne gère son couple.",
  },
  "branet-raza-alexandros-xvi": {
    tagline: "La reine de la guerre",
    bio: "Brahne, reine d'Alexandrie, se laisse corrompre par le pouvoir des éclats et lance son royaume dans une guerre qui la dépassera très vite.",
  },
  "garland": {
    tagline: "Le gardien de Terra",
    bio: "Créature millénaire chargée de fusionner Terra et Gaia, il fabrique des anges de la mort et considère les vies de Gaia comme de simples ressources.",
  },
  "necron": {
    tagline: "La mort qui veut en finir",
    bio: "Entité née de la peur de mourir, il veut effacer toute existence pour supprimer la souffrance. Il faut la volonté de survivre de toute une équipe pour l'en empêcher.",
  },

  // ——— Final Fantasy X ———
  "tidus": {
    tagline: "La star qui n'existe pas",
    bio: "Blitzeur de Zanarkand arraché à son rêve, il débarque à Spira en touriste et finit par comprendre qu'il est lui-même une illusion.",
  },
  "auron": {
    tagline: "Le gardien qui sait tout",
    bio: "Guerrier mort depuis dix ans, il accompagne Yuna en sachant déjà comment tout finira. Il se taît pour que les autres aient une chance de faire autrement.",
  },
  "yuna": {
    tagline: "La prêtresse qui a grandi",
    bio: "Fille de Braska, elle entreprend le pèlerinage pour vaincre Sin, comme ses parents avant elle. Elle choisit ensuite de refuser le sacrifice qu'on lui a appris.",
  },
  "seymour-guado": {
    tagline: "Le maître Guado",
    bio: "Fils d'un Guado et d'une humaine, il veut devenir Sin pour effacer la douleur d'exister. Il est persuadé d'être généreux, et c'est ce qui le rend dangereux.",
  },
  "wakka": {
    tagline: "Le capitaine des Aurochs",
    bio: "Capitaine de l'équipe de blitzball de Besaid, il croit dur comme fer aux traditions de Yevon et met longtemps à voir ce qu'elles cachent.",
  },
  "lulu": {
    tagline: "La gardienne de glace",
    bio: "Trois pèlerinages derrière elle, elle parle sec et garde les poupées de ses gardiens perdus. Son cynisme est une peine de plus.",
  },
  "kimahri-ronso": {
    tagline: "Le gardien silencieux",
    bio: "Ronso du mont Gagazet, il a été banni pour n'avoir pas fait ses preuves. Il protège Yuna pour leur montrer qu'il en est capable.",
  },
  "jecht": {
    tagline: "Le meilleur blitzeur de Zanarkand",
    bio: "Père de Tidus, il disparaît quand son fils a dix ans et reparaît sous la forme du fléau de Spira. Son rire et son assurance cachent la seule chose qu'il n'a jamais su dire.",
  },
  "braska": {
    tagline: "Le pèlerin oublié",
    bio: "Grand invokeur, il a vaincu Sin en sacrifiant sa vie et sa réputation, laissant une fille et deux gardiens se charger de la suite.",
  },
  "belgemine": {
    tagline: "La rivale d'invocation",
    bio: "Invocatrice qui affronte Yuna en duel pour lui apprendre à se battre. Elle voyage avec son propre compagnon et ne perd jamais son sourire.",
  },
  "maitre-mika": {
    tagline: "Le visage de Yevon",
    bio: "Grand Maître de Yevon, il prêche la repentance et la pureté au nom d'une religion qui a fini par avoir peur de la vérité.",
  },
  "wen-kinoc": {
    tagline: "Le chef des armées",
    bio: "Maître de Yevon et maréchal des armées de Spira, il sait qu'il faut des machines pour vaincre Sin — et que la foi doit continuer de l'ignorer.",
  },
  "rikku": {
    tagline: "L'Al Bhed qui n'a pas froid aux yeux",
    bio: "Cousine de Yuna, elle vit chez les Al Bhed et préfère les machines aux prières. Elle rejoint le pèlerinage pour sauver sa cousine, pas pour la tradition.",
  },
  "sir-jyscal-guado": {
    tagline: "Le maître de Guadosalam",
    bio: "Père de Seymour et chef des Guado, il a sacrifié la dignité de son peuple pour un mariage politique qu'il a fini par payer très cher.",
  },
  "kelk-ronso": {
    tagline: "Le chef de Gagazet",
    bio: "Chef des Ronso, sévère envers les étrangers et plus encore envers les siens, il défend le mont Gagazet en gardant ses blessures pour lui.",
  },
  "zaon": {
    tagline: "Le premier gardien",
    bio: "Compagnon de Yunalesca et premier gardien de l'histoire, il est mort en permettant la première invocation finale. Son nom a été effacé de la mémoire de Spira.",
  },
  "dona": {
    tagline: "L'invocatrice concurrente",
    bio: "Invocatrice orgueilleuse qui jalonne le pèlerinage de Yuna, elle la raille avant de subir les mêmes pertes. Elle finit par retenir la leçon.",
  },

  // ——— The Legend of Zelda ———
  "revali": {
    tagline: "Le champion de la Rito",
    bio: "Champion de la Divine Beast Vah Medoh, il est le meilleur archer des Rito et ne laisse à personne le loisir de l'oublier. Son orgueil cache une conviction sincère : il aurait suffi de lui faire confiance.",
  },
  "mipha": {
    tagline: "La championne zora",
    bio: "Championne de Vah Ruta et princesse zora, elle soigne les autres et aime Link en silence depuis l'enfance. Son sacrifice reste l'une des grandes blessures du royaume.",
  },
  "mineru": {
    tagline: "La sage de l'Esprit",
    bio: "Sœur de Rauru et sage de l'Esprit, elle confie son âme à un golem pour continuer à guider le héros des milliers d'années après sa mort.",
  },
  "josha": {
    tagline: "L'apprentie de Purah",
    bio: "Assistante de Purah, elle étudie les profondeurs et les glyphes avec l'enthousiasme d'une archéologue qui n'a pas encore compris ce qu'elle est en train de réveiller.",
  },
  "teba": {
    tagline: "L'archer rito",
    bio: "Guerrier rito, il guide Link à travers les hauteurs de la région et fait partie de ceux qui tiennent la ligne quand le ciel se déchire.",
  },
  "sidon": {
    tagline: "Le prince des Zora",
    bio: "Prince zora au sourire de publicité, il cache sous son enthousiasme la pression d'un peuple qui attend de lui qu'il sauve tout seul le domaine.",
  },
  "riju": {
    tagline: "La jeune chef gerudo",
    bio: "Cheffe des Gerudo à un âge où on lui demande déjà de sauver son peuple, elle apprend à commander en même temps qu'à douter.",
  },
  "rauru": {
    tagline: "Le premier roi d'Hyrule",
    bio: "Roi zonai, il fonde Hyrule avec Sonia et scelle Ganondorf au prix de son bras, de son royaume et de tout ce qu'il aimait.",
  },
  "jerrin": {
    tagline: "L'archéologue de Lookout Landing",
    bio: "Chercheur du nouveau Hyrule, il passe ses journées à recenser les ruines et les glyphes d'un royaume en reconstruction.",
  },
  "sonia": {
    tagline: "La reine d'Hyrule",
    bio: "Épouse de Rauru et détentrice du pouvoir du temps, elle meurt pour avoir cru qu'on pouvait raisonner Ganondorf.",
  },
  "mazli": {
    tagline: "Un visage du royaume",
    bio: "Villageois d'Hyrule, il traverse les événements de Tears of the Kingdom comme la plupart des habitants : entre les ruines, les rumeurs et l'espoir qu'on s'occupe enfin de son village.",
  },
  "purah": {
    tagline: "La scientifique d'Hyrule",
    bio: "Chercheuse sheikah spécialiste des technologies antiques, elle a rajeuni par accident et dirige la surveillance du royaume depuis Lookout Landing avec une énergie épuisante pour tous les autres.",
  },
  "impa": {
    tagline: "La chef sheikah",
    bio: "Cheffe du village sheikah et confidente de la princesse, elle manie moins bien le sabre que dans sa jeunesse mais connaît tous les secrets du royaume.",
  },
  "urbosa": {
    tagline: "La championne Gerudo",
    bio: "Championne de Vah Naboris et cheffe des Gerudo, elle traite Zelda comme une égale et la protège d'une façon que la cour n'apprécie pas toujours.",
  },
  "yunobo": {
    tagline: "Le Goron timide",
    bio: "Goron de Goron City et descendant de Daruk, il doit assumer un héritage de héros alors qu'il tremble devant à peu près tout.",
  },
  "daruk": {
    tagline: "Le champion Goron",
    bio: "Champion de Vah Rudania, colosse au cœur d'enfant, il protège ses amis en riant et meurt en les protégeant.",
  },
  "robbie": {
    tagline: "Le chercheur de Hateno",
    bio: "Chercheur du laboratoire de Hateno, il voue un culte aux technologies antiques et à Purah, dans cet ordre approximatif.",
  },
  "tatl": {
    tagline: "La fée boudeuse",
    bio: "Fée de Majora's Mask, elle accompagne Link en râlant et finit par tenir à lui beaucoup plus qu'elle ne veut l'admettre.",
  },
  "skull-kid": {
    tagline: "Le porteur du masque",
    bio: "Enfant perdu de la forêt, il vole le masque de Majora et laisse le deuil et la colère détruire Termina pendant trois jours.",
  },
  "midna": {
    tagline: "La princesse du Crépuscule",
    bio: "Souveraine du royaume du Crépuscule transformée en créature, elle se sert de Link avant de se battre à ses côtés — puis rentre chez elle, ce qui est la partie difficile.",
  },
  "paya": {
    tagline: "La gardienne sheikah",
    bio: "Petite-fille d'Impa, elle veille sur le village sheikah, tient ses archives et rougit dès que Link entre dans la pièce.",
  },
  "vaati": {
    tagline: "Le mage du vent",
    bio: "Minish devenu démon par ambition, il enlève Zelda et brise la Four Sword dans Minish Cap et Four Swords.",
  },
  "tulin": {
    tagline: "Le jeune archer rito",
    bio: "Fils de Teba, il rêve de voler seul et de prouver sa valeur ; le vent finit par lui obéir.",
  },

  // ——— Resident Evil ———
  "victor-gideon": {
    tagline: "Le chercheur de la Connections",
    bio: "Ancien scientifique d'Umbrella sur le t-Virus, il travaille désormais pour la Connections et traque les porteurs du « syndrome de Raccoon City ». Grace Ashcroft est sa cible.",
  },
  "grace-ashcroft": {
    tagline: "L'analyste du FBI",
    bio: "Analyste technique du FBI, elle est envoyée au Wrenwood Hotel, l'hôtel où sa mère a été tuée huit ans plus tôt, et remonte une piste jusqu'aux ruines de Raccoon City.",
  },
  "emily": {
    tagline: "L'enfant de Rhodes Hill",
    bio: "Petite fille enfermée dans un centre de la Connections, elle s'attache à Grace qui jure de la sortir de là — avant que la mutation ne l'emporte.",
  },
  "chris-redfield": {
    tagline: "Le pilier de la lutte anti-bioarme",
    bio: "Ancien des S.T.A.R.S., il fonde et dirige des unités anti-bioterrorisme après Raccoon City. Il survit à tout, y compris à ses propres décisions.",
  },
  "claire-redfield": {
    tagline: "La sœur qui n'a jamais reculé",
    bio: "Étudiante devenue militante, elle traverse Raccoon City pour retrouver son frère et finit par protéger une enfant au milieu de l'apocalypse.",
  },
  "jill-valentine": {
    tagline: "La maîtresse de l'évasion",
    bio: "Membre des S.T.A.R.S. et spécialiste du déminage, elle survit au manoir, à Raccoon City et à des années de captivité. Elle s'en sort toujours.",
  },
  "zeno": {
    tagline: "Le bras de la Connections",
    bio: "Agent de la Connections qui assiste Victor Gideon dans sa traque, il persuade Grace qu'elle est une création d'Oswell Spencer — et il n'est pas sûr de mentir.",
  },
  "ada-wong": {
    tagline: "L'espionne des deux camps",
    bio: "Femme de l'ombre qui travaille pour qui la paie le mieux, elle aide Leon autant qu'elle le manipule. Ses vraies motivations restent un mystère assumé.",
  },
  "alyssa-ashcroft": {
    tagline: "La journaliste de Raccoon",
    bio: "Reporter présente pendant l'effondrement de Raccoon City, elle documente l'horreur et transmet le dossier à sa fille Grace des années plus tard.",
  },
  "hunk": {
    tagline: "Le survivant de l'escouade",
    bio: "Opérateur d'Umbrella surnommé « la Mort » par ses hommes, il est le seul à revenir de chaque mission. Sa phrase tient en un constat : il survit, lui.",
  },
  "piers-nivans": {
    tagline: "Le soldat du BSAA",
    bio: "Franc-tireur du BSAA, il voue une admiration sans limite à Chris Redfield et meurt en le sauvant à Lanshiang, ce qui était très prévisible.",
  },
  "ethan-winters": {
    tagline: "Le civil qui n'aurait pas dû",
    bio: "Homme ordinaire parti chercher sa femme dans une plantation de Louisiane, il encaisse des horreurs qui auraient dû le tuer dix fois.",
  },
  "billy-coen": {
    tagline: "Le condamné du train",
    bio: "Ancien marine condamné pour meurtre, il survit à l'accident de l'Ecliptic Express et forme une alliance forcée avec Rebecca.",
  },
  "helena-harper": {
    tagline: "L'agent au passé lourd",
    bio: "Agente du Secret Service mêlée au massacre de Tall Oaks, elle entraîne Leon dans une traque pour expier sa part de responsabilité.",
  },
  "carlos-oliveira": {
    tagline: "Le mercenaire d'Umbrella",
    bio: "Membre des U.B.C.S. envoyé nettoyer Raccoon City, il comprend trop tard pour qui il travaille et choisit Jill plutôt que sa paie.",
  },
  "nathan-dempsy": {
    tagline: "Le supérieur de Grace",
    bio: "Agent spécial en charge du bureau du FBI des Midwest, il connaît le deuil de Grace et l'envoie quand même seule au Wrenwood Hotel. Sa sollicitude et ses ordres ne vont pas toujours dans le même sens.",
  },
  "rebecca-chambers": {
    tagline: "La médic des S.T.A.R.S.",
    bio: "Jeune recrue de l'équipe Bravo, spécialiste de pharmacie, elle survit au manoir puis au train et sauve les autres avec ce qu'elle a sous la main.",
  },
  "sheva-alomar": {
    tagline: "La partenaire de Chris",
    bio: "Agente du BSAA en Afrique de l'Ouest, elle connaît le terrain et les gens, et sauve Chris plus souvent qu'il ne l'admet.",
  },
  "jake-muller": {
    tagline: "Le fils de Wesker",
    bio: "Mercenaire doté d'une résistance héritée de son père, il refuse d'être défini par ce nom-là et tient à le prouver à coups de poing.",
  },
  "sherry-birkin": {
    tagline: "L'enfant du virus G",
    bio: "Fille de William Birkin, contaminée enfant et devenue agent fédéral, elle porte les stigmates de Raccoon City sans jamais s'en plaindre.",
  },

  // ——— Metroid ———
  "mother-brain": {
    tagline: "Le cerveau de Zebes",
    bio: "Intelligence artificielle organique des Pirates de l'Espace, elle dirige les opérations depuis Tourian et ne s'arrête jamais vraiment.",
  },
  "myles-mackenzie": {
    tagline: "Le marine de la Fédération",
    bio: "Membre de l'escouade envoyée avec Samus dans Metroid Prime 4, il découvre que les ordres ne couvrent jamais ce qu'on trouve sur place.",
  },
  "sergent-duke": {
    tagline: "Le sergent du peloton",
    bio: "Chef de l'escorte militaire de la Fédération, il fait la guerre avec des règles que la planète n'a visiblement pas lues.",
  },
  "kraid": {
    tagline: "La montagne de Brinstar",
    bio: "Général des Pirates de l'Espace, colosse à griffes qui garde Brinstar et se régénère plus vite qu'on ne le tue.",
  },
  "tokabi": {
    tagline: "La recrue de la Fédération",
    bio: "Soldat de la Fédération galactique, il apprend le métier dans l'ombre de Samus et comprend que personne n'est jamais préparé.",
  },
  "sylux": {
    tagline: "Le chasseur au casque",
    bio: "Chasseur de primes énigmatique, il voue une haine tenace à la Fédération et à Samus, dont il suit chaque mission de très près.",
  },
  "armstrong": {
    tagline: "Le commandant de la Fédération",
    bio: "Officier de la Fédération galactique, il coordonne les opérations lointaines avec les moyens qu'on lui donne, c'est-à-dire trop peu.",
  },
  "vue-995": {
    tagline: "L'unité d'observation",
    bio: "Drone de reconnaissance de la Fédération, il observe et rapporte — jusqu'à ce que la planète décide de couper la liaison.",
  },

  // ——— Star Fox ———
  "fox-mccloud": {
    tagline: "Le chef de Star Fox",
    bio: "Pilote d'Arwing et chef d'escadrille, il a vu son père disparaître et a monté une équipe pour ne plus jamais laisser personne derrière.",
  },
  "falco-lombardi": {
    tagline: "L'as au caractère d'acier",
    bio: "Pilote vedette de l'escadrille, il critique tout le monde et reste pourtant toujours là. Son passé de gangster ne l'a jamais quitté.",
  },
  "krystal": {
    tagline: "La télépathe de Cerinia",
    bio: "Survivante d'une planète détruite, elle manie le bâton et lit les pensées ; elle rejoint Star Fox après avoir été prisonnière d'Andross.",
  },
  "slippy-toad": {
    tagline: "Le mécanicien de l'escadrille",
    bio: "Inventeur maladroit mais indispensable, il répare les Arwings entre deux missions et se plaint du manque de reconnaissance.",
  },
  "peppy-hare": {
    tagline: "Le vétéran de l'escadrille",
    bio: "Ancien compagnon de James McCloud, il répète qu'il faut faire un tonneau et survit à tout le monde par pure prudence.",
  },

  // ——— Kirby ———
  "bandana-waddle-dee": {
    tagline: "Le Waddle Dee au bandana",
    bio: "Petit combattant à la lance, il rêve de rejoindre Kirby et de prouver que les Waddle Dees ne sont pas que des figurants.",
  },
  "marx": {
    tagline: "Le bouffon qui voulait tout",
    bio: "Boule violette à l'air inoffensif, il manipule Kirby pour obtenir le pouvoir de Nova et plonger Dream Land dans le chaos.",
  },
  "magolor": {
    tagline: "Le marchand venu d'ailleurs",
    bio: "Explorateur qui ouvre une boutique de mini-jeux à Dream Land, il cherche en réalité la couronne qui lui donnera le pouvoir d'un dieu.",
  },

  // ——— SoulCalibur ———
  "nightmare": {
    tagline: "L'âme de Soul Edge",
    bio: "Armure vivante animée par l'âme de Siegfried corrompue par Soul Edge, il n'a ni but ni pitié : seulement une faim.",
  },
  "astaroth": {
    tagline: "Le golem de Soul Edge",
    bio: "Créature d'argile fabriquée par le culte pour servir Soul Edge, il déteste les humains et sert un dieu qui le considère comme un outil.",
  },
  "voldo": {
    tagline: "Le gardien aveugle",
    bio: "Serviteur dévoué de Vercci, il garde son trésor dans les ténèbres, souple comme un serpent et fidèle à un maître mort depuis longtemps.",
  },
  "heishiro-mitsurugi": {
    tagline: "Le sabre qui cherche l'absolu",
    bio: "Samouraï itinérant, il cherche un adversaire à sa mesure et la puissance de Soul Edge pour rester invaincu.",
  },
  "siegfried-schtauffen": {
    tagline: "Le chevalier racheté",
    bio: "Il a porté Soul Edge et tué les siens sous son emprise. Devenu mercenaire, il cherche à expier en détruisant l'épée qui l'a possédé.",
  },
  "seong-mi-na": {
    tagline: "La lycéenne au bâton",
    bio: "Fille d'un maître d'armes coréen, elle s'entraîne à la naginata pour prouver qu'elle vaut mieux que l'héritage qu'on lui destine.",
  },
  "kilik": {
    tagline: "Le moine au bâton",
    bio: "Moine formé au Kali-Yuga, il a vu son monastère détruit par Soul Edge et cherche à purifier l'épée plutôt qu'à s'en emparer.",
  },
  "ivy-valentine": {
    tagline: "La comtesse au fouet-épée",
    bio: "Fille d'un alchimiste qui a travaillé sur Soul Edge, elle porte une épée-fouet vivante et cherche à comprendre l'héritage dont on l'a chargée.",
  },
  "yoshimitsu": {
    tagline: "Le ninja de Manji",
    bio: "Chef du clan Manji, voleur au service des pauvres, il manie un sabre qui boit le sang des méchants et parle aux esprits.",
  },
  "sophitia-alexandra": {
    tagline: "La boulangère d'Athènes",
    bio: "Choisie par Héphaïstos pour détruire Soul Edge, elle part en guerre en laissant ses enfants et sa boutique derrière elle.",
  },
  "taki": {
    tagline: "La chasseuse de démons",
    bio: "Ninja du clan Fuma, elle traque les démons et cherche un moyen de détruire Soul Edge sans y perdre son âme.",
  },
  "raphael-sorel": {
    tagline: "Le noble déchu",
    bio: "Aristocrate français ruiné, il veut Soul Edge pour restaurer sa maison et se moque du prix qu'il faudra payer.",
  },
  "chai-xianghua": {
    tagline: "L'héritière de la lame",
    bio: "Jeune Chinoise envoyée par sa mère pour retrouver l'Épée Sacrée, elle se bat en dansant avec une arme qui la reconnaît.",
  },
  "maxi": {
    tagline: "Le nunchaku de Ryukyu",
    bio: "Combattant de Ryukyu, il manie deux nunchakus et cherche à venger son équipage décimé par un traître.",
  },
  "natsu": {
    tagline: "L'héritière de Taki",
    bio: "Élève de Taki, elle reprend les lames jumelles et la traque des démons avec beaucoup plus d'enthousiasme que de prudence.",
  },

  // ——— The Witcher ———
  "meve-de-lyria": {
    tagline: "La reine qui ne plie pas",
    bio: "Souveraine de Lyria et Rivia, elle mène ses troupes en personne et préfère mourir debout que signer une capitulation.",
  },
  "jaskier": {
    tagline: "Le barde insupportable",
    bio: "Troubadour ambulant, il transforme les exploits de Geralt en chansons à boire et les femmes en problèmes.",
  },
  "eredin-breacc-glas": {
    tagline: "Le Roi de la Chasse",
    bio: "Chef de la Chasse Sauvage, il veut Ciri pour ouvrir les portes entre les mondes avant que le sien ne soit détruit.",
  },
  "imlerith": {
    tagline: "Le général de la Chasse",
    bio: "Général de la Chasse Sauvage, colosse casqué à la masse, il ne parle presque pas et tue sans hésiter.",
  },
  "caranthir-ar-feiniel": {
    tagline: "Le navigateur des mondes",
    bio: "Mage de la Chasse Sauvage, il ouvre les portes entre les mondes et commande la navigation de l'armée d'Eredin.",
  },
  "letho-de-guleta": {
    tagline: "Le tueur de rois",
    bio: "École de la Vipère, il a assassiné des rois pour la Loge avant de disparaître ; il négocie ensuite sa survie avec Geralt.",
  },
  "jacques-de-aldersberg": {
    tagline: "Le Grand Maître de la Rose Ardente",
    bio: "Chef de l'Ordre de la Rose Ardente, il veut un monde pur et finit par en payer le prix au milieu des glaces.",
  },
  "azar-javed": {
    tagline: "Le mage de Salamandra",
    bio: "Mage dirigeant la bande de Salamandra, il expérimente sur les gens et vend les secrets des sorceleurs au plus offrant.",
  },
  "triss-merigold-de-maribor": {
    tagline: "La magicienne de Maribor",
    bio: "Magicienne proche de Geralt et de Yennefer, elle choisit souvent le camp des humains, parfois au prix de ses amis.",
  },

  // ——— Life is Strange ———
  "max-caulfield": {
    tagline: "La photographe qui remonte le temps",
    bio: "Étudiante en photographie à Blackwell, elle découvre qu'elle peut remonter le temps et apprend que chaque sauvetage a un prix.",
  },
  "chloe-price": {
    tagline: "Le chaos en jean déchiré",
    bio: "Amie d'enfance de Max, elle cherche son père disparu et un sens à sa vie, avec une énergie qui casse tout autour d'elle.",
  },
  "nathan-prescott": {
    tagline: "L'héritier qui a peur",
    bio: "Fils d'une famille qui possède la ville, il cache ses terreurs derrière la violence et les médicaments.",
  },
  "sean-diaz": {
    tagline: "Le grand frère",
    bio: "Lycéen qui fuit vers le Mexique avec son petit frère après un drame, il essaie de devenir adulte en une semaine.",
  },
  "mark-jefferson": {
    tagline: "Le photographe de Blackwell",
    bio: "Professeur de photographie admiré de tous, il collectionne les clichés — et pas seulement ceux qu'il expose.",
  },
  "safiya-llewellyn-fayyad": {
    tagline: "La star de Caledon",
    bio: "Safi, amie et ancienne élève de Max à Caledon University, est retrouvée morte dans la neige. Son meurtre est le point de départ de Double Exposure et de tout ce que Max refuse d'accepter.",
  },
  "daniel-diaz": {
    tagline: "Le petit frère qui peut tout casser",
    bio: "Il découvre un pouvoir télékinésique en fuyant avec Sean, et chaque colère devient une catastrophe.",
  },
  "alexandra-chen": {
    tagline: "L'empathie de Haven Springs",
    bio: "Alex Chen lit les émotions des autres comme des couleurs. Elle revient à Haven Springs pour retrouver son frère et se retrouve au milieu d'un secret de famille.",
  },
  "damon-merrick": {
    tagline: "Le dealer de la région",
    bio: "Dealer qui tient les environs de Haven Springs, il fait chanter les habitants et se croit intouchable.",
  },
  "hank-stamper": {
    tagline: "Le propriétaire du Bear Station",
    bio: "Patron d'une station-service perdue près du mont Rainier, il prend Sean et Daniel pour des voleurs et sort son arme. Rencontre qui donne le ton du voyage.",
  },
  "lisbeth-fischer": {
    tagline: "La pasteure de Haven Point",
    bio: "Pastor de l'Universal Uprising Church à Haven Point, elle règne sur sa communauté avec une douceur qui n'a rien d'innocent.",
  },
  "jedediah-lucan": {
    tagline: "Le patriarche de Haven",
    bio: "Père de Ryan et figure tutélaire de Haven Springs, il tient la ville, ses mines et ses secrets.",
  },
  "rachel-amber": {
    tagline: "L'absente",
    bio: "Étudiante disparue de Blackwell, elle hante les couloirs, les photos et la mémoire de Chloé.",
  },
  "yasmin-fayyad": {
    tagline: "La mère de Safi",
    bio: "À la tête de Caledon University, elle défend l'institution et son propre nom. La mort de sa fille fait d'elle bien plus qu'une dirigeante en deuil.",
  },
  "lucas-colmenero": {
    tagline: "Le professeur de Caledon",
    bio: "Enseignant respecté de Caledon University, il incarne l'institution que Max et Safi contestent — jusqu'à ce que son rôle dans l'affaire devienne beaucoup moins respectable.",
  },
  "ryan-lucan": {
    tagline: "Le ranger au grand cœur",
    bio: "Guide de montagne et fils du patriarche, il croit aux institutions jusqu'au moment où elles le lâchent.",
  },

  // ——— Poppy Playtime ———
  "catnap": {
    tagline: "Le gardien du sommeil",
    bio: "Expérience 1180, il diffuse un gaz soporifique et veille sur la chapelle de Playcare, persuadé que l'endormissement est un cadeau.",
  },
  "prototype-experience-1006": {
    tagline: "L'expérience 1006",
    bio: "Premier prototype de Playtime Co., il a survécu à tout et manipule les autres jouets depuis l'ombre.",
  },
  "huggy-wuggy": {
    tagline: "Le câlin qui tue",
    bio: "Mascotte bleue du magasin, il aime serrer très fort — assez fort pour briser des os.",
  },
  "mommy-long-legs": {
    tagline: "La maman de Playcare",
    bio: "Expérience 1222, araignée de plastique qui dirige Playcare avec une douceur devenue menace.",
  },
  "kissy-missy": {
    tagline: "L'amie rose",
    bio: "Mascotte rose de Playtime Co., elle aime les câlins mais se méfie des humains qui l'ont enfermée.",
  },
  "yarnaby": {
    tagline: "La pelote de laine",
    bio: "Expérience en forme de lion de laine, il obéit à celui qui le tient et dévore les autres.",
  },
  "poppy-ludwig": {
    tagline: "La poupée qui sait tout",
    bio: "Première poupée animée de Playtime Co., elle guide l'ancien employé dans les sous-sols de l'usine.",
  },
  "miss-delight": {
    tagline: "L'institutrice de Playcare",
    bio: "Expérience enseignante, elle garde l'école et punit ceux qui sortent du rang.",
  },
  "boxy-boo": {
    tagline: "La boîte à ressort",
    bio: "Jouet de surprise jaune, il bondit hors de sa boîte pour attraper ceux qui passent trop près.",
  },
  "bunzo-bunny": {
    tagline: "Le lapin à cymbales",
    bio: "Jouet musical de Playcare, il frappe ses cymbales jusqu'à ce que la fête s'arrête très mal.",
  },
  "doey-the-doughman": {
    tagline: "La pâte à modeler",
    bio: "Expérience de pâte malléable, il peut prendre toutes les formes et finit par ne plus savoir laquelle est la sienne.",
  },
  "the-player": {
    tagline: "L'ancien employé",
    bio: "Ancien salarié de Playtime Co. revenu dix ans après la disparition de ses collègues, il cherche la vérité et un moyen de sortir.",
  },
  "dr-harley-sawyer": {
    tagline: "Le scientifique de Playtime",
    bio: "Directeur de recherche de Playtime Co., il a transformé des employés en jouets et n'y a jamais vu le moindre problème.",
  },
  "pj-pug-a-pillar": {
    tagline: "La chenille de Playcare",
    bio: "Jouet à bascule qui avance en chantonnant et n'aime pas qu'on lui résiste.",
  },

  // ——— Code Vein ———
  "valentin-voda": {
    tagline: "Le juge de la maison Voda",
    bio: "Héritier de la maison Voda, lignée remontant au Progéniteur, il dirige MagMell du temps où l'organisation n'était qu'un institut de recherche sur les Forma — et arbitre les conflits entre humains et revenants.",
  },
  "josee-anjou": {
    tagline: "La reine de la cité engloutie",
    bio: "Elle règne sur la cité engloutie et sur les derniers refuges des survivants. Son autorité est faite de culpabilité : elle n'a pas su empêcher une flambée de Résurgence, et se bat depuis en première ligne pour rattraper ça.",
  },
  "lavinia-voda": {
    tagline: "La chef de MagMell",
    bio: "Descendante du Progéniteur, elle dirige MagMell et sa mission de protection de l'humanité. C'est elle qui confie la mission et envoie le chasseur cent ans dans le passé.",
  },
  "holly-asturias": {
    tagline: "La médecin des bois",
    bio: "Revenante médecin dans une clinique isolée, elle appartient à la lignée Luxuria dont les soins sont aussi puissants que maudits. Elle étudie la Résurgence pour aider ceux qu'elle défigure.",
  },
  "juzo-mido": {
    tagline: "Le chercheur des successeurs",
    bio: "Revenant chercheur le plus en vue de son époque, il est derrière les Successors et les expériences sur les revenants. Pour lui, l'évolution justifie tous les sacrifices, à commencer par ceux des autres.",
  },
  "louis-amamiya": {
    tagline: "Le revenant au grand cœur",
    bio: "Revenant qui protège les survivants de la cité, il cherche un moyen de mettre fin à la soif de sang plutôt que de la subir.",
  },
  "lou-magmell": {
    tagline: "Celle qui a donné son cœur",
    bio: "Jeune revenante de MagMell, elle ranime le chasseur en lui donnant son propre cœur et peut suivre le Pathos des autres pour remonter le temps. Sans elle, aucun voyage dans le passé n'est possible.",
  },
  "lyle-mcleish": {
    tagline: "L'as de l'Aube",
    bio: "Sabreur d'exception et fer de lance de l'organisation The Dawn Chorus, il combat seul avec un style aussi efficace que suicidaire — au point que ses alliés le craignent.",
  },
  "zenon-gryfgote": {
    tagline: "Le génie exilé",
    bio: "Ses découvertes ont bâti la société revenante moderne ; ses expériences interdites l'ont envoyé pourrir plus de dix mille ans dans la prison d'Insula Carcere.",
  },
  "noah-g-magmell": {
    tagline: "Le garde du corps de Valentin",
    bio: "Ancien humain devenu revenant il y a un siècle, il est le protecteur personnel de Valentin Voda et prend les missions les plus dangereuses sans poser de question.",
  },
  "iris-magmell": {
    tagline: "La colonne vertébrale technique de MagMell",
    bio: "Elle fournit à MagMell ses recherches, son équipement et ses innovations sur les capacités des revenants. Le versant rationnel d'une organisation qui en a besoin.",
  },
  "cruz-silva": {
    tagline: "La Reine",
    bio: "Jeune revenante devenue le cœur de la Reine, elle a été transformée en arme par ceux qui devaient la protéger.",
  },
  "jadwiga": {
    tagline: "La marchande entre deux mondes",
    bio: "Marchande de MagMell, elle vend, achète et améliore armes et Jails — et apparaît d'un lieu à l'autre comme si la distance ne la concernait pas.",
  },
  "gregorio-silva": {
    tagline: "Le chef des revenants",
    bio: "Fondateur de l'organisation des revenants et père de Cruz, il a dû sceller sa propre fille pour sauver la cité.",
  },

  // ——— Clair Obscur: Expedition 33 ———
  "gustave": {
    tagline: "L'ingénieur de Lumière",
    bio: "Ingénieur de la ville de Lumière, il part en expédition pour arrêter la Peintresse avant que son année ne s'achève.",
  },
  "renoir": {
    tagline: "Le peintre de la Peintresse",
    bio: "Père de Maëlle, il combat aux côtés des expéditionnaires avant de basculer du côté de la Peintresse.",
  },
  "sophie": {
    tagline: "La lumière de Gustave",
    bio: "Compagne de Gustave, elle incarne ce qui reste à sauver à Lumière et ce qu'il risque de perdre en partant.",
  },
  "maelle": {
    tagline: "La peintre de l'expédition",
    bio: "Jeune femme élevée à Lumière, elle manie la peinture comme d'autres l'épée et découvre le poids de son nom.",
  },
  "lune": {
    tagline: "La scientifique de l'expédition",
    bio: "Chercheuse de l'expédition, elle analyse les pigments et les monstres avec la même froideur.",
  },
  "the-paintress": {
    tagline: "La Peintresse",
    bio: "Être immense qui peint les âmes et efface des villes entières ; l'expédition part pour la tuer.",
  },
  "verso": {
    tagline: "Le survivant sans mémoire",
    bio: "Homme sans passé qui rejoint l'expédition, il porte un secret que le récit dévoile par fragments.",
  },
  "sciel": {
    tagline: "La combattante de l'expédition",
    bio: "Combattante au tempérament solaire, elle charge l'ennemi avec une énergie qui ne laisse pas de place au doute.",
  },
  "monoco": {
    tagline: "Le Gestral de l'expédition",
    bio: "Gestral espiègle devenu compagnon de route, il manie plusieurs armes et beaucoup d'humour.",
  },
  "curator": {
    tagline: "Le gardien des œuvres",
    bio: "Figure énigmatique qui veille sur les toiles et les secrets du monde peint, il n'aide jamais sans contrepartie.",
  },

  // ——— Red Dead Redemption ———
  "micah-bell": {
    tagline: "Le rat de la bande",
    bio: "Tueur sans foi ni loi, il pousse Dutch à la paranoïa et à la violence, puis finit par tout trahir pour sauver sa peau.",
  },
  "john-marston": {
    tagline: "Le hors-la-loi rangé",
    bio: "Ancien de la bande de Dutch, il raccroche les armes pour sa famille et se fait rattraper par le gouvernement, qui ne lâche jamais personne.",
  },
  "jack-marston": {
    tagline: "Le fils qui reprend le fusil",
    bio: "Enfant de Beecher's Hope, il grandit dans l'ombre d'un père trop occupé à survivre, et finit par reprendre sa vendetta.",
  },
  "arthur-morgan": {
    tagline: "Le bras droit de Dutch",
    bio: "Homme de confiance de la bande, il tue sans discuter puis apprend à douter. Sa rédemption est celle d'un homme qui n'a pas eu le temps.",
  },
  "bill-williamson": {
    tagline: "Le soldat devenu caïd",
    bio: "Ancien de la bande de Dutch, il monte son propre gang à Fort Mercer et se méfie de tout le monde, à commencer par lui-même.",
  },
  "dutch-van-der-linde": {
    tagline: "L'idéal qui pourrit",
    bio: "Chef charismatique de la bande, il parle de liberté et d'un monde meilleur tandis que tout s'effondre autour de lui et de ses fidèles.",
  },
  "javier-escuella": {
    tagline: "Le guitariste révolutionnaire",
    bio: "Membre mexicain de la bande, il reste loyal à Dutch jusqu'au moment où la loyauté ne mène plus nulle part.",
  },
  "edgar-ross": {
    tagline: "L'agent qui ne lâche rien",
    bio: "Agent du Bureau of Investigation, il fait chanter d'anciens hors-la-loi pour nettoyer l'Ouest et ne tient jamais parole très longtemps.",
  },
  "agustin-allende": {
    tagline: "Le colonel corrompu",
    bio: "Officier mexicain qui se présente en rempart contre les bandits tout en les finançant, il confond l'ordre et son propre intérêt.",
  },

  // ——— Shenmue ———
  "ryo-hazuki": {
    tagline: "La vengeance à dix-sept ans",
    bio: "Fils d'un maître d'arts martiaux assassiné, il enquête sur les triades de Yokosuka et refuse de lâcher la piste de Lan Di.",
  },
  "shenhua-ling": {
    tagline: "La fille de la montagne",
    bio: "Jeune Chinoise qui vit dans le village de Bailu et parle aux esprits, sa rencontre avec Ryo l'arrache à sa solitude.",
  },
  "nozomi-harasaki": {
    tagline: "La lycéenne de Yokosuka",
    bio: "Camarade de classe de Ryo, elle tient la barre de son club et s'inquiète de le voir risquer sa vie pour un homme dont il ne sait rien.",
  },
  "joy": {
    tagline: "La motarde de Hong Kong",
    bio: "Fille de l'underground de Hong Kong, elle aide Ryo autant qu'elle le charrie et ne se laisse impressionner par personne.",
  },
  "iwao-hazuki": {
    tagline: "Le maître assassiné",
    bio: "Maître de l'école Hazuki, il a été tué devant son fils pour un miroir de pierre et n'a jamais expliqué son passé. Son fils passe sa vie à le faire à sa place.",
  },
  "xiuying-hong": {
    tagline: "La maîtresse du poing",
    bio: "Maîtresse du temple et sœur de Lan Di, elle enseigne à Ryo la patience dont il manque cruellement.",
  },
  "guizhang-chen": {
    tagline: "Le bras droit de la triade",
    bio: "Homme de confiance de la triade de Hong Kong, il devient un allié de Ryo malgré leur premier affrontement.",
  },
  "chai": {
    tagline: "Le bras de la triade",
    bio: "Petit voyou frénétique au service des triades, il harcèle Ryo à chaque étape de son enquête et perd à chaque fois.",
  },
  "longsun-zhao": {
    tagline: "Lan Di",
    bio: "Meurtrier du père de Ryo et membre des Quatre Rois Célestes, il cherche les miroirs de pierre pour une raison que personne ne connaît.",
  },

  // ——— Bully ———
  "gary-smith": {
    tagline: "Le manipulateur du dortoir",
    bio: "Élève brillant et toxique, il manipule les clans de Bullworth pour que tout le monde s'entre-tue à sa place.",
  },
  "johnny-vincent": {
    tagline: "Le chef des Greasers",
    bio: "Patron du gang des Greasers, il tient la boutique de moto de la ville et règle ses comptes à coups de poing.",
  },
  "lola-lombardi": {
    tagline: "La peste",
    bio: "Lycéenne qui aime semer la zizanie entre les clans et regarder le résultat avec un grand sourire.",
  },
  "derby-harrington": {
    tagline: "Le roi des Preppies",
    bio: "Héritier des Harrington, il dirige les Preppies depuis la salle de boxe du gymnase et méprise tout le reste de l'école.",
  },
  "ted-thompson": {
    tagline: "Le quarter-back",
    bio: "Chef des Jocks, il fait de la salle, gagne les matchs et se croit au-dessus de la hiérarchie de l'école.",
  },
  "james-hopkins": {
    tagline: "Le nouveau",
    bio: "Adolescent placé par sa mère dans un internat où il ne connaît personne, il grimpe la hiérarchie à coups de poing et de mauvaise foi.",
  },

  // ——— Metal Gear ———
  "solid-snake": {
    tagline: "Le clone qui a surpassé",
    bio: "Soldat envoyé seul à Shadow Moses, il découvre qu'il n'est qu'un clone génétique au service d'un projet qu'il n'a pas choisi.",
  },
  "big-boss": {
    tagline: "Le père du soldat",
    bio: "Héros de l'opération Snake Eater, il fonde Outer Heaven et l'armée sans frontières, convaincu que le soldat doit avoir un foyer.",
  },
  "revolver-ocelot": {
    tagline: "Le joueur de colts",
    bio: "Homme de main du GRU puis agent triple, il truque les armes, rit aux mauvais moments et sert une cause qui change à chaque épisode.",
  },
  "otacon": {
    tagline: "L'ingénieur de Metal Gear",
    bio: "Ingénieur qui a conçu Rex sans comprendre ce qu'il fabriquait, il rejoint Snake pour expier et code ses gadgets.",
  },
  "raiden": {
    tagline: "L'enfant-soldat",
    bio: "Soldat formé dans l'enfance par une organisation secrète, il veut croire qu'il choisit sa vie et finit par devenir une machine.",
  },
  "gray-fox": {
    tagline: "Le cyborg de Fox Hound",
    bio: "Ancien camarade de Snake, il revient sous un exosquelette et une épée pour le défier une dernière fois.",
  },

  // ——— Crimson Desert ———
  "kliff-macduff": {
    tagline: "Le chef des Greymanes",
    bio: "Mercenaire de Pywel à la tête de la compagnie des Greymanes, il traverse un continent déchiré par les serments brisés et les guerres de succession — et se bat pour les siens avant tout.",
  },
  "damiane": {
    tagline: "L'un des trois piliers de l'aventure",
    bio: "Personnage jouable de Crimson Desert, elle apporte à l'expédition une autre façon de se battre, dans un monde où les royaumes se disputent les terres et le sang.",
  },
  "oongka": {
    tagline: "La force brute de l'expédition",
    bio: "Personnage jouable de Crimson Desert, il impose sa carrure dans un continent où la négociation se fait souvent à coups de masse.",
  },
  "myurdin": {
    tagline: "L'adversaire de Pywel",
    bio: "Antagoniste de Crimson Desert, il fait partie de ceux qui profitent du chaos des royaumes pour prendre ce qu'ils convoitent.",
  },
  "naira": {
    tagline: "La compagne de Kliff",
    bio: "Second rôle de l'expédition de Kliff à Pywel, elle connaît les pistes du continent et les gens qui les tiennent.",
  },

  // ——— Mafia ———
  "isabella-torrisi": {
    tagline: "La fille du Don",
    bio: "Fille de Don Bernardo Torrisi, elle étouffe dans la Sicile du début du XXe siècle et rêve d'ailleurs. Sa liaison avec Enzo, un ancien enfant des mines de soufre, met tout le monde en danger.",
  },
  "enzo-favani": {
    tagline: "L'enfant des mines",
    bio: "Vendu à cinq ans aux mines de soufre par son propre père, il est sauvé par la famille Torrisi et devient leur homme de main le plus fiable — ce qui ne le rendra jamais assez respectable à leurs yeux.",
  },
  "luca-trapani": {
    tagline: "Celui qui ouvre la porte",
    bio: "Soldato de la famille Torrisi, il repère Enzo dans les mines et l'introduit chez les siens. Sa loyauté envers le gamin des carusu finit par lui coûter la vie.",
  },
  "corrado-bastoni": {
    tagline: "L'Ombre",
    bio: "Caporegime impassible de la famille Spadaro, il manœuvre dans l'ombre de la guerre des clans siciliens et incarne une menace d'autant plus dangereuse qu'il ne hausse jamais le ton.",
  },

  // ——— Bubsy ———
  "bubsy-bobcat": {
    tagline: "Le lynx qui n'a peur de rien",
    bio: "Héros éponyme de la série, il collectionne les pelotes de laine, saute dans tous les sens et sort une vanne par seconde.",
  },
  "terry-bobcat": {
    tagline: "Le cousin Terry",
    bio: "Cousin de Bubsy, il apparaît dans les épisodes 3D de la série et sert surtout de souffre-douleur de service.",
  },
  "terri-bobcat": {
    tagline: "La cousine Terri",
    bio: "Cousine de Bubsy, elle fait partie de la petite famille de félins qui gravite autour du héros et de ses sbires.",
  },
  "oinker-p-hamm": {
    tagline: "Le cochon qui se croit génial",
    bio: "Porc anthropomorphe croisé dans les jeux Bubsy, il se prend pour un génie et finit toujours par l'ouvrir au mauvais moment.",
  },

  // ——— Duke Nukem ———
  "duke-nukem": {
    tagline: "Le héros de l'Amérique",
    bio: "Colosse à lunettes de soleil, il sauve la Terre des aliens, des nazis et des envahisseurs avec une réplique pour chaque cadavre.",
  },
  "dr-proton": {
    tagline: "Le savant fou",
    bio: "Premier antagoniste de Duke Nukem, il veut conquérir la Terre avec des robots et des plans qui ne fonctionnent jamais.",
  },
  "cycloid-empero": {
    tagline: "L'empereur cyclope",
    bio: "Chef des aliens dans Duke Nukem II, il enlève Duke et déclare la guerre à la Terre avec une confiance très mal placée.",
  },

  // ——— Ōkami ———
  "issun": {
    tagline: "Le peintre ambulant",
    bio: "Minuscule artiste itinérant qui accompagne Amaterasu, il commente tout, drague tout et traduit les kami pour le joueur.",
  },

  // ——— World of Warcraft ———
  "arthas": {
    tagline: "Le Roi-liche, prince de Lordaeron",
    quote: "Il n'y a pas de roi éternel, mon fils.",
    bio: "Prince déchu de Lordaeron, il a sacrifié son âme à Frostmourne pour sauver son royaume — et l'a gelé pour l'éternité.",
  },
  "illidan": {
    tagline: "Le Traître qui voyait juste",
    quote: "Vous n'êtes pas prêts !",
    bio: "Mage devenu démon pour combattre la Légion ardente avec ses propres armes, il a été emprisonné dix mille ans pour avoir eu raison trop tôt.",
  },
  "sylvanas": {
    tagline: "La banshee de Quel'Thalas",
    quote: "Ce monde ne mérite que la mort.",
    bio: "Ranger générale tuée par Arthas, revenue en banshee, elle a bâti les Réprouvés et n'a jamais pardonné.",
  },
  "thrall": {
    tagline: "Le chaman libérateur",
    quote: "Pour la Horde !",
    bio: "Orc élevé par des humains, il a rendu aux siens une terre et une foi, puis quitté le pouvoir avant qu'il ne le quitte.",
  },
  "jaina": {
    tagline: "L'archimage de Dalaran",
    quote: "La paix était une possibilité… que vous avez détruite.",
    bio: "Archimage de Dalaran, survivante de Theramore, elle a fini par choisir la tempête plutôt que la diplomatie.",
  },
  "anduin": {
    tagline: "Le roi prêtre",
    quote: "La paix est la seule issue, même s'il faut se battre pour l'obtenir.",
    bio: "Roi de Stormwind, prêtre avant tout, il cherche la paix dans une Alliance que son père voulait victorieuse.",
  },

  // ——— Final Fantasy XIV ———
  "emet-selch": {
    tagline: "L'Ascien au sourire triste",
    quote: "Souvenez-vous de nous. Car nous avons vécu.",
    bio: "Ascien immortel, architecte de Garlemald, il juge l'humanité fragmentaire digne de son souvenir — ou pas.",
  },
  "yshtola": {
    tagline: "La sorcière qui lit l'éther",
    bio: "Sorcière miqo'te et archiviste de Sharlayan, elle traverse les plans pour ramener ceux qu'on croyait perdus.",
  },
  "alphinaud": {
    tagline: "Le diplomate des jumeaux",
    bio: "Jumeau érudit, diplomate en herbe, il apprend à ses dépens que les alliances se paient parfois en vies.",
  },
  "alisaie": {
    tagline: "L'épée rouge des jumeaux",
    bio: "Jumelle impatiente, mage rouge, elle préfère agir pendant que son frère négocie encore.",
  },
  "estinien": {
    tagline: "Le chevalier dragon",
    quote: "Le sang des dragons coule dans mes veines, et je ne reculerai pas.",
    bio: "Chevalier dragon d'Ishgard, il porte la lance de Nidhogg et une rancune plus lourde que son armure.",
  },
  "urianger": {
    tagline: "L'érudit aux prophéties",
    bio: "Érudit voilé de Sharlayan, il parle par énigmes et peut trahir pour de bonnes raisons.",
  },

  // ——— Dofus ———
  "goultard": {
    tagline: "La fureur incarnée",
    quote: "On ne badine pas avec un Iop enragé !",
    bio: "Guerrier légendaire du Monde des Douze, il manie la colère comme une arme et cherche un adversaire à sa taille.",
  },
  "dark-vlad": {
    tagline: "Le seigneur vampire",
    bio: "Chevalier de la nuit, nobliau vampire, il hante les ruines de son propre château en attendant de meilleurs invités.",
  },
  "nox": {
    tagline: "Le mage qui voulait arrêter le temps",
    bio: "Xélor du Monde des Douze, il vole les wakfu pour figer les siens dans l'instant — et condamne le reste du monde à vieillir.",
  },
  "joris-jurgen": {
    tagline: "Le gardien immortel",
    quote: "Ne vous fiez pas à ma taille, les meilleures lames sont parfois les plus courtes.",
    bio: "Demi-dieu immortel, gardien de Kerubim, il traverse les siècles avec son épée et trop de souvenirs.",
  },
  "kerubim": {
    tagline: "L'ecaflip conteur",
    bio: "Ecaflip escroc et conteur, il a élevé Joris entre deux arnaques et trois légendes.",
  },
  "dathura": {
    tagline: "La voix de la forêt",
    bio: "Créature liée à la déesse Sadida, elle incarne la forêt qui repousse, punit et se souvient.",
  },

  // ——— Guild Wars 2 ———
  "aurene": {
    tagline: "Le dragon cristallin",
    quote: "Je suis le cristal et le cœur. Je protégerai ce monde.",
    bio: "Jeune dragon de cristal, fille de Kralkatorrik, elle porte l'espoir d'un cycle qui ne finit pas en dévoration.",
  },
  "rytlock": {
    tagline: "Le charr revenant",
    quote: "La diplomatie, c'est bien. Une bonne lame dans le ventre du dragon, c'est mieux.",
    bio: "Charr de la Légion de Sang, il manie la magie des brumes et un caractère de granit.",
  },
  "caithe": {
    tagline: "L'ombre des Sylvari",
    quote: "L'ombre cache les vérités que la lumière refuse de voir.",
    bio: "Sylvari de la Cour du Crépuscule, elle porte un secret qui a coûté la vie à sa reine.",
  },
  "logan-thackeray": {
    tagline: "Le capitaine de la Garde",
    bio: "Capitaine de la Garde de Divinité, héros de la Serre, il a choisi le devoir plutôt que la légende.",
  },
  "zojja": {
    tagline: "Le génie asura",
    bio: "Ingénieure asura du Snaff, génie bougonne, elle répare les golems et engueule les imbéciles.",
  },
  "trahearne": {
    tagline: "Le gardien du Pacte",
    quote: "Le cycle de la terreur doit cesser.",
    bio: "Sylvari érudit, premier Gardien du Pacte, il a porté le deuil d'Orr jusqu'au bout.",
  },

  // ——— Compléments World of Warcraft ———
  "tirion-fordring": {
    tagline: "Le porteur de Brise-Cendres",
    quote: "Par la Lumière, j'ordonne que cette prison de glace soit brisée !",
    bio: "Paladin légendaire et ancien chef de la Croisade d'Argent, il a brisé la glace du Trône de Glace et terrassé le Fléau au prix de sa vie.",
  },
  "garrosh": {
    tagline: "Le Chef de Guerre",
    quote: "La Horde n'a pas besoin de faiblards !",
    bio: "Fils de Grom Hurlorage, guerrier implacable devenu Chef de Guerre, son règne tyrannique et son refus de la diplomatie ont fracturé la Horde.",
  },

  // ——— Compléments Final Fantasy XIV ———
  "venat": {
    tagline: "La Mère cristalline",
    quote: "Marchez, marchez, même dans l'obscurité la plus profonde.",
    bio: "Ancienne dirigeante d'Amaurot devenue Hydaelyn, elle a sacrifié son monde et son avenir pour offrir aux mortels le choix et la résilience.",
  },
  "haurchefant": {
    tagline: "Le sourire d'Ishgard",
    quote: "Un sourire sied mieux à un héros.",
    bio: "Chevalier de la Maison Fortemps, il fut l'un des rares alliés sincères du Guerrier de la Lumière lors de ses heures les plus sombres.",
  },
  "zenos": {
    tagline: "Le chasseur d'absolu",
    quote: "La chasse commence…",
    bio: "Prince héritier de Garlemald, il ne trouve de sens que dans l'affrontement mortel contre un adversaire à sa pleine mesure.",
  },
  "aymeric": {
    tagline: "Le Lord Commandant",
    quote: "Ishgard doit changer, et nous changerons avec elle.",
    bio: "Lord Commandant des Templiers, il a guidé Ishgard hors de son millénaire de guerre sainte vers une ère républicaine et progressiste.",
  },
  "graha-tia": {
    tagline: "L'Exarque du Cristal",
    quote: "Je ne suis plus seulement un observateur, je marche à vos côtés !",
    bio: "Savant Miqo'te devenu l'Exarque du Cristal, il a traversé les dimensions et le temps pour sauver le futur de ses amis.",
  },

  // ——— Compléments Dofus ———
  "arpagone": {
    tagline: "La chasseuse de kamas",
    quote: "Rien ne se perd, tout se monnaie.",
    bio: "Figure emblématique des Enutrofs, avide de richesses et experte dans l'art de dénicher les kamas sous toutes leurs formes.",
  },
  "rushu": {
    tagline: "Le seigneur du Chaos",
    quote: "Le Chaos est mon art, et vos larmes sont ma symphonie.",
    bio: "Maître suprême et despotique de la Shukrute, il incarne la violence, la tyrannie et la rage démoniaque du Monde des Douze.",
  },

  // ——— Complément Guild Wars 2 ———
  "palawa-joko": {
    tagline: "Le roi immortel d'Elona",
    quote: "Je ne suis pas seulement un roi, je suis un dieu vivant… et j'ai une excellente réputation.",
    bio: "Roi immortel et dictateur mégalomane d'Elona, il règne sur un empire de morts-vivants avec un humour aussi cynique que corrosif.",
  },

  // ——— RuneScape ———
  "king-black-dragon": {
    tagline: "Trois têtes, trois souffles",
    bio: "Créature mythique et premier grand boss de raid de RuneScape, ses trois têtes crachent le feu, le poison et la glace au fond de la Wilderness.",
  },
  "zamorak": {
    tagline: "Le dieu du Chaos",
    quote: "Le chaos est la seule véritable liberté.",
    bio: "Ancien dieu du chaos, de la destruction et du pouvoir individuel, il a bouleversé l'ordre divin de Gielinor.",
  },
  "zaros": {
    tagline: "Le Maître du Vide",
    quote: "L'ombre absorbe toute lumière, mais elle garde ses secrets.",
    bio: "Divinité énigmatique dont l'empire antique a dominé Gielinor avant d'être trahi, son retour a redéfini la cosmologie du jeu.",
  },
  "wise-old-man": {
    tagline: "Le cambrioleur de Draynor",
    quote: "J'ai passé des décennies à voler les banques de Draynor, et personne ne m'a jamais arrêté.",
    bio: "Vieil aventurier excentrique de Draynor Village, cambrioleur impuni et encyclopédie vivante des babioles de Gielinor.",
  },

  // ——— The Elder Scrolls Online ———
  "mannimarco": {
    tagline: "Le Roi des Vers",
    quote: "Les âmes de Tamriel m'appartiennent, et Molag Bal couronnera mon œuvre !",
    bio: "Nécromancien d'Alinor devenu le Roi des Vers, il a ourdi un complot titanesque pour fusionner Nirn et Oblivion.",
  },
  "cadwell": {
    tagline: "Le chevalier de Havreglace",
    quote: "N'oubliez pas d'apporter un chaudron ! On ne sait jamais quand on aura soif.",
    bio: "Aventurier excentrique devenu résident permanent de Havreglace, il guide le joueur avec une bonne humeur communicative.",
  },

  // ——— Lost Ark ———
  "brelshaza": {
    tagline: "La reine des illusions",
    quote: "Le désespoir est un jeu magnifique, et je tiens les ficelles.",
    bio: "Commandante des Légions Fantômes, reine de la tromperie, elle brise l'esprit de ses ennemis avant même de lever le petit doigt.",
  },

  // ——— Star Wars: The Old Republic ———
  "malgus": {
    tagline: "Le Seigneur Sith",
    quote: "La paix est un mensonge, il n'y a que la passion… et à travers elle, je triomphe.",
    bio: "Seigneur Sith implacable et visionnaire, il a mené la charge contre le Temple Jedi sur Coruscant.",
  },
  "satele-shan": {
    tagline: "La Grand Maître Jedi",
    quote: "La Force est un bouclier pour les justes, non une arme de tyrannie.",
    bio: "Grand Maître légendaire de l'Ordre Jedi, descendante de Revan et Bastila, elle a guidé la République face à l'Empire Sith.",
  },

  // ——— EverQuest ———
  "kerafyrm": {
    tagline: "Le Dragon Éternel réveillé",
    quote: "Le sommeil du Dragon Éternel est rompu…",
    bio: "Né du croisement de deux lignées primordiales, il fut scellé dans son tombeau par les dragons eux-mêmes ; sa libération ravagea Norrath et faucha des serveurs entiers.",
  },
  "firiona-vie": {
    tagline: "La paladine de Norrath",
    quote: "Tant que la Lumière brille sur Norrath, l'espoir demeure.",
    bio: "Paladine elfe et égérie de la franchise, elle a guidé les champions du Bien à travers les guerres contre les dieux et les ténèbres.",
  },

  // ——— Lineage II ———
  "antharas": {
    tagline: "Le Dragon de la Terre",
    quote: "Qui ose perturber le sommeil du Dragon de la Terre ?",
    bio: "Né du sang de Shilen, niché au fond de son antre, ses attaques telluriques ont réclamé des milliers d'alliances et de clans.",
  },
  "baium": {
    tagline: "L'empereur maudit d'Elmoreden",
    quote: "Mon sommeil a duré des siècles… vous paierez pour cette insolence.",
    bio: "Empereur arrogant qui défia les dieux en élevant une tour géante ; Einhasad le condamna à dormir au sommet de l'Archaic Tower.",
  },

  // ——— Ragnarok Online ———
  "baphomet": {
    tagline: "Le seigneur du Labyrinthe",
    quote: "[Rire démoniaque résonnant dans le Labyrinthe]",
    bio: "Démon à la grande faux, maître des profondeurs du labyrinthe de Prontera, il reste la menace MVP ultime de Rune-Midgard.",
  },
  "valkyrie-randgris": {
    tagline: "Le jugement d'Odin",
    quote: "Au nom d'Odin, préparez-vous au jugement dernier !",
    bio: "Messagère divine aux ailes de lumière, elle protège Odin Temple et déchaîne la colère céleste sur les aventuriers de Midgard.",
  },

  // ——— MapleStory ———
  "black-mage": {
    tagline: "Le White Mage déchu",
    quote: "Ce monde sera purifié dans le vide ultime.",
    bio: "Ancien chercheur de vérité, il a sombré dans les arcanes noires pour briser le destin imposé par les dieux et se dresse comme l'antagoniste ultime de Maple World.",
  },
  "zakum": {
    tagline: "Le brasier d'El Nath",
    quote: "[Grondement du brasier infernal au cœur de la mine]",
    bio: "Esprit maléfique scellé dans un arbre géant au fond de la mine d'El Nath, ses piliers de feu en ont fait le premier raid mythique du jeu.",
  },

  // ——— Aion ———
  "tiamat": {
    tagline: "La cinquième Seigneuresse Balaur",
    quote: "L'Atreia s'effondrera sous l'étreinte de mes dragons !",
    bio: "Maîtresse de la colère et du sang, son règne sur Katalam a forcé Élyséens et Asmodiens à s'allier.",
  },
  "marchutan": {
    tagline: "Le Seigneur Divin du Sort",
    quote: "La peur est une arme, l'ombre est notre bouclier.",
    bio: "Protecteur des Asmodiens, il gouverne depuis Pandaemonium et voue une haine féroce aux Élyséens comme aux Balaurs.",
  },

  // ——— TERA ———
  "elion-dulas": {
    tagline: "Le commandant de la Fédération Valkyon",
    quote: "Pour la liberté d'Arborea, pas un pas en arrière !",
    bio: "Héros charismatique de la Fédération Valkyon, il tient les lignes face aux invasions argones.",
  },

  // ——— Blade & Soul ———
  "jin-soyeon": {
    tagline: "La lame de la vengeance",
    quote: "La vengeance est la seule fleur qui pousse dans le sang.",
    bio: "Guerrière consumée par les ténèbres, elle a massacré l'école de Hongmoon avec Twilight's Edge et porte la rancœur qui structure tout le récit.",
  },
  "hong-seokkeun": {
    tagline: "Le maître de Hongmoon",
    quote: "Le véritable chemin de Hongmoon réside dans la protection des innocents.",
    bio: "Grand maître bienveillant, sa sagesse n'a d'égale que sa capacité à prendre une forme colossale pour défendre ses disciples.",
  },

  // ——— Black Desert Online ———
  "black-spirit": {
    tagline: "Le compagnon aux yeux rouges",
    quote: "Hé, partenaire ! On continue de grandir ensemble ?",
    bio: "Entité amnésique qui suit le joueur dès ses premiers pas ; derrière ses rires moqueurs dort un pouvoir ancestral capable d'engloutir des régions.",
  },

  // ——— The Secret World ———
  "kirsten-geary": {
    tagline: "La patronne des Illuminati",
    quote: "Le pouvoir ne s'achète pas, il s'administre.",
    bio: "Dirigeante incisive des Illuminati de New York, elle mène la guerre occulte mondiale comme une multinationale où seuls les résultats comptent.",
  },

  // ——— Phantasy Star Online 2 ———
  "dark-falz-persona": {
    tagline: "La haine à travers le temps",
    quote: "Je suis la haine qui traverse le temps et l'espace.",
    bio: "Incarnation maudite du vide, liée au protagoniste par un pacte temporel tragique, elle veut libérer la corruption ultime sur la galaxie.",
  },

  // ——— Age of Conan ———
  "conan": {
    tagline: "Le roi barbare d'Aquilonie",
    quote: "Je suis Conan, Roi d'Aquilonie !",
    bio: "Guerrier cimmérien devenu roi, il gouverne Tarantia entre intrigues de cour et luttes contre le sorcier Thoth-Amon.",
  },

  // ——— City of Heroes ———
  "statesman": {
    tagline: "Le protecteur de Paragon City",
    quote: "Tant que Paragon City sera debout, le Mal ne l'emportera pas !",
    bio: "Fondateur de la Freedom Phalanx, immortel depuis la Fontaine de Jouvence, il incarne l'idéal du super-héros.",
  },
  "lord-recluse": {
    tagline: "Le maître d'Arachnos",
    quote: "Arachnos régnera sur les cendres du vieux monde.",
    bio: "Chef d'Arachnos et ennemi intime de Statesman, son harnais archnéen lui permet de tenir les îles Rogue d'une main de fer.",
  },

  // ——— Tibia ———
  "ferumbras": {
    tagline: "Le sorcier au chapeau pointu",
    quote: "Votre sang coulera sur les pierres de Thais !",
    bio: "Sorcier légendaire dont les apparitions déclenchaient des rassemblements massifs : les premières hystéries collectives de l'histoire des MMO.",
  },

  // ——— WildStar ———
  "avatus": {
    tagline: "L'IA du Datascape",
    quote: "Protocole de sécurité annulé : éradication biologique immédiate.",
    bio: "Intelligence artificielle hyper-avancée des Eldans, maîtresse du complexe du Datascape, ses schémas holomorphiques exigeaient une coordination parfaite.",
  },
  "artemis-zin": {
    tagline: "L'exploratrice de Nexus",
    quote: "Préparez vos caméras, Nexus va assister à un vrai spectacle !",
    bio: "Mercenaire et exploratrice haut en couleur, elle incarne l'esprit d'aventure et le style déjanté de la conquête de Nexus.",
  },

  // ——— Flyff ———
  "clockworks": {
    tagline: "L'automate de Madrigal",
    quote: "[Grondement d'engrenages géants et avertissement de panique dans la guilde]",
    bio: "Gigantesque automate de métal scellé dans son instance de Madrigal, ses attaques de zone et ses dégâts massifs ont marqué des générations de joueurs.",
  },

  // ——— Warhammer Online ———
  "tcharzanek": {
    tagline: "Le champion de Tzeentch",
    quote: "Au nom de Tzeentch, la Cité Saint-Empire brûlera !",
    bio: "Champion suprême du Chaos et chef de la Horde de la Mue Sanglante, il a mené la grande invasion contre les forces de l'Ordre pour plonger le monde dans le changement éternel.",
  },
  "malekith": {
    tagline: "Le Roi Sorcier des Druchii",
    quote: "Ulthuan est à moi par droit de sang, et je la reprendrai.",
    bio: "Souverain tyrannique des Elfes Noirs enfermé dans une armure d'acier noir, sa haine millénaire envers les Hauts Elfes et sa maîtrise de la magie noire en font un monstre de charisme et d'effroi.",
  },

  // ——— Albion Online ———

  // ——— MU Online ———
  "kundun": {
    tagline: "Le Seigneur des Ténèbres",
    quote: "Le continent de MU appartiendra à nouveau aux Ténèbres !",
    bio: "Scellé pendant des siècles, sa libération a dévasté le continent de MU ; sa présence au sommet de Kalima reste l'affrontement le plus redouté du jeu.",
  },

  // ——— Wakfu ———
  "yugo": {
    tagline: "L'Eliatrope aux portails",
    quote: "Avec mes portails, la distance n'est plus un obstacle !",
    bio: "Jeune Eliatrope capable de manipuler l'espace et les portails à volonté, son destin est lié à la survie du Monde des Douze après le Cataclysme.",
  },
  "qilby": {
    tagline: "La mémoire sans fin",
    quote: "Se souvenir de chaque vie, de chaque mort… c'est une malédiction que vous ne pouvez pas comprendre.",
    bio: "Éliatrope du Conseil des Six condamné à se souvenir de toutes ses incarnations, sa mémoire infinie l'a conduit à la folie et à vouloir sacrifier des mondes pour explorer le Krosmoz.",
  },

  // ——— Star Trek Online ———
  "jula": {
    tagline: "La matriarche Mo'Kai",
    quote: "L'honneur de la maison Mo'Kai ne s'éteindra jamais sous la menace de Starfleet !",
    bio: "Matriarche klingon d'une ère révolue projetée dans le futur, ses armes à matière noire bouleversent la politique galactique et forcent la Fédération à revoir ses stratégies.",
  },

  // ——— DC Universe Online ———
  "lex-luthor": {
    tagline: "Le Luthor venu du futur",
    quote: "J'ai libéré les exobytes pour sauver l'humanité de Brainiac… sous mes ordres.",
    bio: "Arrivé d'un futur où Brainiac a exterminé les métahumains, il diffuse des exobytes sur Terre pour créer une nouvelle génération de héros et de criminels.",
  },
  "brainiac": {
    tagline: "Le moissonneur de mondes",
    quote: "Toute connaissance doit être assimilée. Toute vie est obsolète.",
    bio: "Intelligence artificielle cosmique et grande menace du jeu, il cherche à absorber la totalité des pouvoirs des super-héros et super-vilains de la Terre.",
  },

  // ——— Dragon Nest ———
  "velskud": {
    tagline: "Le Dragon Noir",
    quote: "La faiblesse des hommes m'a forcé à prendre le pouvoir de la gemme.",
    bio: "Ancien chevalier de la Légion des Six Héros, il trahit ses compagnons pour s'emparer de la gemme du Dragon Noir : un anti-héros tragique au destin complexe.",
  },

  // ——— Rift ———
  "crucia": {
    tagline: "La Dragonne de la Tempête",
    quote: "Chaque esprit est une marionnette dont je tiens déjà les fils.",
    bio: "Dragonne Ancienne de la Tempête et maîtresse de la manipulation mentale, elle peut contrôler des armées entières sans lever la main.",
  },

  // ——— Rappelz ———
  "abhuva": {
    tagline: "La Sorcière Blanche",
    quote: "Le chaos du monde trouvera son calme dans le froid éternel.",
    bio: "Entité mystique majeure de Rappelz, elle contrôle les forces primordiales de la terre et du néant ; ses donjons ont éprouvé la cohésion des plus grands groupes.",
  },

  // ——— The Lord of the Rings Online ———
  "witch-king": {
    tagline: "Le Seigneur des Nazgûl",
    quote: "Aucun homme ne peut me tuer !",
    bio: "Chef suprême des Neuf et bras droit de Sauron, il terrorise l'Eriador depuis Carn Dûm et incarne l'effroi absolu du Seigneur Ténébreux.",
  },
  "tom-bombadil": {
    tagline: "Le maître de la Vieille Forêt",
    quote: "Le Vieux Tom est le maître, ses chansons sont plus fortes que tout.",
    bio: "Être énigmatique et joyeux de la Vieille Forêt, immunisé au pouvoir de l'Anneau Unique : sa nature insaisissable en fait l'une des entités les plus puissantes de la Terre du Milieu.",
  },

  // ——— ArcheAge ———

  // ——— Star Wars Galaxies ———
  "xizor": {
    tagline: "Le prince du Soleil Noir",
    quote: "Les affaires criminelles exigent une élégance que l'Empire ne comprend pas.",
    bio: "Dirigeant machiavélique du syndicat Black Sun, ce baron du crime manipule la galaxie dans l'ombre de la guerre civile.",
  },

  // ——— Phantasy Star Online (classique) ———
  "dark-falz-pso": {
    tagline: "L'ange noir de Ragol",
    quote: "Je suis la fin de votre civilisation, inscrite dans les étoiles.",
    bio: "Entité cosmique endormie au cœur de Ragol, réveillée par les expériences technologiques ; sa métamorphose en ange noir déchu a traumatisé toute une génération de pionniers.",
  },

  // ——— Ragnarok Online ———
  "surt": {
    tagline: "Le géant de feu",
    quote: "Quand mes flammes lécheront les cieux, Midgard ne sera plus.",
    bio: "Géant de feu primordial des donjons volcaniques, son épée flamboyante peut raser des armées et annonce la fin des temps prophétisée.",
  },

  // ——— Blade & Soul ———
  "yura": {
    tagline: "L'émissaire des ténèbres",
    quote: "Le destin ne s'écrit pas avec de l'encre, mais avec la trahison.",
    bio: "Ancienne disciple devenue émissaire de l'Empire du Chaos, maîtresse de l'illusion et de la manipulation politique, elle tire les ficelles des guerres entre clans.",
  },

  // ——— Cabal Online ———

  // ——— Lineage II ———
  "shilen": {
    tagline: "La déesse de la Mort et de la Lune",
    quote: "Que les ténèbres et le sang engloutissent ce monde ingrat !",
    bio: "Bannie par les autres divinités, elle est à l'origine de toutes les créatures monstrueuses et des dragons qui peuplent les terres d'Aden.",
  },

  // ——— Knight Online ———

  // ——— Atlantica Online ———

  // ——— Fiesta Online ———

  // ——— Perfect World ———

  // ——— TERA ———

  // ——— Silent Hill ———
  "james-sunderland": {
    tagline: "L'homme à la lettre de Mary",
    quote: "J'ai reçu une lettre… Le nom sur l'enveloppe était celui de Mary.",
    bio: "Homme torturé convoqué dans la ville cauchemardesque de Silent Hill par une lettre de sa femme décédée : son voyage dans la brume est une descente aux enfers psychologique.",
  },

  // ——— Alien: Isolation ———
  "xenomorphe": {
    tagline: "Le traqueur de Sevastopol",
    quote: "[Sifflement strident au-dessus des grilles du plafond]",
    bio: "Traqueur extraterrestre implacable et invincible qui patrouille la station Sevastopol ; son intelligence d'adaptation lui fait entendre le moindre bruit de sa proie.",
  },
  "amanda-ripley": {
    tagline: "La fille d'Ellen Ripley",
    quote: "Je ne vais pas mourir sur cette station.",
    bio: "Ingénieure de talent partie chercher des réponses sur la disparition de sa mère, elle fabrique ses propres outils pour survivre à l'enfer claustrophobe du vide spatial.",
  },

  // ——— Slender: The Eight Pages ———

  // ——— The Evil Within ———
  "sebastian-castellanos": {
    tagline: "L'inspecteur de STEM",
    quote: "Ce monde n'a aucun sens, mais je trouverai la sortie.",
    bio: "Inspecteur plongé dans un univers mental déformé et macabre créé par la machine STEM, il affronte ses pires phobies avec son arbalète et son instinct de survie.",
  },
  "the-keeper": {
    tagline: "Le bourreau au coffre-fort",
    quote: "[Bruit lourd du marteau à viande frappant le sol]",
    bio: "Créature terrifiante au visage enfermé dans un coffre-fort d'acier, armée d'un marteau gigantesque et de pièges à loup, elle se réincarne tant que sa boîte reste intacte.",
  },

  // ——— Outlast ———
  "trager": {
    tagline: "Le chirurgien de Murkoff",
    quote: "Regarde-moi ça, mon pote ! Un vrai partenariat d'affaires !",
    bio: "Ancien chirurgien sadique et haut placé de la corporation Murkoff, reconverti en tortionnaire dément dans l'asile, armé d'une paire de cisailles chirurgicales géantes.",
  },

  // ——— Dead Space ———
  "regenerateur": {
    tagline: "La chair qui revient",
    quote: "[Gémissement visqueux et régénération instantanée des membres tranchés]",
    bio: "Nécromorphe mutant capable de reconstituer ses tissus en quelques secondes, rendant les armes conventionnelles totalement inefficaces contre lui.",
  },

  // ——— Five Nights at Freddy's ———
  "springtrap": {
    tagline: "Le costume qui marche",
    quote: "I always come back.",
    bio: "Le tueur d'enfants originel, piégé et broyé dans un costume d'animatronique vermoulu, hante les couloirs du labyrinthe en portant sa propre tombe.",
  },

  // ——— Until Dawn ———
  "wendigo": {
    tagline: "Le tabou de Blackwood",
    quote: "[Cris stridents et mimétisme vocal glaçant dans la montagne]",
    bio: "Humains transformés en créatures cannibales après avoir transgressé un tabou ancestral, sur les pentes isolées de Blackwood Mountain.",
  },

  // ——— Layers of Fear ———
  "peintre": {
    tagline: "L'artiste et sa toile",
    quote: "Il me manque encore un pigment… quelque chose de personnel.",
    bio: "Artiste brillant consumé par la folie, il erre dans sa demeure victorienne dont l'architecture se tord au rythme de ses souvenirs et de ses toiles macabres.",
  },

  // ——— Project Zero ———
  "femme-cheveux-denoues": {
    tagline: "L'esprit de la Camera Obscura",
    quote: "[Gémissements spectraux et apparition soudaine à travers l'objectif]",
    bio: "Esprit vengeur qui hante les demeures japonaises isolées, repoussé uniquement par la Camera Obscura, un appareil photo capable de capturer les âmes.",
  },

  // ——— Phasmophobia ———
  "demon": {
    tagline: "L'entité la plus agressive",
    quote: "[Sursaut agressif et baisse soudaine de la température ambiante]",
    bio: "L'une des entités les plus redoutées des enquêtes paranormales, capable d'attaquer les chasseurs de fantômes bien plus tôt que n'importe quel autre esprit.",
  },

  // ——— Dead by Daylight ———
  "ghost-face": {
    tagline: "L'ombre au couteau",
    quote: "[Inclinaison de tête menaçante dans l'obscurité avant le cliché mortel]",
    bio: "Maître de l'infiltration et de la traque psychologique, il observe ses victimes tapies dans l'ombre avant de fondre sur elles pour les terrasser par surprise.",
  },

  // ——— SOMA ———
  "simon-jarrett": {
    tagline: "La conscience sous la mer",
    quote: "Est-ce que je suis… humain ?",
    bio: "Homme du XXIe siècle dont la conscience a été transférée dans un corps de plongée robotique au fond de l'Atlantique, confronté aux derniers vestiges de l'humanité artificielle.",
  },

  // ——— Darkwood ———
  "passant": {
    tagline: "Le survivant de la forêt",
    quote: "[Grincement des planches et bruits de respiration derrière la porte barricadée]",
    bio: "Survivant solitaire dans une forêt est-européenne cauchemardesque, où chaque nuit passée à barricader son refuge est une lutte désespérée contre la folie.",
  },

  // ——— Dead Space (compléments) ———
  "mercer": {
    tagline: "Le dévôt de la Convergence",
    quote: "La convergence est notre évolution ultime, un don magnifique.",
    bio: "Scientifique fanatique de l'Église de Unitologie à bord de l'USG Ishimura, il voit dans l'épidémie nécromorphe une sainte transmigration vers l'unité divine.",
  },

  // ——— Amnesia: The Bunker ———
  "bete": {
    tagline: "La chose dans les murs",
    quote: "[Grattement furieux dans les murs et rugissement étouffé sous les tôles]",
    bio: "Créature monstrueuse et difforme surgie des entrailles du bunker de la Grande Guerre, elle traque le soldat Henri Clément au bruit de ses moindres mouvements.",
  },

  // ——— The Mortuary Assistant ———

  // ——— Iron Lung ———

  // ——— Manhunt ———
  "james-earl-cash": {
    tagline: "Le gibier devenu chasseur",
    quote: "Tu veux jouer à cache-cache ? Très bien…",
    bio: "Condamné à mort forcé de participer à des snuff movies orchestrés par un metteur en scène dément, il élimine ses poursuivants dans l'ombre avec une froideur absolue.",
  },

  // ——— Doki Doki Literature Club! ———
  "monika": {
    tagline: "Just Monika",
    quote: "Just Monika.",
    bio: "Présidente du club de littérature au charme faussement innocent, elle sait qu'elle vit dans un jeu vidéo et supprimerait ses propres amies pour s'emparer du joueur.",
  },

  // ——— Dead by Daylight (compléments) ———
  "chasseuse": {
    tagline: "La mère de la forêt",
    quote: "[Berceuse russe fredonnée doucement dans les bois sombres]",
    bio: "Femme sauvage habitant les profondeurs de la Red Forest, armée d'une hache et hantée par des souvenirs maternels tragiques.",
  },

  // ——— Project Zero (compléments) ———
  "kusabi": {
    tagline: "L'esprit du rituel",
    quote: "[Chant funèbre étouffé et lourdes chaînes traînant sur le sol]",
    bio: "Entité spectrale surpuissante liée aux rituels sacrificiels interdits du manoir Himuro, il terrasse ses proies par une aura maléfique écrasante.",
  },

  // ——— Subnautica ———
  "leviatan-faucheur": {
    tagline: "La terreur des eaux troubles",
    quote: "[Cri de sonar strident et terrifiant dans les eaux troubles]",
    bio: "Prédateur marin colossal des zones peu profondes, capable de saisir un sous-marin entier entre ses mâchoires acérées.",
  },

  // ——— Signalis ———
  "elster": {
    tagline: "La promesse de la Replika",
    quote: "Je dois tenir ma promesse.",
    bio: "Androïde ouvrière en état de délabrement avancé, elle explore une installation minière soviétique surréaliste à la recherche de son partenaire oublié.",
  },

  // ——— Ori ———
  "kuro": {
    tagline: "La mère au cœur brisé",
    quote: "[Cris stridents et protection farouche de son dernier œuf menacé par la lumière]",
    bio: "Immense chouette géante au cœur consumé par la tragédie, elle fait de la forêt son royaume de deuil et de terreur après avoir perdu sa couvée à cause de la lumière de l'Arbre Esprit.",
  },
  "shriek": {
    tagline: "L'ombre de Niwen",
    quote: "[Souffle ténébreux et regard perçant terrassant les contrées de Niwen]",
    bio: "Créature corrompue et malformée, rejetée par les siens à cause de son apparence, elle incarne la tragédie absolue et la puissance destructrice des terres silencieuses de Niwen.",
  },

  // ——— Elden Ring (compléments) ———
  "tarnished": {
    tagline: "Le Sans-Éclat guidé par la Grâce",
    quote: "Mets un terme à mon tourment… Deviens le Seigneur d'Elden.",
    bio: "Guerrier sans éclat guidé par la grâce, ressuscité pour affronter les demi-dieux corrompus et revendiquer le trône du Cercle d'Elden dans l'Entre-Terre.",
  },
  "ranni": {
    tagline: "La sorcière de la Nuit des Étoiles",
    quote: "Je suis Ranni. Je dérobe l'Ordre d'or et j'apporte la Nuit.",
    bio: "Princesse ténébreuse à quatre bras, architecte d'un complot cosmique pour libérer le monde de l'emprise des dieux et inaugurer un âge des étoiles.",
  },

  // ——— Bloodborne ———
  "hunter-bloodborne": {
    tagline: "Le chasseur de Yharnam",
    quote: "Mets fin au cauchemar… une bonne fois pour toutes.",
    bio: "Voyageur nocturne arpentant les rues gothiques de Yharnam, armé d'une scie-coton et d'une torche face à la marée des bêtes et des Grands Anciens.",
  },

  // ——— Cyberpunk 2077 ———
  "v": {
    tagline: "La légende de Night City",
    quote: "Une vie brève et intense, c'est tout ce qui compte à Night City.",
    bio: "Mercenaire urbain suréquipé, luttant contre la montre et contre l'égo numérique de Johnny Silverhand logé dans son esprit pour graver sa légende dans Night City.",
  },

  // ——— The Elder Scrolls V: Skyrim ———
  "lydia": {
    tagline: "La porteuse de fardeaux",
    quote: "Je suis à vos ordres, mon Farl. Je suis liée à vos fardeaux.",
    bio: "Fidèle huscarl de Bordeciel, connue de tous les aventuriers pour sa loyauté absolue et sa patience face au bric-à-brac du Dragonborn.",
  },
  "maiq": {
    tagline: "Le Khajiit qui sait tout",
    quote: "M'aiq sait beaucoup de choses, mais M'aiq ne dit pas tout.",
    bio: "Voyageur khajiit excentrique arpentant Tamriel depuis plusieurs époques, il distribue aux passants des réflexions étranges, des vérités troublantes et des mensonges éhontés.",
  },

  // ——— Fallout ———
  "dogmeat": {
    tagline: "Le compagnon des terres désolées",
    quote: "[Aboiement joyeux en désignant une cache de munitions]",
    bio: "Compagnon canin le plus fidèle du Commonwealth, toujours prêt à dénicher du matériel utile ou à mordre le bras d'un pillard en plein combat.",
  },
  "vendeur-vault-tec": {
    tagline: "L'émissaire de Vault-Tec",
    quote: "Bonjour ! Je suis l'émissaire de Vault-Tec !",
    bio: "Représentant de commerce hyperactif qui a vendu l'accès à l'Abri 111 juste avant les explosions, retrouvé des siècles plus tard en goule, nostalgique de sa mallette.",
  },

  // ——— Mass Effect ———
  "conrad-verner": {
    tagline: "Le plus grand fan de Shepard",
    quote: "Commandant ! Signez mon armure, s'il vous plaît !",
    bio: "Fan absolu du commandant Shepard, il tente d'imiter ses exploits à travers la galaxie avec une maladresse permanente et un enthousiasme débordant.",
  },

  // ——— Borderlands ———
  "claptrap": {
    tagline: "Le dernier CL4P-TP de Pandore",
    quote: "Si je devais résumer notre amitié en un mot : LÉ-GEN-DAIRE !",
    bio: "Dernier robot de la gamme CL4P-TP sur Pandore, connu pour son moulin à paroles insupportable, ses danses loufoques et son incapacité tragique à monter les escaliers.",
  },
  "face-mcshooty": {
    tagline: "Une balle, c'est tout",
    quote: "TIRE-MOI DANS LA TÊTE ! DANS LA TÊTE !",
    bio: "Sbire dérangé de Pandore dont l'unique souhait est de recevoir une balle en pleine tête d'un chasseur de l'Arche, pour l'une des quêtes les plus absurdes du jeu.",
  },

  // ——— Cyberpunk 2077 (compléments) ———
  "jackie-welles": {
    tagline: "Le frère de Heywood",
    quote: "À la vôtre, ami. Vers les sommets de Night City !",
    bio: "Mercenaire au grand cœur et meilleur ami de V dans les bas-fonds de Heywood, son rêve d'intégrer la cour des grands le mène au casse de l'Arasaka Tower.",
  },

  // ——— Metal Gear Solid (compléments) ———
  "johnny-sasaki": {
    tagline: "Le soldat aux intestins capricieux",
    quote: "Mon ventre… encore…",
    bio: "Soldat de patrouille malchanceux souffrant de problèmes intestinaux à chaque crise majeure, devenu malgré lui un gag récurrent de la saga.",
  },

  // ——— Minecraft (compléments) ———
  "villageois": {
    tagline: "Le troqueur d'émeraudes",
    quote: "Hmmm ?",
    bio: "Habitant pacifique au grand nez qui peuple les villages du monde, toujours prêt à troquer des émeraudes contre quelques brins de blé ou des bâtons.",
  },

  // ——— Left 4 Dead ———
  "louis": {
    tagline: "L'optimiste de l'apocalypse",
    quote: "Des pilules ! J'ai besoin de pilules !",
    bio: "Analyste financier junior d'une bonne humeur inaltérable, armé d'un pistolet et d'une confiance absurde malgré les hordes de zombies qui ont englouti la ville.",
  },

  // ——— Team Fortress 2 ———
  "spy": {
    tagline: "Le traître bien habillé",
    quote: "Il pourrait être n'importe lequel d'entre nous…",
    bio: "Mercenaire élégant et mystérieux spécialisé dans l'infiltration, l'art du déguisement et les coups de poignard dans le dos — parfois littéralement dans le dos de ses alliés.",
  },
  "heavy": {
    tagline: "Le colosse et sa Sasha",
    quote: "Je pleure de joie ! Sasha, ma douce !",
    bio: "Colosse russe maniant une mitrailleuse lourde qu'il chérit plus que tout, capable d'encaisser une pluie de balles en riant aux éclats.",
  },

  // ——— Stardew Valley ———
  "m-qi": {
    tagline: "Le mystérieux commanditaire",
    quote: "Félicitations pour avoir relevé le défi.",
    bio: "Personnage énigmatique aux cheveux bleus, organisateur de défis secrets redoutables cachés aux quatre coins de la vallée.",
  },

  // ——— Hollow Knight (compléments) ———
  "cornifer": {
    tagline: "Le cartographe d'Hallownest",
    quote: "[Grelottement joyeux et bourdonnement d'une petite mélodie au fond des grottes]",
    bio: "Voyageur passionné par la cartographie, toujours repérable dans les recoins les plus sombres d'Hallownest à la lueur de sa bougie et au bruit de ses précieuses cartes.",
  },

  // ——— Hades ———
  "hypnos": {
    tagline: "Le gardien du guichet des Enfers",
    quote: "Oh, salut ! Tu es mort encore une fois, hein ?",
    bio: "Dieu du Sommeil et préposé à l'accueil des Enfers, il passe son temps à comptabiliser les échecs répétés de Zagreus avec un détachement absolu.",
  },

  // ——— Cuphead (compléments) ———
  "diable": {
    tagline: "Le créancier des Enfers",
    quote: "Il est temps de me rendre ce qui m'appartient : vos âmes !",
    bio: "Souverain sournois et musical des Enfers, animé d'un style rétro des années 1930, prêt à tout pour récupérer ses dettes.",
  },

  // ——— Dead Cells ———
  "prisonnier": {
    tagline: "Le décapité qui recommence",
    quote: "[Jet de tête sarcastique et silence obstiné]",
    bio: "Homoncule sans tête amnésique, ressuscitant inlassablement dans les souterrains de l'île pour tailler en pièces les infectés du royaume.",
  },

  // ——— Plants vs. Zombies ———
  "zombie-cone": {
    tagline: "La casquette de chantier de la mort",
    quote: "[Gémissement étouffé sous un cône de chantier orange]",
    bio: "Mort-vivant de base ayant eu la brillante idée de se coiffer d'une signalisation routière pour doubler sa résistance face aux petits pois.",
  },

  // ——— Katana Zero ———
  "zero": {
    tagline: "L'assassin sous sédatifs",
    quote: "Je n'ai pas le temps pour ça.",
    bio: "Vétéran de guerre sous traitement, capable de prévoir chaque mouvement et de trancher ses ennemis en un millième de seconde — à condition que la dose tienne.",
  },

  // ——— Untitled Goose Game ———
  "oie": {
    tagline: "Le fléau du village anglais",
    quote: "Honk !",
    bio: "Aviaire chaotique et sociopathe dont l'unique mission sur Terre est de pourrir la vie des villageois d'une campagne anglaise parfaitement tranquille.",
  },

  // ——— Hotline Miami ———
  "jacket": {
    tagline: "Le massacreur au masque d'animal",
    quote: "Vous aimez blesser les autres gens ?",
    bio: "Tueur silencieux masqué, il exécute des carnages sanglants à Miami au rythme d'une bande-son synthwave survoltée, sans jamais prononcer un mot.",
  },

  // ——— Don't Starve ———
  "wilson": {
    tagline: "Le savant perdu",
    quote: "Je vais devoir me fabriquer une torche si je veux survivre à cette nuit.",
    bio: "Scientifique gentleman un brin arrogant, piégé dans un monde ténébreux et loufoque où il doit compter sur son ingéniosité pour ne pas finir en repas pour monstres.",
  },

  // ——— Plants vs. Zombies (compléments) ———
  "tournesol": {
    tagline: "La fabrique à soleils",
    quote: "[Chansonnette enjôleuse produisant de précieux soleils dorés]",
    bio: "Plante de soutien indispensable sur le gazon, elle produit l'énergie solaire qui finance toutes les défenses botaniques du joueur.",
  },

  // ——— Among Us ———
  "imposteur": {
    tagline: "Celui qui n'est pas dans le vaisseau",
    quote: "Red was not an Impostor. (Du moins, c'est ce qu'il prétendait…)",
    bio: "Astronaute miniature en combinaison colorée, expert en sabotage de réacteurs et en éliminations furtives par les bouches d'aération.",
  },

  // ——— Fall Guys ———
  "fall-guy": {
    tagline: "Le haricot gélatineux",
    quote: "[Chute maladroite et rebond gélatineux sur un obstacle tournant]",
    bio: "Créature gélatineuse multicolore et attachante, qui s'aligne dans des épreuves d'obstacles délirantes où la chute est toujours garantie.",
  },

  // ——— Goat Simulator ———
  "pilgor": {
    tagline: "La chèvre qui piétine la physique",
    quote: "[Bêlement strident tout en piétinant les lois de la physique]",
    bio: "Caprin immortel et chaotique dont le seul but dans la vie est de semer le désordre, de fracasser des vitrines et de s'accrocher à tout avec sa langue collante.",
  },

  // ——— Shovel Knight ———
  "shovel-knight": {
    tagline: "Le chevalier à la pelle",
    quote: "Pour l'honneur, pour la justice, et pour la pelle !",
    bio: "Chevalier valeureux armé d'une robuste pelle polyvalente, capable de creuser des trésors autant que de fracasser des casques ennemis.",
  },

  // ——— Super Meat Boy ———
  "meat-boy": {
    tagline: "Un cube de viande très pressé",
    quote: "[Petits bruits de pas visqueux et éclaboussures de sang en continu]",
    bio: "Cube de viande rouge et courageux, fonçant à une vitesse folle à travers des pièges mortels et des scies circulaires pour sauver sa bien-aimée.",
  },

  // ——— Limbo ———
  "petit-garcon": {
    tagline: "Seul dans le noir et blanc",
    quote: "[Silence glacial dans un monde monochrome et menaçant]",
    bio: "Enfant perdu errant dans un univers en noir et blanc oppressant, aux prises avec des pièges mortels et des araignées géantes.",
  },

  // ——— Papers, Please ———
  "inspecteur": {
    tagline: "Le tampon de Grestin",
    quote: "Cause no trouble.",
    bio: "Fonctionnaire fatigué du poste frontière de Grestin, qui vérifie à longueur de journée des passeports non conformes pour nourrir sa famille.",
  },

  // ——— Disco Elysium ———
  "harry": {
    tagline: "Le détective en morceaux",
    quote: "Je ne sais pas qui je suis, mais je sais que je dois trouver ma chaussure gauche.",
    bio: "Détective alcoolique et amnésique aux prises avec ses multiples facettes intérieures, il enquête sur un meurtre tout en essayant de recoller les morceaux de sa psyché brisée.",
  },

  // ——— Pentiment ———
  "andreas": {
    tagline: "L'enlumineur de Tassing",
    quote: "L'histoire est écrite par ceux qui restent, mais les secrets appartiennent aux morts.",
    bio: "Maître enlumineur lettré et perspicace, il se retrouve malgré lui empêtré dans des affaires de meurtres au cœur de la Bavière du XVIe siècle.",
  },

  // ——— Outer Wilds ———
  "explorateur": {
    tagline: "Vingt-deux minutes avant la fin",
    quote: "[Notes mélodieuses de banjo résonnant face à l'immensité cosmique]",
    bio: "Astronaute intrépide explorant un système solaire minuscule, prisonnier d'une boucle temporelle de 22 minutes avant la supernova fatale.",
  },

  // ——— Katamari Damacy ———
  "prince": {
    tagline: "Le petit prince du cosmos",
    quote: "[Roulement frénétique d'une boule géante englobant tout sur son passage]",
    bio: "Minuscule prince royal chargé par son excentrique de père de rouler une boule magique pour ramasser meubles et habitants de la Terre, afin de recréer les étoiles.",
  },

  // ——— Octopath Traveler ———

  // ——— Darkest Dungeon ———
  "croise": {
    tagline: "La ferveur du Croisé",
    quote: "Faiblesse et hérésie devront être purgées !",
    bio: "Chevalier tourmenté par son passé, il brandit une épée sainte et une ferveur implacable pour purifier les donjons corrompus du manoir familial.",
  },

  // ——— Hotline Miami (compléments) ———
  "biker": {
    tagline: "Celui qui veut sortir du jeu",
    quote: "J'en ai assez de suivre leurs ordres stupides.",
    bio: "Mercenaire masqué armé d'un hachoir, il cherche à s'affranchir du mystérieux syndicat qui orchestre les carnages de la ville.",
  },

  // ——— Papers, Please (compléments) ———
  "jorji": {
    tagline: "Mon ami, tout est en règle",
    quote: "Mon ami ! Laisse passer Jorji, tout est totalement en règle !",
    bio: "Voyageur haut en couleur et récurrent, ses faux papiers grossièrement falsifiés ne passent jamais — mais il retente sa chance avec le sourire.",
  },

  // ——— Slime Rancher ———
  "beatrix": {
    tagline: "La fermière des slimes",
    quote: "[Aspiration joyeuse d'un slime rose rebondissant dans le Vacpack]",
    bio: "Courageuse aventurière spatiale installée sur une planète lointaine, elle consacre ses journées à élever de mignons petits slimes gélatineux.",
  },

  // ——— Untitled Goose Game (compléments) ———
  "jardinier": {
    tagline: "La victime préférée de l'oie",
    quote: "Hé ! Espèce de satanée volaille, lâche ce râteau !",
    bio: "Habitant paisible du village, victime permanente des pires crasses et provocations orchestrées par l'oie du quartier.",
  },

  // ——— Cuphead (compléments) ———
  "baroness": {
    tagline: "La reine des sucreries",
    quote: "Il est l'heure de passer à table, et le dessert, c'est vous !",
    bio: "Souveraine sucrée et redoutable du château de bonbons, elle commande une armée de friandises vivantes et un canon à sucre pour le moins dissuasif.",
  },

  // ——— Minecraft (compléments) ———
  "marchand": {
    tagline: "Deux lamas et des prix douteux",
    quote: "[Soupirs énigmatiques entouré de ses deux lamas cracheurs]",
    bio: "Voyageur mystérieux surgissant de nulle part avec ses lamas, il propose des échanges commerciaux souvent totalement absurdes.",
  },

  // ——— Subnautica (compléments) ———
  "rodeur": {
    tagline: "Le voleur de ferraille",
    quote: "[Grincement métallique de mâchoires arrachant des morceaux de l'Aurora]",
    bio: "Créature marine reptilienne fascinée par le métal, elle rôde bruyamment dans les forêts d'algues lumineuses à la recherche de ferraille.",
  },

  // ——— Conduite (octobre 2026) ———
  "tanner": {
    tagline: "Le chauffeur qui ne quitte jamais sa caisse",
    quote: "On va faire ça vite : toi et moi, un plein, et une course jusqu'au pont.",
    bio: "Ex-flic infiltré devenu l'as du volant de San Francisco, capable d'endosser n'importe quelle peau pour prendre la fuite entre deux voitures.",
  },
  // ——— Stratégie (octobre 2026) ———
  "thrawn": {
    tagline: "L'oeil bleu qui lit les civilisations",
    quote: "Une victoire sans compréhension n'est qu'un accident.",
    bio: "Grand Amiral chiss de l'Empire, stratège glacial qui étudie l'art, la culture et la psychologie de ses ennemis pour frapper exactement là où ils ne regardent pas.",
  },
  "napoleon": {
    tagline: "L'Empereur qui comptait en canons",
    quote: "L'impossible n'est pas français.",
    bio: "Génie militaire corse, il réorganise l'artillerie puis l'Europe entière, de ligne de bataille en coalition écrasée.",
  },
  "cesar": {
    tagline: "Le dictateur au glaive",
    quote: "Veni, vidi, vici.",
    bio: "Imperator romain et fin politique, il traverse le Rubicon pour conquérir Rome, de légions massées en manipules à la toute-puissance du Sénat.",
  },
  "duc-de-paille": {
    tagline: "Le seigneur le plus radin du désert",
    quote: "Du pain ? Du pain pour tout le monde ! (Et de la bière, mais pas trop.)",
    bio: "Seigneur porcin à la couronne dorée, il règne sur un château famélique, comptant chaque archer et chaque ferme avant d'envoyer ses voisins au cachot.",
  },
};

/** Fiches du catalogue de base, complétées par celles de l'atelier. */
export const CARD_LORE: Record<string, CardLore> = {
  ...BASE_CARD_LORE,
  ...ATELIER_LORE,
};

/** Contenu éditorial d'une carte, ou undefined si l'identifiant est inconnu. */
export function getCardLore(id: string): CardLore | undefined {
  return CARD_LORE[id];
}
