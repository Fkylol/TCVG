# Rapport final — rareté par popularité

**Date :** 25 octobre 2026 · **Catalogue :** 594 cartes · **Version de rareté :** inchangée (0)

> **Verdict : rien n'a été appliqué.** Le contrôle (a) exige 85 % de correspondances
> valides ; le maximum atteint honnêtement est **43,1 % (256/594)**. Conformément à la
> consigne (« tous doivent passer, sinon n'applique RIEN »), `rarity:apply` refuse de
> tourner et les raretés en base sont exactement celles d'avant. Tout le reste est prêt :
> modèle de données, scripts, contrôles, page d'explication, retour arrière. Le détail de
> ce qui *aurait* été appliqué est ci-dessous, calculé à blanc.

---

## 1. Ce qui a été fait

| Étape | État | Détail |
| --- | --- | --- |
| 0 — environnement | fait | accès Wikimedia vérifié, base joignable, instantané vérifié |
| 1 — modèle de données | fait | migration `041` appliquée, `042` pour le marché |
| 2 — correspondance | fait, **insuffisant** | 256/594 (43,1 %) |
| 3 — pages vues | fait | 193 cartes, 144/152 franchises, 12 mois complets |
| 4 — score | fait | 0–100, 70/30, repli 30 % de la franchise |
| 5 — attribution | fait (à blanc) | effectifs exacts 12/30/65/119/154/214 |
| 6 — contrôles | **un échec bloquant** | voir §8 |
| 7 — application | **non exécutée** | refusée par le contrôle (a) |
| 8 — probabilités | fait | voir §12, aucun poids modifié |

## 2. Étape 0 — environnement

- **Réseau :** API Wikidata (`wbsearchentities`, SPARQL), API Wikipédia (recherche,
  `wbgetentities`) et API de pages vues répondent. Aucun blocage.
- **Base :** un seul projet Supabase, aucun environnement de test séparé. Un instantané
  complet a donc été pris **avant toute écriture** : 33 tables, 2 375 lignes, restaurées
  dans un schéma `schema_test` puis comparées table par table (lignes + empreinte md5
  insensible à l'ordre), schéma supprimé. Le manifeste porte `verifiedAt` ; le contrôle (g)
  exige cette marque.
- **Droits d'écriture :** vérifiés (migrations `041`/`042` appliquées, toutes deux
  réversibles : `041_popularite_rarete.down.sql`).
- **Contact Wikimedia :** `WIKI_CONTACT` absent de `.env` ; l'agent HTTP déclare
  `https://tcvg.fun`, comme prévu en repli. **À renseigner** pour une exécution de
  production.
- **Aucune écriture de rareté** n'a eu lieu : `rarity`, `rarity_v1`, `rarity_version` sont
  intactes.

## 3. Étape 1 — modèle de données

Table `cards` : `wikidata_id`, `wikipedia_titles` (jsonb par langue), `match_confidence`,
`match_status` (`auto`/`repli`/`aucun`), `match_notes` (jsonb), `pageviews_median_12m`
(jsonb), `sitelinks_count`, `popularity_score`, `popularity_computed_at`, `rarity_v1`,
`rarity_override`, `rarity_override_reason`, `rarity_locked`, `rarity_version`.

Table `franchises` : `wikidata_id`, `popularity_score`, mêmes colonnes de correspondance.
Clés de rareté inchangées (`C/UC/R/SR/UR/L`), index sur `popularity_score`.

## 4. Étape 2 — correspondance personnage / article

**Méthode.** Recherche d'entités par nom dans les six langues (en, fr, ja, es, de, pt),
puis, pour les cartes non résolues, recherche **plein texte Wikipédia** « nom + franchise »
et nom seul dans les six langues — c'est le second recours prévu par la consigne,
`wbsearchentities` ne faisant pas de plein texte. Barème : nom exact 0,40 · personnage
fictif 0,20 · lien avec la franchise 0,30 · article Wikipédia 0,10. Seuil 0,75, écart
minimal 0,15 avec le deuxième candidat. Pages d'homonymie, listes, œuvres et jeux rejetés
d'office.

Deux ajouts mesurés, documentés dans `DECISIONS.md` (§2.2 et §2.7–2.8) :

- **les libellés sont lus par l'API `wbgetentities`** : une requête SPARQL interrompue
  renvoie un résultat partiel sans erreur, et « Final Fantasy IX » n'avait plus que son
  libellé japonais ;
- **le titre d'article vaut libellé** pour l'indice « nom exact » ;
- **indice « nom complet » 0,25** quand le nom de la carte ouvre un titre
  (« Tifa » → « Tifa Lockhart »). Il ne suffit jamais seul (0,55) et reste sous 0,90,
  donc **inéligible aux Mythiques et Légendaires**.

**Résultat : 256 correspondances automatiques (43,1 %), 338 en repli.** Répartition des
refus :

- 78 cartes n'ont **aucun candidat de type personnage** (le nom existe, mais c'est une
  ville, une protéine, un groupe de musique…) — meilleur score 0,10 ;
- 90 cartes n'ont qu'un candidat à 0,50 (nom + article, sans type « personnage fictif ») ;
- 77 cartes plafonnent à 0,60 (personnage + article, **aucun lien de franchise prouvable**) ;
- 41 cartes plafonnent à 0,70 (nom exact + personnage + article, lien de franchise absent) ;
- 8 cartes sont **ambiguës** (deux candidats à égalité ou écart < 0,15) — ex. *Arthas*
  (Arthas Menethil / Lich King), *Claude* (GTA III / GTA 2) ; *Sonic* a été débloqué en
  retirant les libellés des preuves de franchise (le personnage de One-Punch Man atteignait
  1,00 grâce à son propre nom) ;
- le reste (52 cartes) se situe entre 0,25 et 0,55 : indices partiels, sous le seuil.

**Pourquoi 85 % est hors d'atteinte ici.** La majorité des cartes restantes sont des
seconds rôles de GTA, de MMO (Lineage 2, Aion, Tera, Blade & Soul, Dofus, Guild Wars 2…) ou
de jeux récents, qui **n'ont ni article Wikipédia ni élément Wikidata individuels** : ils
n'existent que dans des pages de liste (« Personnages de Final Fantasy VII », « List of God
of War characters »), que la consigne demande explicitement de rejeter. Vérifié sur un
échantillon de 16 cartes non résolues : 12 n'ont aucun article propre, 4 n'ont que des
listes ou des homonymes. Aucune donnée n'a été inventée pour combler l'écart.

## 5. Étape 3 — données récupérées

- **Pages vues :** API Wikimedia per-article, agent `user` (trafic humain), accès
  `all-access`, granularité mensuelle, **12 derniers mois complets** (2025-10 → 2026-09),
  redirections résolues avant l'appel. Médiane mensuelle par langue, jamais de mois
  complété par des zéros.
- **Couverture :** 193 cartes ont au moins une page vue, 144/152 franchises. Les cartes
  appariées sans pages vues n'ont pas d'article dans les six langues suivies.
- **Nombre de langues :** sitelinks Wikidata, comptés par l'API.
- **Débit :** 20 req/s sur les API, 2 req/s sur SPARQL, 3 tentatives, attente exponentielle
  après 429, cache disque (9 024 réponses) qui rend chaque étape reprenable.
- **Stockage :** titres, identifiants, nombres. **Aucun texte d'article.**

## 6. Étape 4 — score

Somme des médianes de pages vues toutes langues → `log10(1+x)` ; nombre de langues →
`log10(1+x)` ; chaque métrique en rang percentile parmi les 594 personnages ; score =
0,7 × percentile vues + 0,3 × percentile langues, sur 100. Égalités départagées par
identifiant de carte. Cartes en repli : 0,3 × score de leur franchise (0 si la franchise
n'a pas de données). Poids dans `rarity-distribution.config.ts`.

## 7. Étape 5 — attribution (à blanc)

Plafonds 3 Mythiques / 8 Légendaires par franchise. Aucune carte n'a d'`override` ni de
verrou aujourd'hui : le mécanisme est en place et testé. Une seule carte a été descendue
par un plafond (Bowser, Super Mario comptant déjà deux Mythiques).

## 8. Étape 6 — contrôles automatiques

Contrôles

- ❌ **Correspondances valides** — 43.1 % (256/594) — minimum 85 %
- ✅ **Effectifs par rareté** — Mythique 12/12 · Légendaire 30/30 · Épique 65/65 · Rare 119/119 · Peu commune 154/154 · Commune 214/214
- ✅ **Plafonds par franchise** — aucun dépassement
- ✅ **Confiance des Mythiques et Légendaires** — 12 Mythiques et 30 Légendaires, tous à 0.9+ ou vérifiés
- ✅ **Anomalies de pages vues** — 3 carte(s) au-dessus de 10× la médiane de leur franchise : 3 confirmée(s), 0 repassée(s) en repli après revérification
- ⚠️ **Booster de genre : au moins 2 cartes par rareté (C → Rare)** — manque : Course Peu commune 1, Plateforme Peu commune 1, Sport Rare 0, Sport Peu commune 0, Sport Commune 1, Stratégie Rare 0
- ⚠️ **Genres pauvres en cartes rares** — Sport Rare, Sport Peu commune, Sport : aucune Rare ou mieux, Stratégie Rare, Stratégie : aucune Rare ou mieux
- ✅ **Instantané de la base vérifié** — instantané présent et restauration testée
- ❌ **Tests automatiques** — tests non passés pour cette exécution

Verdict : au moins un contrôle bloquant échoue.

- **(a) bloquant, en échec :** 43,1 % de correspondances valides, minimum 85 %.
- **(b) (c) (d) (e) (g) :** passent.
- **(f) :** signalé, non bloquant — la consigne précise « ce n'est pas bloquant, mais c'est
  signalé ». La pauvreté vient du catalogue (Sport = 1 carte, Stratégie = 9), pas du calcul.
- **(g2) tests :** `rarity:apply` exécute lui-même `npm test` ; l'aperçu ne peut pas le
  certifier, il affiche donc l'échec par prudence.

Correction tentée trois fois (source de candidats Wikipédia, lecture des libellés par
l'API, indice de nom complet, préférence de franchise parapluie) : 244 → 253 → 255 → **256**.
Le plafond est structurel, pas technique.

## 9. Ce que l'application aurait produit

Effectifs

| Rareté | Avant | Cible | Après | Δ |
| --- | ---: | ---: | ---: | ---: |
| Mythique | 29 | 12 | 12 | -17 |
| Légendaire | 73 | 30 | 30 | -43 |
| Épique | 115 | 65 | 65 | -50 |
| Rare | 111 | 119 | 119 | +8 |
| Peu commune | 137 | 154 | 154 | +17 |
| Commune | 129 | 214 | 214 | +85 |

Top 60

| # | Personnage | Franchise | Score | Avant | Après |
| ---: | --- | --- | ---: | --- | --- |
| 1 | Mario | Super Mario | 98.11 | Légendaire | Mythique |
| 2 | Sonic | Sonic | 97.59 | Légendaire | Mythique |
| 3 | Slender Man | Slender: The Eight Pages | 97.52 | Mythique | Mythique |
| 4 | Leon S. Kennedy | Resident Evil | 96.68 | Rare | Mythique |
| 5 | Michael De Santa | Grand Theft Auto | 96.64 | Légendaire | Mythique |
| 6 | Kratos | God of War | 96.61 | Légendaire | Mythique |
| 7 | Le Stig | Top Gear | 96.24 | Mythique | Mythique |
| 8 | Peach | Super Mario | 96.19 | Épique | Mythique |
| 9 | Yoshi | Super Mario | 96.16 | Commune | Mythique |
| 10 | Franklin Clinton | Grand Theft Auto | 96.12 | Légendaire | Mythique |
| 11 | Arthur Morgan | Red Dead Redemption | 95.99 | Mythique | Mythique |
| 12 | Bowser | Super Mario | 95.97 | Épique | Légendaire |
| 13 | Jill Valentine | Resident Evil | 95.73 | Mythique | Mythique |
| 14 | Ada Wong | Resident Evil | 95.7 | Légendaire | Légendaire |
| 15 | Shadow | Sonic | 95.33 | Rare | Légendaire |
| 16 | Kirby | Kirby | 95.31 | Mythique | Légendaire |
| 17 | Dr. Eggman | Sonic | 95.3 | Peu commune | Légendaire |
| 18 | Luigi | Super Mario | 94.94 | Commune | Légendaire |
| 19 | Chris Redfield | Resident Evil | 94.76 | Légendaire | Légendaire |
| 20 | Roi Dadidou | Kirby | 94.25 | Commune | Légendaire |
| 21 | Chun-Li | Street Fighter | 94.18 | Peu commune | Légendaire |
| 22 | Claire Redfield | Resident Evil | 94.1 | Légendaire | Légendaire |
| 23 | Springtrap | Five Nights at Freddy's | 93.98 | Mythique | Légendaire |
| 24 | Steve | Minecraft | 93.96 | Commune | Légendaire |
| 25 | Solid Snake | Metal Gear | 93.95 | Mythique | Légendaire |
| 26 | Knuckles | Sonic | 93.51 | Peu commune | Légendaire |
| 27 | Huggy Wuggy | Poppy Playtime | 93 | Légendaire | Légendaire |
| 28 | Ryu | Street Fighter | 93 | Épique | Légendaire |
| 29 | Geralt de Riv | The Witcher | 92.87 | Légendaire | Légendaire |
| 30 | Master Chief | Halo | 92.87 | Légendaire | Légendaire |
| 31 | Niko Bellic | Grand Theft Auto | 92.83 | Légendaire | Légendaire |
| 32 | Samus Aran | Metroid | 92.83 | Légendaire | Légendaire |
| 33 | Melvin Harris | Grand Theft Auto | 92.75 | Rare | Légendaire |
| 34 | John Marston | Red Dead Redemption | 92.58 | Légendaire | Légendaire |
| 35 | Trevor Philips | Grand Theft Auto | 91.85 | Légendaire | Légendaire |
| 36 | Cloud Strife | Final Fantasy VII | 91.84 | Légendaire | Légendaire |
| 37 | Sephiroth | Final Fantasy VII | 91.8 | Mythique | Légendaire |
| 38 | Creeper | Minecraft | 91.55 | Commune | Légendaire |
| 39 | Jake Muller | Resident Evil | 91.5 | Commune | Légendaire |
| 40 | Carl Johnson | Grand Theft Auto | 91.47 | Mythique | Légendaire |
| 41 | Tifa | Final Fantasy VII | 91.43 | Rare | Légendaire |
| 42 | Piers Nivans | Resident Evil | 91.32 | Rare | Légendaire |
| 43 | Zelda | The Legend of Zelda | 91.28 | Épique | Épique |
| 44 | Raul Bautista | Grand Theft Auto | 90.94 | Rare | Épique |
| 45 | Tommy Vercetti | Grand Theft Auto | 90.88 | Légendaire | Épique |
| 46 | Ganondorf | The Legend of Zelda | 90.71 | Mythique | Épique |
| 47 | Lucia Caminos | Grand Theft Auto | 90.52 | Rare | Épique |
| 48 | Doom Slayer | DOOM | 90.42 | Légendaire | Épique |
| 49 | Fox McCloud | Star Fox | 90.07 | Mythique | Épique |
| 50 | Jason Duval | Grand Theft Auto | 89.95 | Rare | Épique |
| 51 | Yoshimitsu | SoulCalibur | 89.9 | Épique | Épique |
| 52 | Avery Carrington | Grand Theft Auto | 89.83 | Commune | Épique |
| 53 | GLaDOS | Portal | 89.78 | Mythique | Épique |
| 54 | Sonny Forelli | Grand Theft Auto | 89.71 | Rare | Épique |
| 55 | Gordon Freeman | Half-Life | 89.68 | Rare | Épique |
| 56 | Dre'Quan Priest | Grand Theft Auto | 89.58 | Peu commune | Épique |
| 57 | Cal Hampton | Grand Theft Auto | 89.21 | Peu commune | Épique |
| 58 | Ethan Winters | Resident Evil | 89.19 | Peu commune | Épique |
| 59 | Sans | Undertale | 89.06 | Légendaire | Épique |
| 60 | Brian Heder | Grand Theft Auto | 89.04 | Commune | Épique |

Changements de deux paliers ou plus (220)

- Leon S. Kennedy — Rare → Mythique (score 96.68)
- Peach — Épique → Mythique (score 96.19)
- Yoshi — Commune → Mythique (score 96.16)
- Shadow — Rare → Légendaire (score 95.33)
- Dr. Eggman — Peu commune → Légendaire (score 95.3)
- Luigi — Commune → Légendaire (score 94.94)
- Roi Dadidou — Commune → Légendaire (score 94.25)
- Chun-Li — Peu commune → Légendaire (score 94.18)
- Steve — Commune → Légendaire (score 93.96)
- Knuckles — Peu commune → Légendaire (score 93.51)
- Melvin Harris — Rare → Légendaire (score 92.75)
- Creeper — Commune → Légendaire (score 91.55)
- Jake Muller — Commune → Légendaire (score 91.5)
- Tifa — Rare → Légendaire (score 91.43)
- Piers Nivans — Rare → Légendaire (score 91.32)
- Ganondorf — Mythique → Épique (score 90.71)
- Fox McCloud — Mythique → Épique (score 90.07)
- Avery Carrington — Commune → Épique (score 89.83)
- GLaDOS — Mythique → Épique (score 89.78)
- Dre'Quan Priest — Peu commune → Épique (score 89.58)
- Cal Hampton — Peu commune → Épique (score 89.21)
- Ethan Winters — Peu commune → Épique (score 89.19)
- Brian Heder — Commune → Épique (score 89.04)
- Jeffrey Cross — Peu commune → Épique (score 88.99)
- Helena Harper — Peu commune → Épique (score 88.97)
- Ripto — Commune → Épique (score 88.97)
- Kent Paul — Peu commune → Épique (score 88.79)
- Cesar Vialpando — Commune → Épique (score 88.36)
- Sheva Alomar — Commune → Épique (score 88.11)
- Jack Marston — Peu commune → Épique (score 86.69)
- Carlos Oliveira — Commune → Épique (score 86.46)
- Yennefer — Peu commune → Épique (score 85.78)
- Monika — Mythique → Épique (score 85.75)
- Midna — Commune → Épique (score 85.51)
- Flowey — Commune → Épique (score 83.71)
- Rebecca Chambers — Commune → Épique (score 83.56)
- L'Arbiter — Peu commune → Épique (score 83.27)
- Sherry Birkin — Commune → Épique (score 82.61)
- Alyssa Ashcroft — Peu commune → Épique (score 82.46)
- Wheatley — Commune → Épique (score 82.43)
- … et 180 autres.

Cartes descendues par le plafond de franchise (1)

- bowser — Mythique → Légendaire

### Répartition par franchise (extrait)

Par franchise

| Franchise | Cartes | Mythique | Légendaire | Épique | Rare | Peu commune | Commune |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Grand Theft Auto | 64 | 2 | 4 | 13 | 8 | 34 | 3 |
| The Legend of Zelda | 27 | 0 | 0 | 3 | 15 | 9 | 0 |
| Resident Evil | 22 | 2 | 5 | 10 | 0 | 5 | 0 |
| Final Fantasy VII | 21 | 0 | 3 | 5 | 4 | 9 | 0 |
| Final Fantasy X | 18 | 0 | 0 | 1 | 6 | 3 | 8 |
| Final Fantasy IX | 17 | 0 | 0 | 0 | 2 | 0 | 15 |
| Final Fantasy VI | 17 | 0 | 0 | 0 | 11 | 6 | 0 |
| Life is Strange | 16 | 0 | 0 | 0 | 4 | 1 | 11 |
| SoulCalibur | 15 | 0 | 0 | 1 | 10 | 1 | 3 |
| Code Vein | 14 | 0 | 0 | 0 | 0 | 0 | 14 |
| Poppy Playtime | 14 | 0 | 1 | 0 | 1 | 12 | 0 |
| The Witcher | 12 | 0 | 1 | 1 | 3 | 0 | 7 |
| Clair Obscur | 11 | 0 | 0 | 0 | 3 | 1 | 7 |
| Final Fantasy XIV | 11 | 0 | 0 | 0 | 1 | 10 | 0 |
| Metroid | 10 | 0 | 1 | 0 | 4 | 5 | 0 |
| Dofus | 9 | 0 | 0 | 0 | 0 | 0 | 9 |
| Red Dead Redemption | 9 | 1 | 1 | 2 | 2 | 1 | 2 |
| Shenmue | 9 | 0 | 0 | 0 | 1 | 0 | 8 |
| Bully | 8 | 0 | 0 | 0 | 2 | 2 | 4 |
| World of Warcraft | 8 | 0 | 0 | 0 | 6 | 2 | 0 |
| Guild Wars 2 | 7 | 0 | 0 | 0 | 0 | 0 | 7 |
| Metal Gear | 7 | 0 | 1 | 4 | 1 | 1 | 0 |
| Crimson Desert | 6 | 0 | 0 | 0 | 0 | 6 | 0 |
| Kirby | 6 | 0 | 2 | 1 | 1 | 0 | 2 |
| Minecraft | 5 | 0 | 2 | 0 | 0 | 3 | 0 |
| Star Fox | 5 | 0 | 0 | 2 | 3 | 0 | 0 |
| Super Mario | 5 | 3 | 2 | 0 | 0 | 0 | 0 |
| Bubsy | 4 | 0 | 0 | 0 | 0 | 0 | 4 |
| Cuphead | 4 | 0 | 0 | 0 | 1 | 0 | 3 |
| Elden Ring | 4 | 0 | 0 | 0 | 1 | 3 | 0 |
| God of War | 4 | 1 | 0 | 0 | 1 | 1 | 1 |
| Hollow Knight | 4 | 0 | 0 | 0 | 1 | 3 | 0 |
| Mafia | 4 | 0 | 0 | 0 | 0 | 0 | 4 |
| Need for Speed | 4 | 0 | 0 | 0 | 3 | 1 | 0 |
| RuneScape | 4 | 0 | 0 | 0 | 0 | 4 | 0 |
| Sonic | 4 | 1 | 3 | 0 | 0 | 0 | 0 |
| Banjo-Kazooie | 3 | 0 | 0 | 0 | 1 | 0 | 2 |
| Blade & Soul | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Castlevania | 3 | 0 | 0 | 2 | 1 | 0 | 0 |
| Dark Souls | 3 | 0 | 0 | 0 | 1 | 2 | 0 |
| Duke Nukem | 3 | 0 | 0 | 0 | 1 | 0 | 2 |
| Halo | 3 | 0 | 1 | 2 | 0 | 0 | 0 |
| Lineage II | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Ori | 3 | 0 | 0 | 0 | 1 | 0 | 2 |
| Overwatch | 3 | 0 | 0 | 0 | 3 | 0 | 0 |
| Pokémon | 3 | 0 | 0 | 0 | 0 | 3 | 0 |
| Portal | 3 | 0 | 0 | 2 | 1 | 0 | 0 |
| Ragnarok Online | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Spyro | 3 | 0 | 0 | 1 | 1 | 1 | 0 |
| Street Fighter | 3 | 0 | 2 | 0 | 0 | 1 | 0 |
| TERA | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| Undertale | 3 | 0 | 0 | 2 | 1 | 0 | 0 |
| Aion | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Albion Online | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Alien: Isolation | 2 | 0 | 0 | 1 | 0 | 0 | 1 |
| ArcheAge | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Black Desert Online | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Borderlands | 2 | 0 | 0 | 0 | 1 | 0 | 1 |
| City of Heroes | 2 | 0 | 0 | 0 | 2 | 0 | 0 |
| Crash Bandicoot | 2 | 0 | 0 | 1 | 1 | 0 | 0 |
| Cyberpunk 2077 | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| DC Universe Online | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Dead by Daylight | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| Dead Space | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Devil May Cry | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| EverQuest | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Fallout | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| Flyff | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Half-Life | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| Hotline Miami | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Kingdom Hearts | 2 | 0 | 0 | 1 | 0 | 1 | 0 |
| Lost Ark | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| MapleStory | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Ōkami | 2 | 0 | 0 | 0 | 1 | 0 | 1 |
| Papers, Please | 2 | 0 | 0 | 0 | 0 | 1 | 1 |
| Plants vs. Zombies | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Project Zero | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| Star Wars: The Old Republic | 2 | 0 | 0 | 0 | 1 | 1 | 0 |
| Subnautica | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| Team Fortress 2 | 2 | 0 | 0 | 0 | 1 | 0 | 1 |
| The Elder Scrolls Online | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| The Elder Scrolls V: Skyrim | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| The Evil Within | 2 | 0 | 0 | 0 | 1 | 0 | 1 |
| The Lord of the Rings Online | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| The Secret World | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Total War | 2 | 0 | 0 | 0 | 0 | 2 | 0 |
| Untitled Goose Game | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Wakfu | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Warhammer Online | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| WildStar | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| Age of Conan | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Amnesia | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Among Us | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Atlantica Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Bloodborne | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Cabal Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Celeste | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Darkest Dungeon | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Darkwood | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Dead Cells | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| DiRT | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Disco Elysium | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Doki Doki Literature Club! | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Don't Starve | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| DOOM | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Dragon Nest | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Driver | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Fall Guys | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Fiesta Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Five Nights at Freddy's | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Goat Simulator | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Hades | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Iron Lung | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Katamari Damacy | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Katana Zero | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Knight Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Layers of Fear | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Left 4 Dead | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Limbo | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Manhunt | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Mass Effect | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| MU Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| NieR | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| Octopath Traveler | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Outer Wilds | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Outlast | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Pentiment | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Perfect World | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Persona | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Phantasy Star Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Phantasy Star Online 2 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Phasmophobia | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Rappelz | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Rift | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Shovel Knight | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Signalis | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Silent Hill | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| Slender: The Eight Pages | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Slime Rancher | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| SOMA | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Splatoon | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Star Trek Online | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Star Wars Galaxies | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Star Wars: Empire at War | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Stardew Valley | 1 | 0 | 0 | 0 | 0 | 1 | 0 |
| Stronghold | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Super Meat Boy | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| The Mortuary Assistant | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Tibia | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| Top Gear | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Until Dawn | 1 | 0 | 0 | 0 | 0 | 1 | 0 |

### Répartition par genre de booster (nouvelles raretés)

| Genre | Cartes | Mythique | Légendaire | Épique | Rare | Peu commune | Commune |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Action-aventure | 214 | 4 | 9 | 28 | 48 | 76 | 49 |
| RPG | 142 | 0 | 4 | 11 | 36 | 36 | 55 |
| MMO | 100 | 0 | 0 | 0 | 10 | 17 | 73 |
| Horreur | 64 | 3 | 7 | 14 | 2 | 26 | 12 |
| Plateforme | 44 | 4 | 7 | 6 | 8 | 1 | 18 |
| Indé | 27 | 0 | 0 | 3 | 3 | 7 | 14 |
| FPS | 23 | 0 | 1 | 5 | 8 | 3 | 6 |
| Combat | 18 | 0 | 2 | 1 | 10 | 2 | 3 |
| Stratégie | 9 | 0 | 0 | 0 | 0 | 4 | 5 |
| Course | 8 | 1 | 0 | 0 | 4 | 1 | 2 |
| Sport | 1 | 0 | 0 | 0 | 0 | 0 | 1 |

**Conséquence à connaître :** les cartes en repli (57 % du catalogue) héritent du score de
leur franchise et se tassent au même niveau ; c'est ce qui donne à Grand Theft Auto
34 « Peu commune » et 3 « Commune », et à MMO 73 « Commune ». Un calcul fondé sur 43 % de
correspondances réelles produit une rareté qui reflète surtout la taille des franchises.
C'est exactement ce que le contrôle (a) est censé empêcher.

## 10. Anomalies (contrôle e)

Anomalies revérifiées (contrôle e)

- Zelda — confirmée : titre d'article contenant le nom : oui · personnage fictif : oui · œuvre rattachée à la franchise : oui · pages vues 12331 vs médiane 1120
- Ganondorf — confirmée : titre d'article contenant le nom : oui · personnage fictif : oui · œuvre rattachée à la franchise : oui · pages vues 12421 vs médiane 1120
- Samus Aran — confirmée : titre d'article contenant le nom : oui · personnage fictif : oui · œuvre rattachée à la franchise : oui · pages vues 16823 vs médiane 1475

Trois cartes dépassaient 10× la médiane de leur franchise ; les trois ont été revérifiées
(titre contenant le nom, personnage fictif, œuvre rattachée à la franchise) et confirmées.
Aucune n'est un homonyme.

## 11. Correspondances incertaines ou en repli

**338 cartes** suivent la règle de repli. La liste complète, carte par carte
avec le motif, est dans **`RAPPORT_ANNEXE.md`**. Concentration :

| Franchise | Cartes en repli |
| --- | ---: |
| Grand Theft Auto | 28 |
| Final Fantasy IX | 14 |
| Code Vein | 14 |
| Poppy Playtime | 12 |
| Life is Strange | 11 |
| Final Fantasy XIV | 10 |
| Final Fantasy VII | 9 |
| Dofus | 9 |
| The Legend of Zelda | 8 |
| Final Fantasy X | 8 |
| Shenmue | 8 |
| Guild Wars 2 | 7 |
| Crimson Desert | 6 |
| Final Fantasy VI | 6 |
| The Witcher | 6 |

Cas notables : *Claude* (GTA) — deux candidats à 1,00 (Claude de GTA III et Claude Speed de
GTA 2), donc rejeté par la règle d'écart ; *Arthas* — Arthas Menethil et le Roi Liche, deux
éléments du même personnage, rejetés pour la même raison ; *Freya* (God of War) — entité
trouvée, mais aucun lien de franchise prouvable (pas de `P1441`, description sans le nom de
la série).

## 12. Étape 8 — probabilités (aucun poids modifié)

Poids actuels (`game_config.booster_drop_rates`) : C 620,25 · UC 250 · R 114 · SR 14 ·
UR 1,5 · L 0,25 (total 1 000). 5 cartes par booster.

| Rareté | Poids | Part d'un tirage | Cartes (après) | Par carte et par tirage | Par booster | Boosters en moyenne | Avant |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mythique | 0,25 | 0,03 % | 12 | 0,0021 % | 0,010 % | **9 600** | 23 200 |
| Légendaire | 1,5 | 0,15 % | 30 | 0,0050 % | 0,025 % | **4 000** | 9 734 |
| Épique | 14 | 1,40 % | 65 | 0,0215 % | 0,108 % | **929** | 1 643 |
| Rare | 114 | 11,40 % | 119 | 0,0958 % | 0,478 % | **209** | 195 |
| Peu commune | 250 | 25,00 % | 154 | 0,1623 % | 0,809 % | **124** | 110 |
| Commune | 620,25 | 62,02 % | 214 | 0,2898 % | 1,441 % | **69** | 42 |

**Recommandation.** La réduction du nombre de Mythiques (29 → 12) double mécaniquement la
rareté d'une carte précise, mais 9 600 boosters pour un Mythique donné reste hors d'échelle
(environ 26 ans à un booster par jour). Pour viser « un Mythique précis tous les
~2 000 boosters », le poids L devrait passer de 0,25 à **1,2** et UR de 1,5 à **3**, la part
étant reprise sur C. Je ne l'ai pas fait : l'étape 8 est un rapport, et toucher aux poids
change l'économie du jeu.

## 13. Marché

**Aucune annonce ni ordre annulé**, aucune restitution : rien n'a été appliqué, donc aucune
carte n'a changé de rareté et aucun prix n'est sorti de sa fourchette. Le code d'annulation
(annonces et ordres actifs, restitution carte + Pixels, notification, historique des ventes
intact) est écrit et testé ; il ne s'exécutera qu'avec `rarity:apply --yes`.

## 14. Retour arrière

```bash
npm run rarity:rollback            # aperçu
npm run rarity:rollback -- --yes   # restaure rarity = rarity_v1
```

Restaure `rarity` exactement, efface `rarity_v1`, remet `rarity_version = 0`,
`rarity_locked = false`, supprime le bandeau et marque l'exécution annulée. Les annonces
annulées ne sont pas réouvertes (les cartes et les Pixels ont déjà été rendus) — seule
limite, dite dans le script. **Rien à annuler aujourd'hui.**

## 15. Ce qui débloquerait l'application

1. **Documenter les cartes orphelines** (recommandé) : renseigner à la main l'identifiant
   Wikidata des seconds rôles quand il existe (beaucoup n'en ont pas), ou restreindre le
   catalogue aux personnages documentés.
2. **Assumer le repli** : abaisser `CONTROLS.minMatchedShare` dans
   `rarity-distribution.config.ts` (par exemple à 0,40), puis `npm run rarity:preview` et
   `rarity:apply --yes`. C'est un choix de game design : dans ce cas 57 % des raretés
   viennent de la popularité de la franchise, pas du personnage.
3. **Changer de source** : les wikis communautaires (Fandom) couvrent ces personnages, mais
   il n'existe pas d'API publique stable et normalisée pour en tirer des pages vues — à
   décider hors de ce chantier.

## 16. Livrables

- `supabase/migrations/041_popularite_rarete.sql` (+ `.down.sql`),
  `042_rarete_marche_et_bandeau.sql` (+ `.down.sql`)
- `scripts/popularity/` : `check-env`, `snapshot`, `match`, `fetch`, `score`, `preview`,
  `apply`, `rollback`, `probabilities`, `lib/` (http, wikidata, dataset, compute, controls,
  corrections, verify)
- `src/lib/popularity.ts` (calculs purs), `src/lib/rarity-distribution.config.ts`
- page joueur `/raretes` (méthode, sources, date) + `RarityUpdateBanner` (bandeau 7 jours)
- `tests/popularite.test.ts` (20 tests), `DECISIONS.md`, ce rapport, `RAPPORT_ANNEXE.md`
- commandes : `popularity:match`, `popularity:fetch`, `popularity:score`,
  `popularity:snapshot`, `rarity:preview`, `rarity:apply`, `rarity:rollback`,
  `rarity:probabilities`

## 17. Limites connues

- Les cartes appariées sans page vue n'ont qu'un score fondé sur le nombre de langues.
- Les rangs sont calculés sur les 594 cartes, y compris celles à 0 : un personnage sans
  donnée n'est pas « moyen », il est dernier (départage par identifiant).
- L'ordre de repli du tirage (`_draw_cards`) ignore `UC` : défaut antérieur au chantier,
  signalé, non corrigé pour ne pas mélanger deux sujets.
- `WIKI_CONTACT` non défini : l'agent HTTP déclare l'URL du site.
- La popularité ne recalcule **jamais** une rareté existante : après application toutes les
  cartes passent en `rarity_locked = true`, seules les nouvelles cartes sont classées.
