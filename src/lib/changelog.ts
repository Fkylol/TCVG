export type UpdateEntry = {
  /** Date lisible, en français. */
  date: string;
  title: string;
  items: string[];
};

export type PlannedEntry = {
  title: string;
  text: string;
};

/**
 * Mises à jour publiées, de la plus récente à la plus ancienne.
 * Une entrée ne s'ajoute ici qu'une fois la fonctionnalité en ligne.
 */
export const UPDATES: UpdateEntry[] = [
  {
    date: "27 octobre 2026",
    title: "Bleu nuit, verre et dégradé : le site change de peau",
    items: [
      "Le noir mat et le vert lime laissent la place au bleu nuit de la vitrine des boosters : deux aurores, cyan à gauche et rose à droite, éclairent le haut de chaque page.",
      "Les titres passent en Syne, teintée du dégradé cyan, violet et rose ; le texte courant en DM Sans, les chiffres et les sur-titres en IBM Plex Mono.",
      "Le logo est maintenant dessiné : carré arrondi et cercle tracés dans le dégradé, à côté du mot TCVG. Il reste net à toutes les tailles.",
      "La barre du haut devient une pastille de verre qui flotte au-dessus du contenu, les boutons et les onglets des pastilles, et les panneaux des plaques translucides à grands coins arrondis.",
      "Les visuels de cartes, les posters de boosters et les dos de cartes ne changent pas.",
    ],
  },
  {
    date: "27 octobre 2026",
    title: "Un dos de carte aux couleurs du pack",
    items: [
      "Le dos des cartes est redessiné : cadre fin, treillis de losanges, anneaux concentriques et médaillon en verre portant l'emblème et le mot TCVG.",
      "Chaque booster a le sien : le dos reprend les couleurs de son pack — vert pour Action-aventure, ambre pour Plateforme, rouge pour Combat — et garde la lueur de la rareté qu'il cache.",
      "Il est maintenant dessiné par le site plutôt que photographié : net à toutes les tailles, de la vignette du pied de révélation au grand dos plein écran, et plus rien à télécharger.",
      "La carte qui sort du booster fait exactement la taille du sachet : ni plus large, ni plus haute, elle prend sa place sans que la scène change de gabarit.",
    ],
  },
  {
    date: "27 octobre 2026",
    title: "Des rangs plus nobles, des visuels qui se recadrent",
    items: [
      "Le podium du classement change de noms : le premier est Souverain, le deuxième Régent, le troisième Vizir.",
      "Un signalement ouvre désormais la carte concernée d'un seul clic : « Modifier la carte » charge son formulaire dans l'atelier.",
      "Dans l'atelier, le visuel d'une carte se recadre enfin en ligne : on glisse l'image dans l'aperçu, on zoome, on la garde entière ou on remplit le cadre — y compris pour une photo déjà en place.",
      "Deux défauts d'impression de plus peuvent sortir d'un booster : reverse, dont le foil passe sur le cadre en laissant l'illustration nette, et holo bleue, tirée en bleu froid. Reverse tombe un peu plus souvent que la bleue.",
    ],
  },
  {
    date: "26 octobre 2026",
    title: "Des visuels partout, des holos qui se voient",
    items: [
      "Trente-deux personnages qui s'affichaient encore avec un simple emoji ont reçu leur portrait : Roi Dadidou, Freya Crescent, Amarant Coral, Big Smoke, Antharas, le Tarnisé, l'Espion et le Heavy entre autres.",
      "Les dix-sept personnages sans visuel public quittent l'album, faute de source : Frank, Kadan, Morgana, Pan Gu, le Pilote et leurs homologues. Le catalogue jouable passe à 557 cartes, et leurs éventuelles copies sont effacées de la base.",
      "L'album d'un univers montre désormais la meilleure carte qu'on y a piochée — la plus rare, puis la plus puissante — au lieu d'un simple dégradé.",
      "Une carte tirée brillante ressemble enfin à une holo : sa pellicule iridescente reste allumée et dérive lentement, au lieu de garder le rendu d'une carte normale sous un badge « Holo ».",
      "Sur téléphone, les toiles d'araignée d'Halloween restent visibles (elles tombaient à 37 px de large) et les boosters replongent dans le noir : la souris fait office de torche, avec des baisses de tension.",
      "Toujours sur téléphone, l'ambiance est allégée pour laisser la page lisible : araignées ramenées dans les coins, brume plus basse et voile plus discret, deux chauves-souris au lieu de quatre, un bonbon toutes les deux secondes, et le bouton 🎃 remonte au-dessus du bouton Agora au lieu de flotter au milieu du contenu.",
    ],
  },
  {
    date: "26 octobre 2026",
    title: "Le booster s'ouvre en musique",
    items: [
      "L'enveloppe se déchire, l'aura monte et chaque carte se pose avec son propre son : une note pour une Commune, un accord complet pour une Mythique, avec un grave tenu sous les deux plus hautes raretés.",
      "Sur téléphone, la carte vibre à l'arrivée, plus franchement quand la rareté grimpe. Un bouton haut-parleur dans la barre de révélation coupe le son et les vibrations, et le choix est retenu pour les visites suivantes.",
      "Chaque carte posée est traversée d'un reflet, de plus en plus marqué à mesure que la rareté monte. Rien ne se déclenche avant le clic sur « Déchirer ». Les animations restent coupées si ton système demande de les réduire.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Les échanges arrivent en message privé",
    items: [
      "Une proposition d'échange est désormais annoncée en message privé Discord, envoyé par le bot du jeu, en plus de l'avis dans le site.",
      "Plus de case à cocher ni d'e-mail : le message part dès qu'un joueur propose une carte, à condition d'avoir rejoint le serveur Discord du jeu.",
      "Le message rappelle les deux cartes et le délai de 24 heures, avec un lien direct vers la page Échanges de L'Agora.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Adieu Course et Sport",
    items: [
      "Les boosters Course et Sport disparaissent : les six cartes qui n'existaient que pour eux quittent le catalogue, avec leurs visuels et leurs fiches.",
      "Le Mix et les huit autres packs de genre restent inchangés ; les cartes qui étaient aussi classées Course (Fall Guy, Tanner) gardent leur autre genre.",
      "Les collections, annonces et envies qui citaient une de ces cartes sont retirées avec elle ; le reste ne bouge pas.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Les raretés suivent la popularité",
    items: [
      "Chaque personnage est désormais classé d'après la fréquentation de son article Wikipédia sur douze mois, dans six langues, croisée avec le nombre de langues où il existe.",
      "Les six paliers gardent leurs proportions (Mythique 2 %, Légendaire 5 %, Épique 11 %, Rare 20 %, Peu commune 26 %, Commune 36 %), avec un plafond de trois Mythiques et huit Légendaires par franchise.",
      "Aucune carte n'est retirée d'une collection : seule la rareté change, et les chances de tirage avec elle. La page « D'où vient la rareté » détaille la méthode, les sources et la date du calcul.",
      "Les annonces et ordres d'achat dont le prix ne tenait plus dans la fourchette de la nouvelle rareté ont été annulés, cartes et Pixels rendus à leurs propriétaires.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Un profil plus calme",
    items: [
      "Le choix d'avatar tient sur deux rangées : le reste défile horizontalement au lieu d'allonger la page sur des dizaines de vignettes.",
      "Une recherche par personnage ou par franchise filtre la liste, sans tenir compte des accents ni des majuscules.",
      "L'avatar sélectionné reste visible même quand la recherche l'écarte : l'enregistrement ne peut plus l'effacer par inadvertance.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "La révélation ne se referme plus toute seule",
    items: [
      "Ouvrir un booster ne renvoie plus parfois à la liste en pleine animation, avec un booster consommé : l'ouverture ne rejoue plus le rendu serveur de la page avant la fermeture de la révélation.",
      "Les lots ×5 et ×10 se dévoilent désormais carte par carte, comme un ×1, au lieu de sauter directement au récapitulatif. Le bouton « Passer » reste là pour aller plus vite.",
      "Le stock, l'album et l'en-tête sont relus à la fermeture de la révélation, quand plus rien n'est animé.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Le PDA quitte le catalogue",
    items: [
      "Le PDA de Subnautica n'est pas un personnage : la carte sort des boosters, du marché et du catalogue annoncé.",
      "Elle est aussi effacée de la base et des collections, comme si elle n'avait jamais existé : le jeu est encore en développement, rien n'est conservé pour une carte retirée.",
      "Le catalogue jouable passe à 594 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Chaque booster reste dans son genre",
    items: [
      "Un booster MMO ne peut plus rendre de cartes d'un autre genre : le tirage ne quitte plus le pool du paquet, et les chances affichées ne comptent plus que les raretés réellement présentes dedans.",
      "Cause du mélange : le pool MMO ne comptait qu'une Commune et deux Peu communes pour cent cartes. Dès la deuxième carte, le tirage se repliait sur le catalogue entier.",
      "Les raretés MMO ont été recalculées : 10 Communes, 20 Peu communes, 21 Rares, 31 Super rares, 11 Légendaires et 7 Mythiques, au lieu de 1 · 2 · 4 · 11 · 44 · 38.",
      "Conséquence : le pack Stratégie n'annonce plus de chance de Mythique, puisqu'il n'en contient aucune.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Sur la piste et sur le champ de bataille",
    items: [
      "Onze personnages rejoignent l'album : Ryan Cooper, Razor, Cross et Rachel Teller pour Need for Speed, Le Stig pour Top Gear, Tanner pour Driver et Travis Pastrana pour DiRT.",
      "Puis le Grand Amiral Thrawn pour Star Wars: Empire at War, Napoléon Bonaparte et Jules César pour Total War, et le Duc de Paille pour Stronghold.",
      "Sept univers entrent au catalogue : Need for Speed, Top Gear, Driver, DiRT, Star Wars: Empire at War, Total War et Stronghold.",
      "Les boosters Course et Stratégie gagnent ainsi leurs premiers visages : 2 Légendaires, 1 Mythique et de quoi remplir les deux packs.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Enquêteurs et curieux",
    items: [
      "Treize personnages rejoignent l'album : Harry Du Bois pour Disco Elysium, Andreas Maler pour Pentiment, l'Explorateur pour Outer Wilds et le Prince pour Katamari Damacy.",
      "Puis Tressa Colzione pour Octopath Traveler, le Croisé pour Darkest Dungeon, Biker pour Hotline Miami, Jorji Costava pour Papers, Please, Beatrix LeBeau pour Slime Rancher.",
      "Enfin le Jardinier pour Untitled Goose Game, la Baronne Von Bon Bon pour Cuphead, le Marchand Ambulant pour Minecraft et le Rôdeur pour Subnautica.",
      "Sept univers entrent au catalogue : Disco Elysium, Pentiment, Outer Wilds, Katamari Damacy, Octopath Traveler, Darkest Dungeon et Slime Rancher.",
      "Papyrus figurait déjà dans l'album en Commune : il garde sa fiche et sa rareté actuelles.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Les nouveautés sortent enfin",
    items: [
      "Les cartes entrées au catalogue depuis moins de sept jours ont désormais cinq fois plus de chances de sortir d'un booster que les autres.",
      "Objectif : qu'une nouveauté se voie vraiment, au lieu de se diluer dans 571 personnages où elle ne sortait qu'une fois sur huit boosters.",
      "Le tirage par rareté ne bouge pas : seules les cartes récentes d'une même rareté sont favorisées entre elles.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Le chaos venu de l'indé",
    items: [
      "Dix personnages rejoignent l'album : Jacket pour Hotline Miami, Wilson P. Higgsbury pour Don't Starve, le Tournesol pour Plants vs. Zombies et l'Imposteur pour Among Us.",
      "Puis le Fall Guy pour Fall Guys, Pilgor pour Goat Simulator, Shovel Knight pour Shovel Knight, Meat Boy pour Super Meat Boy, le Petit Garçon pour Limbo et l'Inspecteur des Douanes pour Papers, Please.",
      "Neuf univers entrent au catalogue : Hotline Miami, Don't Starve, Among Us, Fall Guys, Goat Simulator, Shovel Knight, Super Meat Boy, Limbo et Papers, Please.",
      "Le pack Course compte enfin des candidats : le Fall Guy y déboule aux côtés de son pack Plateforme.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Indés et seconds couteaux",
    items: [
      "Douze personnages rejoignent l'album : Louis pour Left 4 Dead, l'Espion et le Heavy pour Team Fortress 2, et M. Qi pour Stardew Valley.",
      "Puis Cornifer pour Hollow Knight, Hypnos pour Hades, le Diable pour Cuphead, le PDA pour Subnautica, le Prisonnier pour Dead Cells, le Zombie au Cône pour Plants vs. Zombies, Zéro pour Katana Zero et l'Oie pour Untitled Goose Game.",
      "Huit univers entrent au catalogue : Left 4 Dead, Team Fortress 2, Stardew Valley, Hades, Dead Cells, Plants vs. Zombies, Katana Zero et Untitled Goose Game.",
      "GLaDOS et Sans figuraient déjà dans l'album, en Mythique et en Légendaire : ils gardent leur fiche et leur rareté actuelles.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Les seconds rôles entrent en scène",
    items: [
      "Dix personnages rejoignent l'album : Lydia et M'aiq le Menteur pour Skyrim, Canigou et le Vendeur de Vault-Tec pour Fallout, Conrad Verner pour Mass Effect et Claptrap et Face McShooty pour Borderlands.",
      "Puis Jackie Welles pour Cyberpunk 2077, Johnny Sasaki pour Metal Gear Solid et le Villageois pour Minecraft.",
      "Quatre univers entrent au catalogue : Skyrim, Fallout, Mass Effect et Borderlands.",
      "Solaire, Wheatley, Jaskier et Lamar Davis figuraient déjà dans l'album : ils gardent leur fiche et leur rareté actuelles.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "L'Entre-Terre et Yharnam",
    items: [
      "Quatre personnages rejoignent l'album : le Tarnisé et Ranni la Sorcière pour Elden Ring, le Chasseur pour Bloodborne et V pour Cyberpunk 2077.",
      "Deux univers entrent au catalogue : Bloodborne et Cyberpunk 2077.",
      "Geralt de Riv et le Chevalier de Hollow Knight figuraient déjà dans l'album : ils gardent leur fiche et leur rareté actuelles.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "La forêt d'Ori",
    items: [
      "Trois personnages d'Ori rejoignent l'album : Ori, Kuro et Shriek, entre la Lumière de l'Arbre Esprit et les terres silencieuses de Niwen.",
      "L'univers Ori entre au catalogue, à cheval sur Ori and the Blind Forest et Ori and the Will of the Wisps.",
      "Les trois cartes rejoignent les packs Action-aventure et Plateforme.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Dix cauchemars, sept mondes",
    items: [
      "Dix personnages rejoignent l'album : le Dr Mercer pour Dead Space, la Bête pour Amnesia: The Bunker, le Démon de la Morsure pour The Mortuary Assistant, le Pilote pour Iron Lung et James Earl Cash pour Manhunt.",
      "Puis Monika pour Doki Doki Literature Club!, la Chasseuse pour Dead by Daylight, Kusabi pour Project Zero, le Léviathan Faucheur pour Subnautica et Elster pour Signalis.",
      "Sept univers entrent au catalogue : Amnesia, The Mortuary Assistant, Iron Lung, Manhunt, Doki Doki Literature Club!, Subnautica et Signalis.",
      "Le pack Horreur passe de 52 à 62 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Dix cauchemars de plus",
    items: [
      "Dix nouveaux personnages d'horreur : le Dr Trager pour Outlast, le Régénérateur pour Dead Space, Springtrap pour Five Nights at Freddy's, le Wendigo pour Until Dawn, le Peintre pour Layers of Fear.",
      "Puis la Femme aux Cheveux Dénoués pour Project Zero, le Démon pour Phasmophobia, Ghost Face pour Dead by Daylight, Simon Jarrett pour SOMA et le Passant pour Darkwood.",
      "Dix univers entrent au catalogue : Outlast, Dead Space, Five Nights at Freddy's, Until Dawn, Layers of Fear, Project Zero, Phasmophobia, Dead by Daylight, SOMA et Darkwood.",
      "Le pack Horreur passe de 42 à 52 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Le pack Horreur s'épaissit",
    items: [
      "Six personnages d'horreur rejoignent l'album : James Sunderland pour Silent Hill 2, l'Xénomorphe et Amanda Ripley pour Alien: Isolation, Slender Man pour Slender: The Eight Pages, Sebastian Castellanos et The Keeper pour The Evil Within.",
      "Quatre univers entrent au catalogue : Silent Hill, Alien: Isolation, Slender: The Eight Pages et The Evil Within.",
      "Le pack Horreur passe de 36 à 42 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Neuf mondes, quinze héros",
    items: [
      "Quinze personnages rejoignent le booster MMO : le Roi-Sorcier d'Angmar et Tom Bombadil pour LOTRO, Kyprosa et Nui pour ArcheAge, le prince Xizor pour Star Wars Galaxies, Dark Falz pour Phantasy Star Online.",
      "Puis Surt pour Ragnarok Online, Yura pour Blade & Soul, le Sage de Licorne pour Cabal Online, Shilen pour Lineage II, Antares pour Knight Online, Ulysse pour Atlantica, Reto pour Fiesta, Pan Gu pour Perfect World et Lakan pour TERA.",
      "Neuf univers entrent au catalogue : The Lord of the Rings Online, ArcheAge, Star Wars Galaxies, Phantasy Star Online (classique, distinct de PSO2), Cabal Online, Knight Online, Atlantica Online, Fiesta Online et Perfect World.",
      "Le pool MMO passe de 85 à 100 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Dix mondes de plus",
    items: [
      "Quinze personnages rejoignent le booster MMO : Clockworks et Maflon pour Flyff, Tchar'zanek et Malekith pour Warhammer Online, Morgana et le Roi Arthur corrompu pour Albion Online, Kundun pour MU Online.",
      "Puis Yugo et Qilby pour Wakfu, J'Ula pour Star Trek Online, Lex Luthor et Brainiac pour DC Universe Online, Velskud pour Dragon Nest, Crucia pour Rift et Abhuva pour Rappelz.",
      "Dix univers entrent au catalogue : Flyff, Warhammer Online, Albion Online, MU Online, Wakfu, Star Trek Online, DC Universe Online, Dragon Nest, Rift et Rappelz. Yugo et Qilby rejoignent le Monde des Douze aux côtés de Dofus.",
      "Le pool MMO passe de 70 à 85 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Quatorze mondes en ligne",
    items: [
      "Vingt-cinq personnages rejoignent le booster MMO : Kerafyrm et Firiona Vie pour EverQuest, Antharas et Baium pour Lineage II, Baphomet et Valkyrie Randgris pour Ragnarok Online, le Mage Noir et Zakum pour MapleStory.",
      "Quatorze univers entrent au catalogue : EverQuest, Lineage II, Ragnarok Online, MapleStory, Aion, TERA, Blade & Soul, Black Desert Online, The Secret World, Phantasy Star Online 2, Age of Conan, City of Heroes, Tibia et WildStar.",
      "Le pool MMO passe de 45 à 70 personnages, avec des boss de raid, des dieux déchus et quelques figures de serveur devenues légendaires.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Vingt et un nouveaux visages",
    items: [
      "Vingt et un personnages rejoignent le catalogue : Tirion Fordring et Garrosh pour World of Warcraft, Venat, Haurchefant, Zenos, Aymeric et G'raha Tia pour FF XIV, Arpagone, Julith et Rushu pour Dofus, Palawa Joko pour Guild Wars 2.",
      "Quatre univers entrent au catalogue : RuneScape (le Roi Noir des Dragons, Zamorak, Zaros, le Grand Sage), The Elder Scrolls Online (Mannimarco, Cadwell), Lost Ark (Kadan, Brelshaza) et Star Wars: The Old Republic (Dark Malgus, Satele Shan).",
      "Le barème de puissance et d'aura est recalibré par rareté : Commune 1–40, Peu commune 41–55, Rare 56–70, Épique 71–85, Légendaire 86–95, Mythique 96–100. Chaque fiche affiche désormais ses valeurs exactes.",
      "Les grandes figures montent d'un cran : Arthas, Illidan, Emet-Selch, Goultard, Rushu, Zaros, Venat et Aurene deviennent Mythiques. Le booster MMO devient ouvrable, avec 45 personnages.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Boosters par lots",
    items: [
      "Le panneau d'un pack propose ×1, ×5 ou ×10 : le lot est plafonné au stock disponible, donc demander ×10 avec 7 boosters en ouvre 7.",
      "Un lot s'arrête proprement si le stock tombe en route : les boosters déjà ouverts restent en collection, et le récapitulatif montre toutes les cartes d'un coup.",
      "Le nombre de boosters disponibles apparaît dans l'en-tête, à côté des Pixels, et avance tout seul à chaque tranche de dix minutes.",
    ],
  },
  {
    date: "25 octobre 2026",
    title: "Les douze boosters, côte à côte",
    items: [
      "La page /boosters montre les douze packs d'un coup, dans l'ordre du catalogue : un clic sélectionne le pack, le panneau de droite affiche ses persos et ses chances, et le bouton Ouvrir ouvre celui-là.",
      "Chaque pack reste ouvrable en permanence : le seuil de personnages est la seule condition, et un pack trop court reste visible, grisé, avec sa progression jusqu'au seuil.",
      "Les posters gardent leur inclinaison propre et se redressent un par un, au survol comme à la sélection. Le sous-titre tient sur une seule ligne, quitte à s'abréger.",
      "Sur mobile, un tap sur un pack ouvre sa fiche en bas de l'écran.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "L'Agora ouvre les échanges",
    items: [
      "Depuis une annonce du chat, « Proposer un échange » envoie une proposition carte contre carte. La copie offerte quitte l'album dès l'envoi et y revient si l'offre est refusée, retirée ou expirée.",
      "Le destinataire accepte, refuse ou contre-propose depuis /agora/offres. Une acceptation est atomique : les deux cartes changent de main ensemble, ou aucune ne bouge.",
      "L'historique des échanges est immuable et les offres expirent après 24 heures. Une carte retirée du catalogue annule d'elle-même les propositions en cours.",
      "Chaque joueur peut recevoir une alerte e-mail en plus de la notification dans le site ; elle se coupe au même endroit.",
      "Une carte s'annonce aussi depuis sa fiche : « Proposer mon doublon » ou « Chercher cette carte » publie directement dans le salon habituel, sans repasser par le panneau du marché.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Le MMO s'invite au catalogue",
    items: [
      "Vingt-quatre personnages rejoignent le catalogue : six de World of Warcraft, six de Final Fantasy XIV, six de Dofus et six de Guild Wars 2. Chacun a sa rareté, ses statistiques et sa fiche.",
      "Un douzième booster, MMO, réunit ces quatre univers — guildes, donjons et raids, comme il se doit.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Les boosters passent en affiche",
    items: [
      "Les onze boosters sont désormais des posters dessinés : bandes crantées, trame de points, plis du plastique, titre en Anton et code-barres décoratif. Fini les images raster, tout reste net à toutes les tailles.",
      "Chaque pack a son illustration SVG originale, uniquement géométrique : montagnes, escaliers, épée runique, viseur, circuit, silhouettes… Aucun personnage ni logo existant.",
      "Le poster s'incline au pointeur (8° max), avec un reflet radial et un foil arc-en-ciel qui suivent le mouvement. Sur mobile, le gyroscope prend le relais après un premier appui ; le glissement du doigt reste le repli.",
      "La déchirure suit la bande crantée du haut, le pack tremble avant de céder, et « Passer l'animation » est disponible à tout moment. Le récapitulatif annonce « Nouveau » ou « Doublon ×N ».",
      "La planche de contrôle /dev/packs (réservée aux admins) montre les onze posters côte à côte.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Le classement passe au score",
    items: [
      "Le classement ne compte plus les cartes : il additionne la qualité de chaque personnage possédé, une seule fois. Les égalités se départagent au nombre de personnages, puis au total de cartes.",
      "La qualité de chaque carte est désormais synchronisée en base, pour que le classement se calcule sans exposer les collections.",
      "Chaque cadre verrouillé affiche sa progression — 8/10 personnages, 0/1 légendaire… — avec une jauge jusqu'au palier.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Le foil prend du relief",
    items: [
      "Le foil abandonne ses rayures d'arc-en-ciel pour une pellicule translucide : bandes larges, reflet spéculaire qui suit le pointeur et gravure métallique fine. L'illustration reste lisible.",
      "Chaque rareté a désormais son angle et sa teinte de pellicule, plutôt qu'un même arc-en-ciel pour toutes.",
      "Le catalogue ne garde que les personnages qui ont un visuel sur Wikipédia ou sur le wiki de leur franchise : Violet Sinclair, Bach et Russell Northrop sortent. Les copies déjà possédées restent dans les collections, marquées « Retirée ».",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Les misprints sortent de l'ombre",
    items: [
      "Environ une carte sur 125 naît avec un défaut d'impression : ghosting, cadre décalé ou foil qui déborde. La variante est annoncée à l'ouverture et reste visible dans ta collection.",
      "La fiche rappelle la variante de ta copie. C'est purement cosmétique : rareté, puissance et aura ne changent pas.",
      "Une carte retirée du catalogue garde sa place dans ta collection, mais son visuel n'est plus servi nulle part.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Les cartes prennent des couleurs",
    items: [
      "Chaque rareté a désormais son caractère : gris pour la Commune, vert pour la Peu commune, bleu pour la Rare, violet pour l'Épique, or pour la Légendaire et rose prismatique pour la Mythique. Bordure, badge et halo suivent la même couleur.",
      "Le foil est en calques : la fenêtre d'illustration pour la Rare, la carte entière pour l'Épique, les deux plus des paillettes pour la Légendaire, et un anneau prismatique qui dérive lentement pour la Mythique.",
      "Reflet et inclinaison suivent le pointeur ou le doigt ; tout s'éteint au repos, et les animations se coupent si ton système demande de les réduire.",
      "La révélation de booster a été allégée : mêmes effets, mais les calques invisibles ne sont plus rendus et l'éclat ne repeint plus tout l'écran. L'ouverture redevient fluide sur mobile.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Tes envies ont un prix",
    items: [
      "Sur la page Envies, chaque carte accepte un seuil : « préviens-moi sous ◆ X ». Laisse le champ vide pour être alerté à chaque annonce.",
      "Sous le seuil, l'alerte part dès la mise en vente ; au-dessus, elle attend que le prix descende et franchisse ton seuil.",
      "Une baisse qui reste sous ton seuil ne resonne pas : une notification par annonce et par montant, pas de cloche à chaque Pixel.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Tes envies sonnent à la porte",
    items: [
      "Quand une carte de ta liste d'envies arrive en vente, une notification t'attend — et une seconde si son prix baisse.",
      "Une seule alerte par annonce et par montant : remonter puis baisser un prix ne crée pas de doublon.",
      "Le vendeur n'est jamais prévenu de sa propre annonce, et une annonce déjà expirée ne notifie personne.",
      "Les alertes arrivent dans la même cloche que tes ventes et tes ordres servis.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Un œil sur le marché",
    items: [
      "Nouvelle page d'administration, réservée : volumes et commission sur 1 à 90 jours, meilleurs vendeurs, cartes échangées, rafales d'actions et les 50 dernières lignes du journal d'audit.",
      "Les échanges croisés — deux joueurs qui se revendent des cartes dans les deux sens — y sont signalés automatiquement, tout comme les comptes qui multiplient les actions.",
      "Le drapeau d'administrateur vit sur le profil et n'est jamais modifiable depuis le site : il s'accorde en base, par la commande npm run db:admin.",
      "À tous les autres, la page n'existe pas : elle répond 404 plutôt que d'afficher un écran d'accès refusé.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Le marché publie ses chiffres",
    items: [
      "En tête du marché, quatre compteurs : ventes et Pixels échangés sur 24 h puis sur 7 jours, commission détruite, annonces et ordres actifs.",
      "Chaque fiche carte affiche l'historique complet de ses ventes, holos comprises, avec un bouton pour charger la suite.",
      "Les ventes à l'achat immédiat entrent désormais dans l'historique du marché comme celles des ordres : plus de trou dans la cote ni dans les statistiques.",
      "Aucune identité n'apparaît dans ces agrégats : ni pseudo, ni identifiant de joueur.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Une cloche pour le marché",
    items: [
      "La cloche du header compte tes notifications non lues, et la page Notifications rassemble tes ventes, tes ordres servis et tes annonces expirées.",
      "Chaque ligne dit l'essentiel : le net crédité pour une vente, le prix payé pour un ordre, la copie revenue pour une expiration.",
      "Les notifications sont privées : tu ne vois que les tiennes, et personne ne peut en fabriquer — seuls les événements du marché les écrivent.",
      "Un bouton « Tout marquer comme lu » solde le compteur d'un coup.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Les annonces ont une date de fin",
    items: [
      "Une annonce expire au bout de 7 jours : la copie revient toute seule dans la collection du vendeur, sans démarche.",
      "Entre-temps, tu peux changer son prix depuis l'onglet « Mes annonces » : les mêmes bornes que la mise en vente s'appliquent, et si un ordre d'achat attend, la vente part aussitôt au nouveau prix.",
      "Le marché ne montre plus les annonces échues, et l'achat comme les ordres d'achat refusent une annonce expirée : aucun Pixel n'est immobilisé pour rien.",
      "Chaque changement de prix et chaque expiration laisse une ligne dans le journal d'audit, avec l'ancien montant et la raison d'annulation.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Le marché sous surveillance",
    items: [
      "Chaque annonce, ordre et vente laisse une ligne dans un journal d'audit privé — acteur, carte, montant, statut — que les joueurs ne peuvent ni lire ni modifier.",
      "Un plafond d'actions sur 10 minutes (15 annonces et ordres cumulés) calme les vendeurs pressés : au-delà, le message explique qu'il faut patienter, et rien n'est débité.",
      "Une carte retirée du catalogue n'est plus échangeable : l'annonce est refusée, et les annonces et ordres encore actifs sont purgés en rendant les cartes aux vendeurs et les Pixels réservés aux acheteurs.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Le marché a un carnet d'ordres",
    items: [
      "Depuis une fiche, « Poser un ordre d'achat » réserve ton prix maximum : dès qu'une annonce passe en dessous, l'achat se fait au prix de l'annonce et le surplus t'est rendu.",
      "Le carnet est public : la fiche affiche le nombre d'ordres et le meilleur prix, sans jamais nommer les joueurs.",
      "Nouvel onglet « Mes ordres » sur le marché : ordres en attente avec les Pixels réservés, bouton d'annulation, et historique des ordres servis ou remboursés.",
      "Chaque vente laisse une trace immuable : une ligne d'historique, un mouvement de Pixels par partie prenante, et une commission détruite plutôt que versée.",
      "L'achat immédiat reste disponible pour ceux qui ne veulent pas attendre.",
    ],
  },
  {
    date: "24 octobre 2026",
    title: "Les 409 cartes ont enfin une biographie",
    items: [
      "Toutes les fiches manquantes du catalogue importé sont écrites : 261 accroches et biographies de plus, du casting de Final Fantasy VI à Ōkami en passant par Resident Evil, Zelda, The Witcher, Life is Strange, Red Dead Redemption et Clair Obscur.",
      "Les personnages de GTA VI — Brian Heder, Cal Hampton, Boobie Ike, Dre'Quan Priest, Raul Bautista — ont leur fiche comme le reste de la saga.",
      "La section Biographie n'affiche plus « arrivera bientôt » : chaque carte possédée a son histoire, sauf si la fiche éditoriale en base est encore vide.",
      "Deuxième passe sur les sorties récentes : les fiches de Code Vein II, Resident Evil Requiem, Mafia: The Old Country et Crimson Desert suivent maintenant l'intrigue réelle de chaque jeu au lieu d'une présentation vague.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Fiches verrouillées, envies et retours au pack",
    items: [
      "Chaque carte de la liste des persos d'un pack mène maintenant à sa fiche, possédée ou non — et un lien en haut ramène à la modale, filtre et défilement compris.",
      "Dans la collection, un clic ouvre la carte au centre de l'écran sur fond assombri ; un clic sur la carte la retourne, Échap ou la croix referment.",
      "Sans la carte, la fiche reste verrouillée : rareté, chance par booster et aperçu grisé. Le contenu éditorial (biographie, apparitions, studio, voix, anecdotes) n'est lu côté serveur que si tu possèdes la carte.",
      "La fiche est découpée en sections numérotées — Aperçu, Biographie, Apparitions — avec une barre d'ancres pour sauter de l'une à l'autre. Les apparitions s'affichent en tableau média / titre.",
      "Nouvelle page Envies dans le menu : jusqu'à 200 cartes, avec retrait en un clic et la mention « possédée » si la carte est arrivée entre-temps.",
      "Dans la collection, chaque carte vendable a un bouton « Vendre » : la modale affiche la cote, la fourchette autorisée, la taxe de 5 % et le gain net avant de publier l'annonce.",
      "La fiche affiche « Dans les envies de N joueurs » à partir de trois envies, et « Ouvrir un booster » ouvre directement le pack qui a le plus de chances de donner la carte.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "La collection se retourne",
    items: [
      "Clique sur une carte de ta collection : elle se retourne et dévoile ses chiffres — puissance, aura, nombre de joueurs qui la possèdent et date à laquelle tu l'as obtenue.",
      "Le verso garde l'inclinaison et le reflet du recto : la carte suit toujours le pointeur, et la fiche du personnage reste accessible par le lien en bas.",
      "Les couleurs du verso suivent la rareté, du métal vert de la Peu commune à la dorure de la Légendaire.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "325 nouveaux personnages, 25 franchises de plus",
    items: [
      "Le catalogue passe de 84 à 409 cartes, avec les personnages de Retrogems : GTA, Final Fantasy VI/IX/X, Zelda, Resident Evil, SoulCalibur, Poppy Playtime, Code Vein, Life is Strange, Red Dead Redemption, Metal Gear, Star Fox, Metroid, Bully, Shenmue, Mafia, Duke Nukem, Bubsy, Ōkami et Clair Obscur.",
      "Chaque nouvelle carte a sa rareté (attribuée au rôle et à la notoriété du personnage), sa puissance et son aura, et rejoint les boosters de son genre dès maintenant.",
      "Les visuels viennent des wikis Fandom des franchises, comme pour les cartes existantes ; les personnages sans visuel libre gardent le dégradé et l'emoji.",
      "Les fiches des nouveaux personnages n'ont pas encore de biographie : elles seront écrites au fil de l'eau, le reste de la fiche (stats, rareté, collection) est déjà là.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Peu commune : six paliers de rareté",
    items: [
      "Une sixième rareté s'intercale entre la Commune et la Rare : la Peu commune, cadre vert et lettre U. Les paliers se lisent désormais C, U, R, E, L, M.",
      "Douze personnages passent Peu commune pour que le palier existe vraiment dans le pool.",
      "Les chances par carte sont rééquilibrées : 62 % de Commune, 25 % de Peu commune, 11,4 % de Rare, 1,4 % d'Épique, 0,15 % de Légendaire et 0,025 % de Mythique.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Onze boosters, cinq cartes et plus de boutique",
    items: [
      "Onze boosters thématiques (Mix, Action-aventure, Plateforme, RPG, FPS, Course, Indé, Combat, Horreur, Stratégie, Sport) remplacent les anciens. Ils s'ouvrent tous avec le stock gratuit, rechargeable d'un booster toutes les 10 minutes.",
      "Chaque booster contient désormais 5 cartes, tirées côté serveur : fermer la page pendant l'ouverture ne fait rien perdre.",
      "La page Boosters devient un sélecteur : grille des packs, panneau de détails avec la chance réelle par rareté, et liste des personnages du pack avec les manquants.",
      "Un pack dont le genre compte moins de 15 personnages est marqué « Bientôt » et s'ouvrira automatiquement quand le seuil sera atteint.",
      "L'achat de boosters en Pixels disparaît ; les Pixels restent pour le recyclage des doublons.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Ouverture carte par carte, statistiques et nouveau logo",
    items: [
      "Les boosters s'ouvrent une carte à la fois : un premier clic prépare la carte, le dos s'illumine selon la rareté, et un second clic la retourne. Bouton « Tout révéler » et récapitulatif en fin d'ouverture.",
      "Chaque carte reçoit une puissance et une aura (0–100), résumées par une note de qualité ; le score de collection s'affiche sur le profil.",
      "Nouveau logo, icône d'onglet et aperçu soigné quand tu partages un lien du site.",
      "Les avis et bugs envoyés depuis le site arrivent aussi par email, en plus d'être enregistrés.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Marché entre joueurs et visuels de boosters",
    items: [
      "Le marché ouvre : mets tes doublons en vente, achète avec des Pixels, avec 5 % de commission à la vente.",
      "Les prix sont recalculés sur les ventes récentes, dans une fourchette par rareté ; les holos se vendent dans une fourchette 3 × plus haute.",
      "La boutique affiche un visuel par thème, avec le Mix mis en avant comme pack vitrine.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Pixels et boosters payants",
    items: [
      "Les Pixels arrivent : 10 offerts toutes les 24 h, avec le solde affiché dans l'en-tête.",
      "Des boosters s'achètent en Pixels, avec les taux de rareté affichés et 2 % de holos.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Recyclage des doublons et connexion Discord",
    items: [
      "Les doublons normaux se recyclent en Pixels, un par un ou tous d'un coup, avec le prix affiché. Une copie normale de chaque carte est toujours conservée.",
      "Les cartes holo se recyclent à la main, pour trois fois la valeur de leur rareté.",
      "La connexion et l'inscription passent uniquement par Discord : plus de mot de passe à retenir.",
    ],
  },
  {
    date: "23 octobre 2026",
    title: "Franchises et genres",
    items: [
      "Les 84 cartes sont rattachées à leur franchise (32 univers) et à un ou plusieurs genres.",
      "Chaque carte affiche son numéro d'album (#01 Kratos, #71 Kirby) à la place des anciennes stats.",
      "La progression de l'album se prépare par franchise, avec les genres comme base des futurs boosters thématiques.",
    ],
  },
  {
    date: "Octobre 2026",
    title: "Connexion Discord et pied de page",
    items: [
      "Connexion et inscription avec un compte Discord.",
      "Un pied de page commun à toutes les pages, avec les raccourcis du site.",
      "Pseudo repris automatiquement depuis le compte Discord à l'inscription.",
    ],
  },
];

/** Ce qui est en préparation, sans date annoncée. */
export const PLANNED: PlannedEntry[] = [
  {
    title: "Duels",
    text: "Le score de duel (70 % puissance, 30 % aura) est déjà calculé pour chaque carte ; le mode de combat reste à concevoir. Toujours sans argent réel.",
  },
];
