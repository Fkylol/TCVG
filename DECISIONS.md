# Décisions prises en autonomie

Chantier « rareté par popularité » — 25 octobre 2026.
Chaque décision non triviale est ici, avec sa raison et son effet. Les chiffres
mesurés sont dans `RAPPORT_FINAL.md`.

---

## 1. Périmètre et environnement

**1.1 — 594 cartes, pas 595.** La demande parle de 595 personnages ; la base
contient 594 cartes actives (le PDA de Subnautica a été retiré du catalogue le
25 octobre, voir `src/lib/changelog.ts`). Les parts cibles sont donc appliquées
au catalogue réel : **12 / 30 / 65 / 119 / 154 / 214**. Une carte retirée n'est
ni comptée ni modifiée.

**1.2 — Une seule base, donc instantané obligatoire.** L'étape 0 n'a trouvé
aucune base de test séparée (un seul projet Supabase, un seul schéma `public`).
Conformément à la consigne, un instantané complet a été créé et **sa
restauration a été testée** avant la moindre écriture :
`npm run popularity:snapshot` → 33 tables, 2 375 lignes, rejouées dans un schéma
`schema_test` puis comparées table par table (nombre de lignes + empreinte
md5 indépendante de l'ordre), schéma de test supprimé ensuite.
Le manifeste porte `verifiedAt` : les contrôles de `rarity:apply` vérifient sa
présence.

**1.3 — Migrations appliquées sur cette base unique.** `041` (modèle de données)
et `042` (devis de marché partagé, motifs de notification, clé de bandeau) sont
réversibles (`*.down.sql`). Aucune donnée existante n'est supprimée.

**1.4 — Contact Wikimedia.** `WIKI_CONTACT` n'est pas défini dans `.env` ;
l'agent HTTP utilise donc `https://tcvg.fun` comme contact, comme prévu par la
consigne. Signalé dans le rapport final.

---

## 2. Correspondance personnage / entité (étape 2)

**2.1 — Sources de candidats.** `wbsearchentities` sur les six langues
demandées pour la forme principale du nom, plus `en`/`fr` pour les variantes
(article retiré, nom sans prénom). En second recours seulement : recherche
plein texte **Wikipédia** (six langues) sur « nom + franchise » puis sur le nom
seul, titres résolus en identifiants par `wbgetentities&sites=`. C'est la
lecture littérale de la consigne (« puis recherche Wikipédia nom + franchise en
second recours ») ; `wbsearchentities` ne fait pas de plein texte et ne renvoie
rien pour deux mots.

**2.2 — Libellés et descriptions par `wbgetentities`, classes par SPARQL.**
Deux constats, mesurés :
1. Les requêtes `BIND(EXISTS { ?item wdt:P31/wdt:P279* wd:Q95074 })` dépassent
   le délai du service sur des lots de cinquante entités (> 60 s). Les types
   sont donc lus à plat (`?item wdt:P31 ?type`), la hiérarchie `P279+` est
   remontée une fois, et la fermeture transitive est calculée en mémoire.
2. Une requête SPARQL interrompue renvoie **HTTP 200 avec un résultat partiel
   et sans erreur** : « Final Fantasy IX » n'avait plus que son libellé
   japonais, donc le nom exact ne correspondait plus et la carte était rejetée.
   Les libellés, alias, descriptions et le nombre de liens de sites sont
   désormais lus par `wbgetentities` (50 identifiants, réponse complète), et les
   types par lots de 25, tout lot muet étant redemandé par paquets de 4.

**2.7 — Le titre d'article compte comme nom.** Plusieurs éléments n'ont pas de
libellé dans la langue de leur article (constaté sur `Q474573`). Le titre de
l'article Wikipédia est une source publique du nom, au même titre qu'un alias :
il est donc accepté pour l'indice « nom exact » (`+0,40`). Sans cela, des œuvres
et des personnages parfaitement documentés restaient introuvables.

**2.8 — Indice « nom complet de l'article » (0,25).** Le catalogue abrège
(« Tifa ») là où l'article donne le nom complet (« Tifa Lockhart »). Un indice
plus faible que le nom exact (0,25 au lieu de 0,40) est accordé quand le nom de
la carte **ouvre** un titre ou un libellé, mot entier, nom d'au moins quatre
caractères. Il ne suffit jamais seul (0,25 + 0,20 + 0,10 = 0,55, sous le seuil)
et reste sous 0,90, donc **jamais éligible aux Mythiques et Légendaires**
(contrôle d) : ces paliers exigent un nom exact. Décision prise parce que 337
cartes n'ont aucune correspondance sans lui, dont des personnages majeurs.

**2.3 — Classement des franchises.** Une franchise est rattachée à une entité
Wikidata si son libellé (dans une des six langues) **ou son titre d'article**
égale le nom de la franchise, ou commence par ce nom suivi de `:` / d'un espace
(cas « Clair Obscur » → « Clair Obscur: Expedition 33 »), **et** si son type est
jeu vidéo, série de jeux, franchise médiatique ou univers de fiction. À
égalité, la série, la franchise ou l'univers passe devant le jeu isolé (même
libellé « God of War »), puis le plus de liens de sites l'emporte. La série
parente (`P179`) est ajoutée comme ancre : c'est elle qui rattache Final Fantasy
IX à Final Fantasy. Une franchise sans entité après le premier passage est
revérifiée seule (des lots SPARQL revenaient vides sous charge).

**2.4 — Preuves de lien avec la franchise.** Trois preuves acceptées : l'entité
est présente dans une œuvre de la franchise (`P1441`, `P1080` ou `P170` croisés
avec les œuvres `P179` de la franchise), la franchise la cite dans ses
personnages (`P674`), ou sa **description** / un **titre d'article** cite le nom
de la franchise. C'est la troisième branche que le cahier des charges autorise
explicitement (« titre/description de l'article qui la cite »), bornée aux mots
entiers.

Deux garde-fous ajoutés après mesure :
- **Le libellé de l'entité ne prouve rien.** « Onsoku no Sonic » (personnage de
  One-Punch Man) contenait « Sonic » dans son nom et se retrouvait à 1,00 contre
  le vrai Sonic ; ce faux positif venait uniquement du libellé.
- **Franchise homonyme du personnage** (« Sonic », « Kirby », « Duke Nukem ») :
  quand le nom de la franchise est contenu dans celui de la carte, une citation
  du nom ne prouve rien, la preuve est ignorée et seul le rattachement par les
  œuvres compte.

**2.5 — Rejets.** Page d'homonymie (`P31 Q4167410`), page de liste
(`P279* Q13406463`), œuvre (`P279* Q386724`) ou jeu vidéo (`P279* Q7889`) :
score nul, quel que soit le reste.

**2.6 — Ambiguïté.** Seuil 0,75 et écart minimal 0,15 sur le deuxième candidat,
comme demandé. Aucun arbitrage manuel n'a été introduit : une carte ambiguë
reste `aucun`, avec le détail des candidats dans `match_notes`.

---

## 3. Données de fréquentation (étape 3)

**3.1 — Mois réellement observés.** La médiane porte sur les mois renvoyés par
l'API, jamais sur des mois complétés par des zéros : un article créé en juin n'a
pas « zéro vue » en janvier, il n'existait pas. Inventer des zéros aurait
pénalisé les pages récentes.

**3.2 — 404 = pas de données.** L'API de pages vues répond 404 quand l'article
n'existe pas dans cette langue ; c'est un résultat normal, pas un échec. Le
script distingue donc 404 (ignoré) et 429/5xx (nouvelles tentatives).

**3.3 — Redirections.** Les titres viennent des sitelinks Wikidata (titres
exacts, jamais devinés), puis sont normalisés via `action=query&redirects=1`
avant l'appel aux pages vues : un article renommé ne perd pas son trafic.

**3.4 — Débit.** 20 requêtes/seconde maximum sur les API MediaWiki/REST
(espacement de 50 ms), 2 requêtes/seconde sur SPARQL (service plus fragile),
attente exponentielle après un 429, trois tentatives, cache disque qui rend le
pipeline reprenable (`npm run popularity:match` relancé repart du cache).

**3.5 — Politique de données.** Seuls des identifiants, titres et nombres sont
stockés. Aucun texte d'article n'est copié.

---

## 4. Score de popularité (étape 4)

**4.1 — Rangs calculés sur tout le catalogue.** Les 594 personnages entrent dans
le calcul du rang, y compris ceux sans donnée (valeur 0) : c'est la lettre de la
consigne (« parmi tous les personnages »). Les cartes sans correspondance sont
ensuite écrasées par la règle de repli, elles ne profitent donc pas d'un rang
flatteur.

**4.2 — Égalités.** Départage déterministe par identifiant de carte, comme
demandé : deux scores égaux n'ont jamais le même rang, et deux exécutions
donnent le même classement.

**4.3 — Popularité des franchises.** Même formule (70 % pages vues, 30 %
langues, en rangs) appliquée à l'article de la franchise elle-même, parmi les
franchises. Elle ne sert qu'à la règle de repli (30 % du score de la franchise).

**4.4 — Franchise sans donnée.** Score 0, statut `aucun` : aucune valeur n'est
inventée pour départager ces cartes, elles finissent en bas de classement par
ordre d'identifiant.

**4.5 — Persistance.** `npm run popularity:score` écrit en base les colonnes de
l'étape 1 (correspondance, pages vues, score). Il ne touche jamais `rarity`.

---

## 5. Attribution des raretés (étape 5)

**5.1 — Effectifs exacts.** Les parts sont converties en effectifs par la
méthode du plus fort reste, ce qui garantit une somme égale au nombre de cartes
(594) : 12 / 30 / 65 / 119 / 154 / 214.

**5.2 — Priorité aux verrous.** `rarity_override` puis `rarity_locked` passent
avant le rang et consomment une place de leur palier. Aucune carte n'utilise ces
colonnes aujourd'hui (elles viennent d'être créées) : le mécanisme est en place
et testé.

**5.3 — Plafonds et place rendue.** Plafond de 3 Mythiques et 8 Légendaires par
franchise. Une carte bloquée descend d'un palier ; comme le compteur du palier
haut n'est pas consommé, la place revient de fait au personnage suivant. Le
rapport liste les cartes concernées.

**5.4 — Plafonds insatisfiables.** Si les plafonds rendent une cible
inatteignable (par exemple deux franchises seulement), le calcul descend les
cartes et le contrôle b échoue : rien n'est appliqué. C'est testé.

---

## 6. Contrôles (étape 6)

**6.1 — Contrôle d.** Les cartes appelées à devenir Mythiques ou Légendaires
avec une confiance < 0,90 sont revérifiées sur trois points (titre contenant le
nom, entité classée personnage fictif, œuvre rattachée à la franchise). Les
trois doivent tenir ; sinon le contrôle bloque.

**6.2 — Contrôle e.** Toute carte au-dessus de 10× la médiane de pages vues de
sa franchise est revérifiée. Si la vérification échoue, elle repasse en `aucun`
(règle de repli) et son score est recalculé **avant** la répartition : le
classement livré est celui d'après correction, pas celui d'avant.

**6.3 — Contrôle f : signalé, pas bloquant.** La consigne écrit « chaque booster
de genre a au moins 2 cartes dans chaque rareté de Commune à Rare, et les genres
qui manquent de cartes rares ou plus sont listés (ce n'est pas bloquant, mais
c'est signalé) ». La parenthèse porte sur le contrôle entier : la composition
des boosters de genre dépend du catalogue (Sport = 1 carte, Stratégie = 9), pas
du calcul de rareté, et bloquer l'application pour cela n'aurait pas de sens.
Le contrôle `f` reste donc visible dans le rapport, et `f2` liste les genres
sans carte Rare ou mieux.

**6.6 — Contrôle e : il porte sur la revérification.** Une carte au-dessus de
10× la médiane de sa franchise n'est pas un échec en soi : c'est une alerte à
revérifier. Après passage, soit elle est confirmée (titre, type, œuvre), soit
elle repasse en repli. Le contrôle échoue seulement si une carte reste sans
revérification, ce qui ne peut plus arriver : le verdict affiche le bilan
(3 anomalies, 3 confirmées, 0 rétrogradée).

**6.4 — Contrôle g.** L'instantané doit porter `verifiedAt`, et `rarity:apply`
exécute lui-même `npm test` (bloquant) au lieu de croire une déclaration.

**6.5 — Trois itérations maximum.** La boucle de correction est appliquée
manuellement (étape 2 → 4 → 5 → 6), chaque passage étant journalisé dans le
rapport. Aucune correction n'a consisté à abaisser un seuil pour faire passer un
contrôle.

---

## 7. Application (étape 7)

**7.1 — Une seule transaction.** Tout passe par un unique bloc `do $$ … $$` :
sauvegarde de `rarity_v1`, nouvelle rareté, `rarity_version` incrémentée,
`rarity_locked = true`, marché, journal, bandeau. Une erreur n'importe où annule
l'ensemble (testé : le SQL ne contient aucun `commit`).

**7.2 — Fourchette de prix partagée.** La migration 042 extrait le calcul de
`market_quote()` dans `_market_quote()` (même corps, même résultat) pour que le
script puisse l'appeler sans JWT. `market_quote()` garde exactement son contrat
pour les joueurs (authentification puis délégation) ; ses droits sont inchangés,
`_market_quote()` n'est accordée à personne.

**7.3 — Annulations.** Seules les annonces et ordres **actifs** dont la carte a
changé de rareté **et** dont le prix sort de la nouvelle fourchette sont
annulés, avec restitution (carte dans la collection du vendeur, Pixels réservés
rendus à l'acheteur, ligne dans `pixel_transactions`) et notification. Motifs
`listing_cancelled` / `order_cancelled` ajoutés à la contrainte et à l'écran
Notifications. L'historique des ventes (`trades`) n'est jamais touché.

**7.4 — Ce qui se met à jour tout seul.** Chances par booster, probabilités par
carte, pools de boosters, stats (puissance/aura), complétion de l'album et
couleurs de rareté sont **dérivés** de `cards.rarity` (SQL `card_booster_chances`,
`pack_stats`, `_draw_cards`, barème `STAT_BANDS`, tokens CSS). Rien n'est
recopié : le contrôle final vérifie que les fonctions de tirage lisent bien la
table. Un test interdit de coder en dur un effectif ou un pourcentage de rareté
dans l'app.

**7.5 — Bandeau 7 jours.** Clé `game_config.rarity_update` (`applied_at`,
`version`, `href`, `changed`), lue par le layout de jeu et affichée par
`RarityUpdateBanner` (fermable). La fenêtre de 7 jours est calculée côté
serveur : pas de tâche planifiée à maintenir ni d'état par joueur à stocker.

**7.6 — Journal.** Chaque application écrit une ligne `rarity_runs` (effectifs,
configuration, raretés d'avant, bilan : cartes changées, annulations, Pixels
rendus, version).

**7.7 — Une rareté attribuée ne bouge plus.** C'est la règle demandée : la
popularité sert à **fixer** une rareté une fois, pas à la faire monter et
descendre. Après application, **toutes** les cartes existantes passent en
`rarity_locked = true` ; un recalcul ultérieur les ignore (elles consomment une
place de leur palier) et ne classe que les **nouvelles** cartes. Une baisse de
popularité change donc le score affiché et l'explication, jamais le palier. Pour
recalculer l'ensemble, il faut explicitement `rarity:rollback` puis
`rarity:apply --yes` — deux gestes manuels, jamais automatiques.

---

## 8. Retour arrière

**8.1 — Ce qui est restauré exactement.** `rarity = rarity_v1`, `rarity_v1`
effacé, `rarity_version = 0`, `rarity_locked = false`, bandeau supprimé,
exécution marquée annulée (`rolled_back_at`). Le retour est testé de bout en
bout : application → contrôle → retour → comparaison carte par carte.

**8.2 — Ce qui n'est pas défait.** Les annonces et ordres annulés ne sont pas
réouverts : les cartes et les Pixels ont déjà été rendus, et le joueur a pu
entre-temps vendre, recycler ou échanger la carte. Recréer une annonce
reviendrait à écrire un état que personne n'a demandé. C'est la seule limite du
retour arrière, elle est dite dans le rapport et dans le script.

**8.3 — Aucun recalcul automatique.** Rien ne relance le calcul : `rarity:apply`
exige `--yes`, rejoue les contrôles et les tests, et repasse par le même chemin.

---

## 9. Divers

**9.1 — Palette de rareté inchangée.** Les clés `C/UC/R/SR/UR/L` et la table
`rarity_labels` ne bougent pas ; seule la répartition des cartes change.

**9.2 — Statistiques de carte.** `CARD_STATS` fixe la puissance et l'aura de
certains personnages connus. Ces valeurs restent bornées par le barème de la
nouvelle rareté (le code les ramène déjà dans la fourchette) : une carte qui
change de palier voit ses stats recadrées sans intervention.

**9.3 — Cache de travail non versionné.** `.popularity/` (jeu de données,
cache HTTP, aperçu) et `.snapshots/` sont dans `.gitignore` : ce sont des états
de travail, la vérité reste en base et dans `rarity_runs`.

**9.4 — Tirets de tirage non modifiés.** Les poids `booster_drop_rates` n'ont
pas été touchés (étape 8 = rapport seulement). L'ordre de repli du tirage
(`_draw_cards`) ignore `UC` — défaut antérieur au chantier, signalé dans le
rapport, non corrigé ici pour ne pas mélanger deux sujets.

**9.5 — Rien n'est appliqué : le contrôle (a) échoue.** Après trois itérations
de correction (source de candidats Wikipédia en six langues, libellés lus par
l'API au lieu de SPARQL, indice de nom complet, préférence de franchise
parapluie), la correspondance plafonne à **43,1 % (256/594)**. La consigne
exige 85 % et interdit d'inventer des données : les cartes restantes sont des
seconds rôles de GTA et de MMO qui n'ont ni article ni élément Wikidata
individuels, seulement des pages de liste que la consigne demande de rejeter.
`rarity:apply` refuse donc de tourner et **aucune rareté n'a bougé** :
`rarity_v1` est vide, `rarity_version` vaut 0 pour toutes les cartes, aucun
bandeau n'est posé, aucun marché n'est touché. Le détail de ce qui aurait été
appliqué est dans `RAPPORT_FINAL.md` (calcul à blanc), et les deux façons de
débloquer y sont écrites : documenter les cartes orphelines, ou abaisser
consciemment `CONTROLS.minMatchedShare`.

---

## 10. Parrainage (octobre 2026)

**10.1 — Le compteur d'ouvertures est un vrai journal.** `profiles.boosters_opened`
existait déjà, mais un compteur global ne dit pas *quand* les ouvertures ont eu
lieu. La migration 046 ajoute `booster_openings` (une ligne par booster ouvert,
`count` pour les ouvertures groupées) et `open_pack()` l'alimente côté serveur.
Le seuil de 20 se lit donc depuis l'inscription du filleul : un ×10 laisse dix
lignes et compte pour dix. Rien ne vient du navigateur.

**10.2 — `open_pack()` devient une enveloppe.** L'ancien tirage est renommé
`_open_pack_stock()` (non exécutable par les joueurs) ; la nouvelle enveloppe
essaie le stock normal, puis, sur `no_stock` uniquement, consomme le solde
`bonus_boosters` et refait le tirage. Le journal et l'évaluation du parrainage
sont écrits dans les deux cas. Le rollback renomme la fonction d'origine, ce qui
laisse les migrations réversibles.

**10.3 — Aucun jeton Discord n'est stocké.** Le cahier des charges autorisait le
jeton de rafraîchissement chiffré *ou* une nouvelle connexion Discord. La
deuxième voie a été retenue : `mfa_enabled` est lu à chaque retour OAuth avec le
scope `identify`, et le bouton « J'ai activé l'A2F, revérifier » redemande une
connexion. Conséquence assumée : entre deux connexions, la valeur peut être
ancienne ; une valeur absente est traitée comme « sans A2F », sans sanction, et
le paiement différé reste la voie sûre. Cela évite de garder un secret OAuth en
base et de demander `client_secret` à l'exploitant.

**10.4 — L'évaluation vit en SQL.** `evaluate_referral(id)` est une fonction
`security definer` : verrou de ligne, conditions, horodatage du seuil, décision
immédiate/différée, refus motivé et paiement. Le paiement est un `UPDATE
referrals SET status='paye' … WHERE status IN (…)` : la garde conditionnelle et
la contrainte unique `(user_id, reason, referral_id)` rendent un double paiement
impossible, même avec deux connexions simultanées (vérifié en base).

**10.5 — Les empreintes sont en HMAC-SHA256 salé.** L'IP et l'agent utilisateur
ne sont jamais écrits en clair ; le sel vient de `REFERRAL_HASH_SALT`, absent du
dépôt. Sans sel, aucune empreinte n'est produite et les contrôles de proximité
sont simplement inactifs : le parrainage continue de fonctionner.

**10.6 — Le plafond de parrainages en cours ne bloque pas l'inscription.** Le
filleul crée son compte normalement, sans parrainage ; un événement
`pending_cap` est journalisé et le parrain voit sur `/parrainage` combien
d'invitations n'ont pas pu être rattachées. C'est la lecture littérale de
« enregistrent le filleul sans parrainage et c'est indiqué au parrain ».

**10.7 — Les signaux anti-fraude ne sortent jamais.** Le joueur voit un refus
générique (« les conditions ne sont plus réunies ») ; les empreintes, seuils et
raisons internes (`same_ip`, `shared_ip_group`, `signup_burst`, `active_days`)
restent dans `referral_audit` et l'écran d'administration.

**10.8 — Aucune donnée existante supprimée.** La migration est additive. Le
rollback (`046_parrainage.down.sql`) supprime les colonnes et tables ajoutées,
retire les notifications de parrainage et remet `open_pack()` d'origine ; il
n'est pas destiné à être rejoué en production sans sauvegarde.

---

## 11. Cadres d'avatar (octobre 2026)

**11.1 — Une configuration TypeScript, des compteurs en base.** Les seuils et
les conditions sont dans `src/lib/frames.config.ts` uniquement. La base ne
connaît pas les seuils : elle agrège des compteurs (`frame_stats`) et applique
une liste d'identifiants validée par le serveur (`frame_apply`). C'est ce qui
permet d'ajouter un cadre sans migration et de faire évoluer le catalogue sans
réécrire de règles SQL.

**11.2 — `profiles.frame` devient un alias généré.** La colonne est renommée
`selected_frame_id` ; un alias généré `frame` est ajouté pour ne pas réécrire
les fonctions SQL existantes (classement, chat, échanges, marché). La valeur qui
fait foi est `selected_frame_id`, nullable ; l'interface et
`set_profile_style()` retombent sur un cadre acquis.

**11.3 — Pourcentages arrondis au supérieur.** Un seuil de 60 % sur 101
personnages demande 61 personnages : on n'arrondit jamais vers le bas, sinon le
seuil serait atteint avant le pourcentage annoncé. Les seuils sont recalculés à
chaque évaluation sur `playable_cards` (cartes et franchises actives).

**11.4 — Les déblocages sont permanents.** `user_frames` ne reçoit que des
insertions ; une vente, un échange ou un recyclage ne retire jamais un cadre.
Seul un ban (`suspended_at`) efface les cadres, avec une ligne d'audit ; un
retrait manuel d'administrateur est possible mais tracé.

**11.5 — L'évaluation est pure, l'écriture est atomique.** `evaluateFrameSet()`
ne touche pas la base et sert aux tests, au recalcul et au runtime.
`frame_apply` insère avec la clé `(user_id, frame_id)` et ne notifie que les
lignes réellement créées : deux évaluations simultanées ne peuvent pas produire
deux déblocages.

**11.6 — Le serveur évalue, pas le navigateur.** `frame_apply`, `frame_stats`
(ciblage d'un autre joueur), `frame_queue_list` et `frame_sweep_list` sont
réservés au service_role ou protégés par `auth.uid()`. Un joueur ne peut pas
s'attribuer un cadre depuis la console. Sans `SUPABASE_SERVICE_ROLE_KEY`, les
évaluations runtime sont ignorées ; `npm run db:frames` et la tâche planifiée
prennent le relais.

**11.7 — Une file d'évaluation plutôt qu'un trigger métier complexe.** Les
acquisitions (collection, ventes, échanges, ouvertures, parrainages payés,
connexions) alimentent `frame_eval_queue`. La tâche quotidienne traite la file
puis les joueurs les plus anciens à recalculer. La file évite de dupliquer la
logique de déblocage dans chaque fonction SQL.

**11.8 — `MIN_POOL_SIZE` fait partie de la condition de genre.** Un cadre de
genre à 100 % d'un pool de 9 cartes serait trivial : en dessous de
`MIN_POOL_SIZE` (15, la valeur des packs), il reste « Bientôt ». Course et Sport
sont prévus dans la configuration mais n'ont encore ni cartes ni pack : ils
apparaissent donc « Bientôt ».

**11.9 — Le maintien de 24 h est implémenté mais coupé.** Les prestiges 4 et 5
peuvent exiger `maintenanceHoursForPrestige45 = 24` ; la table `frame_pending`
garde la première date où la condition est remplie. La valeur par défaut reste
0 pour ne pas surprendre les joueurs pendant le développement.

**11.10 — Le Pionnier est daté au 1er novembre 2026.** Le seuil est dans la
condition (`before`). Les comptes créés avant cette date (les cinq comptes de
développement) sont éligibles une seule fois ; ensuite la condition est
indisponible, et le cadre n'est pas proposé comme « prochain objectif ».

**11.11 — Un exemple de saison inactif.** Le cadre « Estival » montre les
bornes `availableFrom` / `availableUntil` et l'animation, mais `active: false` :
il ne s'obtient pas et l'administration ne peut pas l'activer, car `active`
relève de la configuration. Une fois passé à `true` dans
`src/lib/frames.config.ts`, il devient réactivable depuis `/admin/cadres` (sa
fenêtre restant dans le passé pour l'instant).

**11.12 — Les secrets restent secrets côté serveur.** `buildFrameOverview()`
retire le nom, la description, la condition et les chiffres d'un cadre secret
non débloqué avant de les envoyer au navigateur. Le badge « secret » et
l'indication vague sont volontaires ; le reste n'est pas dans la réponse.

**11.13 — Les animations sont budgetées.** Le dégradé tourne par `transform`
seulement, uniquement s'il est visible (IntersectionObserver), si
`prefers-reduced-motion` est absent et si moins de quatre cadres sont déjà
animés. La page `/dev/frames` permet de forcer le rendu statique.

**11.14 — « Grand ouvreur » lit le journal, pas un compteur client.** Le plus
grand de `profiles.boosters_opened` et de la somme de `booster_openings` est
utilisé, ce qui couvre les comptes antérieurs au journal. Une ouverture ×10
laisse dix lignes et compte pour dix.

**11.15 — Le grandfathering ne couvre que quatre anciens cadres.** Le drapeau
`FRAME_FEATURES.grandfatherLegacyFrames` est désactivé. S'il est activé, il
conserve Acier/Jade/Améthyste/Or pour les comptes existants ; l'ancien
« Mythique » n'a pas d'équivalent dans la nouvelle grille et n'est pas repris.

**11.16 — Les anciens déblocages sont recalculés, pas conservés.** Le site est
en développement : `npm run db:frames` repart des seuils pour les cinq comptes
existants. Les sélections qui ne sont plus valides retombent sur le meilleur
cadre acquis (vérifié : deux sélections corrigées).
