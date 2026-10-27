# TCVG — Trading Card Video Game

Un jeu de collection de cartes façon Kyara / WikiMasters, mais avec les personnages de jeux vidéo :
Kratos, Mario, Spyro, Link, Samus, Ganon… Ouvre des boosters gratuits, complète ton album de
**406 cartes** réparties en 6 raretés, et consulte la fiche de chaque personnage.

> ⚠️ **Projet de fan.** Non officiel et non affilié à Nintendo, Sony, Microsoft, Sega, Square Enix,
> Capcom, Bandai Namco, Activision ou leurs ayants droit. Les personnages et marques cités
> appartiennent à leurs propriétaires respectifs. La plupart des cartes affichent le visuel de la fiche
> Wikipédia ou du wiki Fandom de la franchise, **hotlinké** depuis `upload.wikimedia.org` ou
> `static.wikia.nocookie.net` (aucun fichier copié ni servi par le site) : ces images sont en
> **fair use** sur leur wiki, donc prévues pour illustrer l'article uniquement. Les autres cartes
> utilisent un visuel généré (dégradé + emoji). Reste gratuit et sans pub si tu veux rester dans la
> même zone de tolérance que les projets du genre — et ne monétise pas.
>
> Le catalogue a été élargi à partir de la liste publique de personnages de
> [Retrogems](https://retrogems.fr/personnages-jeux-video/) (noms, jeux et rôles). Aucun visuel de ce
> site n'est utilisé : les portraits viennent de Wikipédia et des wikis Fandom.

## Stack

- **Next.js 16** (App Router, Server Actions), React 19, TypeScript
- **Tailwind CSS 4**
- **Supabase** (Auth Discord + Postgres + RLS)

## Démarrage

```bash
npm install
```

### 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **New project** (le plan gratuit suffit).
2. Dans **SQL Editor** → **New query** : colle tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) puis **Run**.
   Cela crée `profiles`, `collection`, les policies RLS, le trigger de création de profil et la
   fonction `open_booster()`.

### 2. Renseigner les variables d'environnement

**Project Settings → API** :

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

La clé `anon` suffit : toute la sécurité repose sur les policies RLS et sur la fonction serveur.
Ne mets **jamais** la clé `service_role` ici.

### 3. Lancer

```bash
npm run dev
```

→ http://localhost:3000

### 4. Activer la connexion Discord

Le site ne propose que la connexion Discord : un compte est créé automatiquement à la première
connexion.

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** →
   **OAuth2** → ajoute l'URL de retour
   `https://<reference-projet>.supabase.co/auth/v1/callback`, puis récupère le **Client ID** et le
   **Client Secret**.
2. Supabase → **Authentication → Providers → Discord** : active le fournisseur et colle les deux
   valeurs.
3. Supabase → **Authentication → URL Configuration** : Site URL = l'URL publique du site, et
   Redirect URLs = `<url-du-site>/**` (dont `<url-du-site>/auth/confirm`).
4. Supabase → **Authentication → Providers → Email** : désactive le fournisseur pour n'autoriser
   que Discord côté serveur aussi.

La route `src/app/auth/confirm/route.ts` échange le code OAuth contre une session.

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production + typecheck |
| `npm test` | Tests de la logique de jeu (tirages, poids, cooldown, catalogue) |
| `npm run lint` | ESLint |
| `npm run atelier` | Atelier local (ajout, correction, signalements) : démarre le serveur si besoin et ouvre `/atelier/cartes` |
| `npm run db:chat:seed` | Données de test de L'Agora (faux joueurs, messages, annonces, signalement) |

## Comment ça marche

- **Booster** : 3 cartes, une rareté tirée par carte selon des poids (60 % / 25 % / 10 % / 4 % / 1 %),
  puis une carte au hasard dans cette rareté, sans doublon dans le pack. Les cartes se révèlent une
  par une : le dos affiché (`src/components/card-back.tsx`, dessiné en SVG) prend les couleurs du pack
  ouvert et brille selon la rareté avant de se retourner.
- **Stock** : un booster toutes les 10 minutes, **cumulables jusqu'à 10** (ouverts un par un ou tous
  d'un coup). L'accumulation et la consommation sont calculées **en base** par `open_boosters()` dans
  une transaction avec verrou de ligne — impossible à contourner en rejouant la requête.
- **Collection** : une ligne par personnage possédé (`quantity` pour les doublons). La table est en
  lecture seule côté client : la seule écriture possible passe par la fonction SQL.
- **Statistiques** : chaque carte a une **puissance** et une **aura** (0–100) calculées dans la
  fourchette de sa rareté, à partir d'un coefficient interne de 0 à 1. Leur moyenne pondérée
  (60 / 40) donne la **qualité**, notée de Standard à Relique. Le barème vit dans
  `src/lib/stats.ts` ; le score de collection, les cadres et le futur mode duel s'appuient dessus.
- **Fiche perso** : stats, pouvoir, citation, bio, et les autres cartes du même univers.
- **Marché** : annonces de n'importe quelle copie possédée, doublon ou dernière copie (normales
  ou holos), achat atomique en Pixels avec 5 % de commission, prix encadrés par les ventes
  récentes et les garde-fous de rareté. Vendre sa dernière copie retire la ligne de collection ;
  annuler l'annonce la réinsère.
- **Avis et bugs** : le message est enregistré dans `public.feedback` puis notifié par email via
  Resend (`src/lib/email.ts`, variables `RESEND_API_KEY` et `FEEDBACK_EMAIL_TO`).

## Économie du marché

Tout se règle en base, sans redéploiement.

| Réglage (`public.game_config`) | Défaut | Effet |
| --- | --- | --- |
| `market_commission` | `0.05` | Commission prélevée au vendeur à chaque vente, **détruite** (jamais créditée) |
| `market_spread_low` / `market_spread_high` | `0.5` / `2` | Fourchette de prix autorisée autour de la référence |
| `market_history_days` | `30` | Fenêtre de calcul de la médiane de référence |
| `market_min_sales` | `3` | Ventes nécessaires pour que la médiane remplace la base de rareté |
| `market_max_active` | `10` | Annonces actives simultanées par joueur |
| `market_max_orders` | `20` | Ordres d'achat actifs simultanés par joueur |
| `market_rate_window_minutes` | `10` | Fenêtre glissante de la limite de débit |
| `market_rate_max_actions` | `15` | Annonces **et** ordres autorisés par joueur sur la fenêtre |
| `market_listing_days` | `7` | Durée de vie d'une annonce avant retour de la copie au vendeur |

Les prix plancher/plafond et la base de départ vivent dans `public.market_prices`, une ligne par
rareté (`base_pixels`, `min_pixels`, `max_pixels`, `holo_multiplier`).

```sql
-- Exemple : commission à 4 % et plafond d'annonces à 15
update public.game_config set value = '0.04'::jsonb where key = 'market_commission';
update public.game_config set value = '15'::jsonb where key = 'market_max_active';
```

Le carnet d'ordres (migration `021`) fonctionne ainsi : poser un ordre **réserve** le prix maximum
sur le solde, l'appariement prend le meilleur ordre puis l'annonce la moins chère qu'il peut payer,
et le surplus réservé est rendu à l'acheteur. Chaque exécution écrit une ligne dans `trades` et des
lignes dans `pixel_transactions` (`ref_kind` / `ref_id`), ce qui permet de reconstituer n'importe
quel solde. Le rollback complet est commenté en fin de migration.

La migration `022` ajoute les **garde-fous**, tous en base :

- `market_audit` journalise chaque annonce, ordre et vente (acteur, carte, montant, statut).
  La table a la RLS activée **sans aucune policy** : même authentifié, un joueur ne peut ni la lire
  ni y écrire. Elle se consulte depuis le SQL Editor du dashboard.
- Un trigger commun (`market_rate_limit`) plafonne annonces + ordres sur une fenêtre glissante ;
  le dépassement lève `rate_limited`, et l'action entière est annulée (aucune annonce fantôme).
  L'interface traduit ce refus en message clair dans `src/app/actions.ts`.
- `market_listing_guard` refuse toute annonce sur une carte retirée (`card_retired`), quel que soit
  le chemin d'écriture : `create_listing()` ne vérifie que l'existence de la carte, pas son statut.
- Après avoir désactivé une carte ou une franchise, on purge ses annonces et ordres actifs — les
  cartes reviennent aux vendeurs, les Pixels réservés aux acheteurs, et la purge est tracée :

```sql
select public.market_purge_retired();   -- {"listings": 2, "orders": 1, "refunded": 300}
```

### Administration du marché

La migration `026` ajoute `profiles.is_admin` et le rapport `admin_market_report(days)` (1 à 90
jours) : volumes, commission, vendeurs, cartes, paires d'échange croisées, rafales d'actions et
50 dernières lignes du journal. La fonction vérifie elle-même le drapeau (`not_admin` sinon) et la
page `/admin/marche` répond `404` à tous les autres.

Le drapeau n'est **pas** modifiable depuis le site : `update` sur `profiles` est limité à la colonne
`username`. La promotion passe par le script :

```bash
npm run db:admin -- --list          # qui est administrateur ?
npm run db:admin -- <pseudo>        # promouvoir
npm run db:admin -- --revoke <pseudo>
```

`market_purge_retired()` est révoquée pour `anon` et `authenticated` : elle s'exécute depuis le
SQL Editor ou un script d'administration.

La migration `023` ajoute la **durée de vie** et l'**édition du prix** :

- Chaque annonce reçoit `expires_at` (défaut `now() + market_listing_days`) au moment de sa création.
- `market_expire_listings()` balaie les annonces échues, les annule avec `cancel_reason = 'expired'`
  et rend la copie au vendeur. Il est appelé au chargement du marché et d'une fiche carte, et il est
  idempotent (`for update skip locked`). Aucune tâche planifiée n'est nécessaire.
- Une annonce échue est déjà invisible du marché public et refusée par `buy_listing()` et
  `match_card_orders()` : entre l'expiration et le balayage, elle ne peut ni être achetée ni servir
  un ordre.
- `update_listing_price()` change le prix d'une annonce active, dans les bornes de `market_quote()`,
  puis relance l'appariement : baisser un prix sous un ordre en attente vend immédiatement.

La migration `024` ajoute les **notifications in-app** — pas d'email :

- `public.notifications` reçoit trois événements, écrits par des triggers `security definer` :
  `listing_sold` (vendeur, net encaissé), `order_filled` (acheteur, prix payé — branché sur `trades`,
  car l'ordre passe « filled » avant que le prix ne soit écrit) et `listing_expired` (vendeur,
  ancien prix). Un retrait volontaire ne notifie personne.
- La table est en lecture seule côté client : RLS avec une seule policy `user_id = auth.uid()`,
  `revoke all` puis `grant select`. Seuls les triggers écrivent.
- `mark_notifications_read()` solde les non lues du joueur connecté, éventuellement limitées à une
  liste d'identifiants. Le header affiche le compteur non lu, `/notifications` la liste complète.
- La migration `027` ajoute `wishlist_listing` : un trigger sur `market_listings` (insertion ou
  baisse de prix) prévient les joueurs qui suivent la carte, jamais le vendeur, jamais une annonce
  échue. Index unique partiel `(user_id, listing_id, amount)` : pas de doublon si le prix fait des
  allers-retours.
- La migration `028` ajoute `wishlist.max_price`, le seuil « préviens-moi sous ◆ X ». Nul → toute
  annonce et toute baisse alertent ; rempli → alerte à l'apparition sous le seuil, puis uniquement
  au franchissement à la baisse. Le client ne peut pas modifier la colonne (`update` non accordé) :
  tout passe par `set_wishlist_alert()`, exposé sur la page Envies.

La migration `025` ouvre les **chiffres du marché** et répare un trou d'historique :

- `market_overview()` renvoie ventes et volume sur 24 h et 7 jours, commission détruite, annonces
  actives (hors échues), ordres en attente et top 5 des cartes — sans aucune identité.
- `card_sales_history(carte, limite, décalage)` renvoie toutes les ventes d'une carte, `total` répété
  sur chaque ligne ; limite bornée à 50, décalage négatif ramené à 0. La fiche charge 12 ventes à la
  fois.
- **Correctif** : `buy_listing()` écrivait la vente dans `market_listings` mais pas dans `trades`
  (contrairement à l'appariement des ordres). Un trigger différé (`record_direct_sale`, `deferrable
  initially deferred`) complète `trades` à la fin de la transaction s'il n'y a pas déjà une ligne
  pour l'annonce ; les ventes directes passées ont été reprises depuis les annonces vendues, avec
  leur date réelle, sans générer de faux événements d'audit ou de notification.

## L'Agora (chat du marché)

Le chat communautaire vit dans la colonne droite du marché, sur `/agora` en pleine page et — sur
mobile — derrière le bouton flottant « Agora ». Les règles publiques sont sur `/regles-chat`.

### Changer le nom

Une seule constante : `APP_CHAT_NAME` dans [`src/lib/chat/config.ts`](src/lib/chat/config.ts).
Le panneau, le bouton mobile, la page `/agora` et les métadonnées la lisent ; rien n'est écrit en
dur ailleurs.

### Appliquer le chat

1. Rejouer la migration [`supabase/migrations/031_agora.sql`](supabase/migrations/031_agora.sql)
   (`npm run db:migrate -- supabase/migrations/031_agora.sql` ou SQL Editor).
2. **Realtime** : la migration ajoute `chat_messages` à la publication `supabase_realtime`. Si la
   publication n'existait pas, l'activer dans *Database → Replication* pour cette table.
3. Optionnel : `npm run db:chat:seed` pour peupler les salons (comptes Nova, Kaito, Mira, Sacha —
   sans mot de passe, ils ne servent qu'à remplir le fil).

Sans la migration, le panneau affiche un état d'attente : le marché et l'album continuent de
fonctionner.

### Ajouter un salon

```sql
insert into public.chat_rooms (language, number, capacity)
values ('fr', 4, 150);
```

`language` vaut `fr`, `en`, `es` ou `int` ; un joueur rejoint automatiquement le salon le moins
rempli de sa langue, et peut en changer à la main. La capacité est portée par le salon (la modifier
ici ne touche pas les autres).

### Ajuster les limites

Tout est dans `game_config`, sans redéploiement :

| Clé | Effet | Défaut |
| --- | --- | --- |
| `chat_room_capacity` | Capacité des nouveaux salons | 150 |
| `chat_retention_days` | Rétention des messages | 7 |
| `chat_rate_seconds` | Délai minimal entre deux messages | 3 |
| `chat_rate_per_minute` | Plafond par minute | 20 |
| `chat_unlock_boosters` | Boosters ouverts pour écrire | 20 |
| `chat_unlock_hours` | Ancienneté du compte pour écrire | 24 |
| `chat_max_announcements` | Annonces actives par joueur | 3 |
| `chat_announcement_minutes` | Durée de vie d'une annonce | 30 |
| `chat_history_page` | Messages chargés par page | 50 |
| `chat_offer_hours` | Durée de vie d'une proposition d'échange | 24 |
| `chat_offers_active_max` | Propositions en attente par joueur | 5 |
| `chat_offers_per_day` | Propositions envoyées par 24 h | 10 |

```sql
update public.game_config set value = '30'::jsonb where key = 'chat_rate_seconds';
```

Les constantes `CHAT_DEFAULTS` de `src/lib/chat/config.ts` et `OFFER_DEFAULTS` de
`src/lib/chat/offers.ts` servent de repli à l'interface et de source pour la page de règles : garde-les
alignées quand tu changes une valeur.

### Échanges carte contre carte (C4)

Migration [`033_echanges.sql`](supabase/migrations/033_echanges.sql) : propositions, séquestre,
acceptation atomique, contre-proposition, expiration, historique immuable (`trades_swaps`) et
notifications (`swap_offer`, `swap_accepted`, `swap_declined`, `swap_expired`). À appliquer après
la 031 :

```bash
npm run db:migrate -- supabase/migrations/033_echanges.sql
```

- Depuis une annonce du chat, « Proposer un échange » (annonce *J'échange*) ou « Faire une offre »
  (*Je cherche*) ouvre une boîte de dialogue par-dessus le fil : le joueur y choisit une de ses
  copies, qui est **retirée de la collection** dès l'envoi (même séquestre que le marché). Elle
  revient au refus, au retrait ou à l'expiration.
- Le destinataire accepte, refuse ou contre-propose depuis `/agora/offres`. L'acceptation est une
  seule transaction : les deux copies changent de main, ou rien ne bouge. `unique (offer_id)` sur
  `trades_swaps` rend un double-clic inoffensif, et `trades_swaps` refuse toute modification.
- Une offre répondant à *Je cherche* n'a pas de carte demandée : le chercheur doit d'abord
  contre-proposer (bouton « Choisir ce que tu donnes »).
- Cartes retirées (`cards.active = false`), annonces closes ou expirées : `chat_offer_sweep()`
  annule les offres concernées, rend les copies et notifie les deux joueurs. Elle tourne au début
  de chaque lecture (`chat_offer_list`) ; un cron facultatif peut l'appeler toutes les 15 minutes :

```sql
select cron.schedule('agora-offres', '*/15 * * * *', $$select public.chat_offer_sweep()$$);
```

- **Message privé Discord** : le bot du jeu prévient le destinataire à chaque proposition
  (création comme contre-proposition), en plus de la notification in-site. Il lit l'identifiant
  Discord dans `discord_links` (migration 045 : table sans politique RLS, remplie par un
  déclencheur sur `auth.identities`), ouvre la conversation privée puis poste le message — voir
  `src/lib/discord.ts`. Rien ne part sans `DISCORD_BOT_TOKEN` et sans `SUPABASE_SERVICE_ROLE_KEY`,
  et Discord refuse le MP si le joueur ne partage pas le serveur du jeu avec le bot.
- Une carte s'annonce aussi depuis sa fiche, sans ouvrir le panneau : « Proposer mon doublon »
  (au moins deux exemplaires — l'échange de l'Agora, lui, garde cette règle) ou « Chercher cette
  carte » (absente, ou déjà dans les envies).
  `announceCardHere` résout le salon habituel du joueur (`chat_join`), puis publie par
  `chat_announce`, qui revérifie doublon, envies, débit et quota.
- Aucun Pixels ne circule dans un échange ; les ventes restent sur le marché.

### Modération

Les droits viennent de `profiles.is_admin` (déjà utilisé par `/admin/marche`) :
`npm run db:admin -- <pseudo>`. Une fois promu, le panneau affiche « Modération » et la page
`/agora/moderation` propose :

- la file des signalements avec cinq messages de contexte avant et après ;
- la suppression d'un message (l'auteur est prévenu par le fil, l'action est journalisée) ;
- la mise au silence 10 min / 1 h / 24 h / définitive, et sa levée ;
- le retrait des annonces actives d'un joueur ;
- le passage d'un salon en lecture seule ;
- le journal d'audit (qui, quoi, quand, raison).

Les mêmes actions sont accessibles depuis le menu « ⋯ » de chaque message. Toutes les fonctions
vérifient `is_admin()` en base : forcer la route ne donne rien.

### Limites connues

- Les scénarios concurrents d'un échange (double acceptation, expiration avec restitution) ne sont
  couverts que par des garde-fous statiques : les jouer demande une base de test.
- Le message privé Discord de L'Agora reste muet tant que `DISCORD_BOT_TOKEN` et
  `SUPABASE_SERVICE_ROLE_KEY` ne sont pas configurés, ou si le joueur n'a jamais rejoint le serveur
  du jeu ; la notification in-site, elle, fonctionne toujours.

## Connexion Discord et cadeau de bienvenue

La connexion passe uniquement par Discord (`signInWithDiscord`, retour sur `/auth/confirm`).
L'origine du retour est calculée dans `src/lib/origin.ts` : HTTPS hors machine locale, car
`x-forwarded-proto` n'est pas toujours fourni par Cloudflare et `http://tcvg.fun` sortait de la
liste blanche Supabase — celle-ci renvoyait alors vers sa « Site URL ». Cette dernière doit valoir
`https://tcvg.fun` (Authentication → URL Configuration). Un échec d'échange de code est journalisé
et expliqué sur `/login?erreur=confirmation`.

Chaque nouveau compte reçoit **10 boosters** dans `profiles.bonus_boosters` (migration
`051_bonus_bienvenue.sql`, qui les verse aussi une fois aux comptes existants). Le cadeau est
tracé dans `booster_grants` (`bienvenue`, `cadeau-10-boosters`), ce qui rend la migration
rejouable sans verser deux fois.

## Parrainage

Chaque joueur a un code de 8 caractères (`/invite/<code>`). À sa première connexion
Discord, un filleul venu par ce lien est rattaché à son parrain ; un compte déjà existant
ne peut pas être parrainé et le parrain ne change jamais. Quand le filleul a **ouvert 20
boosters** (journal serveur `booster_openings`, un ×10 compte pour 10), les deux reçoivent
**3 boosters bonus** : immédiatement si l'A2F du filleul est active, sinon après **7 jours**.

Les réglages sont dans un seul fichier, `src/lib/referral/config.ts`, et leur miroir SQL
`public.referral_config()` (migration 046). Les modifier demande les deux, sinon seules les
pages changent.

| Réglage | Défaut | Effet |
| --- | --- | --- |
| `rewardBoosters` / `reward_boosters` | 3 | Boosters bonus par côté |
| `requiredOpenings` / `required_openings` | 20 | Seuil d'ouvertures du filleul |
| `delayDays` / `delay_days` | 7 | Délai de la voie différée |
| `maxPaidPerReferrer` | 20 | Plafond de parrainages payés |
| `maxPendingPerReferrer` | 50 | Plafond de parrainages en cours |
| `activeDaysRequiredDelayed` | 3 | Jours de connexion distincts pendant l'attente (0 = off) |
| `cookieDays` | 30 | Durée du cookie d'invitation |
| `discordMinAccountAgeDays` | 0 | Âge minimum du compte Discord (0 = off) |
| `fingerprintRetentionDays` | 90 | Conservation des empreintes salées |

**Statuts** : `en_cours` (moins de 20 ouvertures), `eligible` (seuil atteint, décision en
cours), `en_attente` (voie différée, date `eligible_at`), `a_examiner` (signaux de proximité :
aucun paiement automatique), `paye`, `refuse` (motif interne, message générique au joueur).

**Tâche planifiée** — à appeler toutes les heures :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tcvg.fun/api/cron/referrals
```

Elle paie les parrainages différés échus par lots (reprise par parrainage en cas d'échec)
et purge les empreintes de plus de 90 jours. Sans `CRON_SECRET`, l'endpoint répond 503.
L'administration se fait sur `/admin/parrainage` (filtres, approbation/refus, export CSV).

**A2F et vie privée** : scope OAuth2 `identify` uniquement, aucun jeton Discord conservé.
`mfa_enabled` est relu à chaque connexion et par le bouton « J'ai activé l'A2F, revérifier »
(nouvelle connexion Discord). Les empreintes d'IP et d'agent utilisateur sont des
HMAC-SHA256 salés (`REFERRAL_HASH_SALT`), purgés après 90 jours ; voir `/confidentialite`.

La migration `046_parrainage.sql` est additive ; `046_parrainage.down.sql` la défait
(suppression des colonnes et tables ajoutées, `open_pack()` d'origine restauré).

## Visuels des personnages

### Fichiers locaux (recommandé)

Dépose les fichiers dans `public/cards/` en les nommant comme la carte — `kratos.webp`,
`ciri.png`… (webp, avif, png, jpg) — puis :

```bash
npm run images:sync            # écrit src/data/card-images.json et cards.image_path
npm run images:sync -- --dry   # aperçu, sans rien modifier
```

Le rendu résout dans cet ordre : **fichier local** → visuel hotlinké de `portraits.json` → dégradé +
emoji. Un fichier supprimé du dossier repasse `image_path` à `null` au sync suivant, et la carte
retrouve son visuel de repli. Le manifeste est statique : même résolution côté serveur et navigateur.

### Anciens visuels hotlinkés

Les visuels viennent de la fiche Wikipédia anglophone de chaque personnage :

```bash
npm run portraits   # réécrit src/data/portraits.json
```

- Le script interroge l'API Wikipédia par lots, avec un throttle de 1,2 s et des reprises sur 429.
- Il **ne télécharge rien** : il ne stocke que l'URL `upload.wikimedia.org`, la licence et le crédit.
  `CardFace` la charge en direct (`unoptimized`), donc Next ne recopie pas l'image.
- La correspondance carte → article est la table `WIKI_TITLES` en haut de
  `scripts/fetch-portraits.ts`. Elle est **volontairement explicite** : la recherche plein texte
  ramenait des pages hors sujet (Baldur → *Baldur's Gate*, le Chevalier → *Cagliostro*). Une carte
  absente de la table garde le dégradé + emoji.
- Le crédit du fichier s'affiche sous la carte, sur la fiche du personnage.
- Le visuel se cherche d'abord sur le wiki **Fandom** de la franchise — c'est là que vivent les
  artworks du jeu : page portant exactement le nom du personnage, image principale, domaine
  correspondant à la franchise. Wikipédia/Wikidata ne sert qu'à défaut, et seulement si l'entité
  est un personnage fictif rattaché à la franchise (`npm run images:strict`). Une carte sans visuel
  fiable garde le rendu dégradé + emoji ; elle n'est plus retirée pour cette raison.
- Si un visuel casse (fichier renommé, page supprimée), il suffit d'éditer `src/data/portraits.json`
  pour retirer l'entrée : la carte retombe sur le rendu généré. Une carte qui quitte
  `src/lib/cards.ts` est supprimée de la base par `npm run db:cards`, copies comprises.

## Atelier : ajouter ou corriger une carte

`npm run atelier` démarre le serveur de développement s'il ne tourne pas déjà et ouvre
`/atelier/cartes`. L'édition de cartes n'existe qu'en local (elle écrit dans les fichiers du
projet) : en ligne, `/atelier/cartes` renvoie vers `/atelier/signalements`.

L'onglet **Atelier** de l'en-tête et les pages `/atelier/*` sont réservés aux administrateurs
(`profiles.is_admin`, function `is_admin()`). En ligne, la file de signalements est lue avec la
session de l'administrateur (policies de la migration 050) ; en local, elle passe par la
connexion de maintenance (`.env`), comme les scripts.

1. Tape le nom du personnage, puis « Préparer ». Laisse la franchise sur « Déduire du nom »
   pour que l'atelier la retrouve seul (page Wikipédia du personnage, alias de franchise type
   « Warcraft » pour World of Warcraft) ; sinon choisis-la dans la liste.
2. L'atelier cherche les visuels sur le wiki de la franchise (déduit des portraits déjà au
   catalogue) puis sur Wikipédia fr/en, vérifie chaque image (taille ≥ 300 px, ratio, type,
   hotlink) et propose les fichiers de la page qui portent le nom du personnage. Si le wiki n'a
   pas le beau visuel, colle l'URL d'une image trouvée ailleurs (recherche d'images, site
   officiel) : elle passe les mêmes contrôles et devient le visuel de la carte — sa licence,
   elle, n'est pas vérifiée.
3. Il rédige une fiche à partir de la page retenue, estime la rareté avec la méthode du jeu
   (pages vues Wikipédia + nombre de langues, comparées au dernier `.popularity/dataset.json`)
   et reprend le genre dominant de la franchise. Tout est modifiable dans le formulaire, avec
   un aperçu de la carte au vrai rendu.
4. « Valider et ajouter au jeu » écrit la carte dans `src/data/atelier-cards.json` (et sa fiche
   dans `atelier-lore.json`), puis lance `npm run db:cards` pour la recopier en base.

L'aperçu et les vignettes passent par un relais local (`/atelier/image`, réservé au
développement) : les CDN répondent 403 au referer de `localhost` et l'image resterait vide. Le
relais joint les en-têtes du site et ne sert que des hôtes publics ; l'URL d'origine, elle, est
celle qui est enregistrée.

Pour corriger une carte déjà au catalogue, choisis-la dans « Modifier une carte existante » : le
formulaire reprend son nom, sa franchise, sa rareté, ses genres, sa fiche et son visuel. Valider
réécrit son entrée dans `atelier-cards.json` sous le même identifiant ; `CARDS` remplace alors la
carte de base sur place, donc elle n'apparaît pas deux fois et son numéro d'album ne bouge pas.

Les ajouts sont concaténés au catalogue (`CARDS` dans `src/lib/cards.ts`), donc ils prennent les
numéros d'album suivants sans renuméroter l'existant, et `db:cards` les traite comme les autres.
Une carte ajoutée puis retirée de `atelier-cards.json` est supprimée de la base au prochain
`db:cards`, copies comprises.

La rareté estimée est un point de départ : `popularity:*` puis
`rarity:preview` restent le calcul officiel du catalogue.

### Signalements de carte

Dans sa collection, chaque carte porte un bouton « Signaler » : le joueur choisit un motif
(visuel, fiche, rareté, autre), écrit ce qui cloche, et le message part dans
`public.card_reports` (migration 050). Les signalements ne sont lisibles que par
l'administration (`is_admin()`) et se consultent dans `/atelier/signalements`, page réservée au
serveur de développement : « Ouvrir dans l'atelier » charge la carte dans le formulaire
(`/atelier/cartes?edit=<id>`), et le signalement se marque comme traité une fois corrigé.

```bash
npm run db:migrate -- supabase/migrations/050_signalements_cartes.sql
```

## Structure

```
src/
  app/
    page.tsx              landing publique
    login/ signup/        connexion Discord uniquement (Server Action OAuth)
    actions.ts            signInWithDiscord, signOut, achats, recyclage
    auth/confirm/route.ts code OAuth -> session
    (game)/               routes protégées (layout = garde de session)
      boosters/           ouverture de booster
      collection/         album filtrable
      card/[id]/          fiche wiki + mise en vente
      marche/             annonces et achats entre joueurs
  components/             cartes, booster, filtres, formulaires
  lib/
    cards.ts              ← catalogue des personnages (source de vérité)
    game.ts               raretés, poids, tirage, cooldown
    auth.ts data.ts       accès session / données
    supabase/             clients navigateur et serveur
supabase/schema.sql       schéma + RLS + fonction open_booster()
tests/game.test.ts        tests de la logique
```

## Rareté par popularité

La rareté d'une carte peut être calculée d'après la popularité publique de son
personnage (pages vues Wikipédia + nombre de langues), jamais d'après une impression.
Le pipeline est en scripts, **jamais** dans une requête joueur :

```bash
npm run popularity:check-env   # accès Wikimedia + base
npm run popularity:snapshot    # instantané vérifié avant toute écriture
npm run popularity:match       # personnage -> entité Wikidata (reprend au cache)
npm run popularity:fetch       # pages vues 12 mois + sitelinks
npm run popularity:score       # score 0–100 en base (ne touche pas rarity)
npm run rarity:preview         # calcul à blanc + contrôles -> .popularity/preview.md
npm run rarity:apply -- --yes  # application atomique, si tous les contrôles passent
npm run rarity:rollback -- --yes
npm run rarity:probabilities   # rapport de probabilités, aucun poids modifié
```

Réglages (parts cibles, plafonds par franchise, seuils de correspondance, contrôles
bloquants) dans `src/lib/rarity-distribution.config.ts`. Une rareté appliquée est
**figée** : toutes les cartes passent en `rarity_locked = true`, seules les nouvelles
cartes sont classées par la suite. Pour tout recalculer, il faut `rarity:rollback` puis
`rarity:apply --yes` — deux gestes manuels.

État au 25 octobre 2026 : le contrôle de correspondance exige 85 % de personnages
rattachés à un article ; le catalogue plafonne à 43 % (seconds rôles de GTA et de MMO
sans article propre). **Rien n'a donc été appliqué** — voir `RAPPORT_FINAL.md`.

## Modifier le jeu

- **Ajouter / retirer un personnage** : une entrée dans `CARDS` (`src/lib/cards.ts`). Pour un nouvel
  univers, ajoute-le d'abord dans `UNIVERSES` (couleurs du dégradé).
- **Changer les raretés ou les chances** : `RARITY` et `BOOSTER_COOLDOWN_MS` dans `src/lib/game.ts`.
  Les libellés de classes Tailwind (`ring-amber-300/60`, etc.) sont dans ce même fichier.
- **Mettre les nouveautés en avant** : `new_card_boost` (défaut 5) et `new_card_window_days` (défaut 7)
  dans `game_config`. Une carte dont `cards.added_at` a moins de sept jours pèse cinq fois plus lourd
  au tirage, à rareté égale. `added_at` n'est jamais réécrite par `npm run db:cards` ; passer
  `new_card_boost` à 1 rend le tirage uniforme sans redéploiement.
- **Changer le nombre de cartes par booster** : `CARDS_PER_BOOSTER`. Si tu passes au-delà de 5,
  relève aussi la limite dans `open_booster()` (`array_length(p_cards, 1) > 5`).
- **Changer l'apparence des cartes** : les six raretés sont définies dans `src/app/globals.css`  (tokens `--rarity-*`, fond, bordure, intensité du foil et des paillettes). La route `/dev/holo`
  (réservée aux admins) montre les six raretés et les variantes misprint avec un curseur
  d'intensité : c'est le rendu au repos qu'il faut juger, le survol n'existant pas sur mobile.
  Une copie brillante (`data-holo="true"`, posée par `CardFace`) ne suit pas cette règle : sa
  pellicule reste allumée à toute rareté, y compris en Commune, et dérive toute seule sans
  pointeur — une vignette de collection ne s'incline pas, c'est cette dérive qui la trahit.
- **Ajouter un booster** :
  1. ajoute une entrée dans `PACKS` (`src/lib/packs.ts`) : `id`, nom, sous-titre, genre (`null`
     pour le Mix), palette, facteur de titre et clé d'illustration ;
  2. dessine son SVG dans `src/components/booster-art.tsx` (formes géométriques uniquement) et
     ajoute la clé au type `PackArt` ;
  3. insère le pack dans `public.booster_types` (migration) avec `cards_count = 5`, son genre et
     `active = true` ; le pool vient des cartes actives de ce genre ;
  4. vérifie le poster et l'inclinaison sur `/dev/packs` (réservé aux admins), puis ouvre un pack
     de test : le tirage et le cooldown restent entièrement en base.
- **Disponibilité des packs** : les douze packs sont ouvrables en permanence ; seul le seuil de
  personnages actifs (`game_config.pack_min_pool_size`, exposé par `pack_stats()`) retient un pack
  encore trop court. `open_pack(slug)` accepte donc n'importe quel pack actif, et refuse seulement
  un pool sous le seuil (`pack_unavailable`) ou un stock vide. La migration `035` rebranche
  `open_pack()` sur le tirage direct défini par les migrations 014 et 015.
- **Variantes misprint** : cinq défauts cosmétiques (`ghosting`, `off_center`, `holo_bleed`,
  `reverse`, `holo_blue`) sont tirés par `_draw_cards()`. `misprint_chance` (0,8 % par carte, dans
  `game_config`) décide qu'une carte naît défectueuse, puis `variant_weights` répartit les défauts
  entre eux (migration 055 : les trois historiques à 1, `reverse` à 0,7, `holo_blue` à 0,3). Seules
  les cinq clés connues sont tirables : un réglage incomplet retombe sur le tirage historique. La
  première variante rencontrée est conservée dans `collection.variant` ; `src/lib/variants.ts`
  normalise les valeurs et porte les libellés. Aucun effet sur les stats ou la cote. Le rendu de
  `reverse` (foil sur le cadre, illustration nette) et de `holo_blue` (foil bleu, visible même en
  Commune) vit dans `globals.css`, section « Variantes misprint ».
- **Retirer une carte** : supprime son entrée de `src/lib/cards.ts` (et ses lignes dans
  `card-genres.ts`, `card-lore.ts`, `stats.ts`, `portraits.json`) puis lance `npm run db:cards`.
  La carte est effacée de la base comme si elle n'avait jamais existé : ligne `cards`, copies de
  collection, envies, annonces et ordres, échanges, genres et fiches tombent avec elle
  (`collection.card_id` est en `on delete cascade` depuis la migration 040). Le jeu est en
  développement : aucune donnée n'est conservée pour une carte retirée. La synchro refuse de
  tourner si le catalogue fait moins de 100 cartes, pour éviter d'effacer la base sur un import
  cassé.

## Limites connues (avant d'aller plus loin)

- La **sélection** des cartes est faite côté serveur Next.js, pas en base : quelqu'un qui appellerait
  `open_booster()` directement avec des identifiants de cartes mythiques pourrait se les offrir. Sans
  échange ni marché, ça ne lèse personne — mais avant d'ajouter du **trade entre joueurs**, il faudra
  soit valider les ids dans la fonction SQL (table `cards` + tirage en PL/pgSQL), soit déplacer le
  tirage dans une API avec la clé `service_role`.
- Pas encore de : échange direct de cartes entre joueurs, duels, pages de profil publiques.
  Les Pixels et le marché entre joueurs, eux, sont en place.

## Déploiement

Dans les deux cas, ajoute les variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
et, dans Supabase (Authentication → URL Configuration), l'URL de production dans *Site URL* et
`https://ton-domaine/auth/confirm` dans *Redirect URLs*.

**Vercel** — import du repo, variables d'environnement, c'est tout.

**Cloudflare** — l'adaptateur est déjà installé et configuré (`wrangler.jsonc`, `open-next.config.ts`,
`nodejs_compat`). Il ne reste que l'authentification :

```bash
npx wrangler login     # une seule fois, ouvre le navigateur
npm run cf:build       # bundle le worker (relance next build)
npm run cf:deploy      # publie sur Workers
```

Sans navigateur (CI), exporte `CLOUDFLARE_API_TOKEN` (template « Edit Cloudflare Workers ») et
`CLOUDFLARE_ACCOUNT_ID` puis lance `npm run cf:deploy`.

`cf:deploy` ne reconstruit rien : il publie le `.open-next/` produit par `cf:build`. Sur
**Windows**, `cf:build` échoue sans mode développeur — OpenNext recrée des liens symboliques vers
`node_modules` (`EPERM: symlink`) ; activer le mode développeur de Windows, ou remplacer ces
liens par des jonctions dans `node_modules/@opennextjs/aws/dist/build/copyTracedFiles.js` (le
correctif est perdu à chaque `npm ci`).

⚠️ Les `NEXT_PUBLIC_*` sont **inlinées au build** : elles doivent être présentes dans l'environnement
au moment de `cf:build`, pas seulement au runtime.

## Cadres d'avatar

Tout le système vit dans **`src/lib/frames.config.ts`** : définitions, seuils,
couleurs, animations, voies et réglages transverses. L'évaluation est faite par
`evaluateFrameSet()` (fonction pure, testée) ; la base ne fournit que des
compteurs agrégés (`frame_stats`) et applique le résultat (`frame_apply`).

### Ajouter un cadre

1. Ajoute une entrée dans `FRAMES` (ou dans le tableau de sa voie) avec `id`,
   `name`, `lane`, `prestige`, `condition`, `colors`, `gradient`, `description`
   et, si besoin, `secret`, `animated`, `motif`, `availableFrom/Until`.
2. Rien d'autre n'est à modifier : l'interface, les onglets, l'administration,
   la démo et le recalcul itèrent la configuration. Un cadre de genre peut être
   généré à partir de `PACKS` (couleurs et emblème du booster).
3. Vérifie le rendu sur `/dev/frames`.

### Changer un seuil

Modifie la `condition` du cadre (pourcentage, jours, nombre d'actions) et
redéploie. Aucun nombre absolu de cartes n'est écrit en dur : les pourcentages
portent sur les personnages **actifs** du moment. Les déblocages déjà acquis ne
sont jamais retirés par un changement de catalogue ; la tâche quotidienne
recalcule les joueurs qui n'ont pas encore atteint le nouveau seuil.

### Recalcul et tâche planifiée

```bash
npm run db:frames          # recalcul initial / manuel, avec la config TS
npm run db:frames:verify   # vérifications en base (transaction annulée)
```

`/api/cron/frames` traite la file d'évaluation puis les joueurs les plus anciens
à recalculer. À appeler une fois par jour avec `CRON_SECRET` ; il exige aussi
`SUPABASE_SERVICE_ROLE_KEY` (l'écriture des cadres n'est pas ouverte aux
joueurs). Sans clé de service, les pages restent lisibles et `db:frames` sert de
recalcul.

### Administration

`/admin/cadres` (réservé à `is_admin()`) : nombre de joueurs par cadre,
activation/désactivation, attribution/retrait avec motif, recalcul global et
journal. Une désactivation retire le cadre des sélections en cours ; un ban
(`suspended_at`) efface tous les cadres du joueur. Un cadre `active: false`
dans la configuration n'est pas activable depuis l'administration : c'est la
configuration qui décide de son entrée au catalogue.

### Notes

- Une visite authentifiée marque le jour d'activité (série « Assidu ») : une
  seule insertion et une seule mise en file par jour, quel que soit le nombre
  de pages ouvertes.
- Le maintien de 24 h des prestiges 4 et 5 est implémenté mais **désactivé**
  (`FRAME_FEATURES.maintenanceHoursForPrestige45 = 0`). Mets `24` pour l'activer.
- Le « grandfathering » des anciens cadres est prévu (`FRAME_FEATURES`) mais
  désactivé ; il ne couvre que les anciens identifiants Acier/Jade/Améthyste/Or.
- Le cadre de saison fourni est volontairement inactif : il montre la structure
  des dates, sans être obtenable.
- Retour arrière : `supabase/migrations/047_cadres.down.sql` (les déblocages des
  nouveaux cadres sont perdus, le site étant en développement).

## Overlay Halloween

L'overlay autonome vit dans `public/events/halloween-overlay.js`.
`src/components/halloween-overlay.tsx` le charge une seule fois dans le layout
racine, du **15 octobre au 2 novembre inclus** (heure de Paris), avec un bouton
🎃 pour le désactiver (choix gardé en `localStorage`). Le calque est en
`pointer-events: none` et son `z-index` (35) reste sous les modales (50–85).

La sorcière est désactivée (`witch: false`) ; le booster est réclamable sur une
citrouille (`boosterPumpkin: true`). Un clic appelle
`POST /api/halloween/booster` ; le serveur vérifie la session, la fenêtre, une
limite de débit (IP + compte), puis `claim_halloween_booster()` (une
réclamation par heure et par compte). Le booster rejoint
`profiles.bonus_boosters`, le stock bonus du parrainage, consommé par
`open_pack()` après le stock normal. Aucune nouvelle mécanique d'inventaire.

Succès : `{ ok: true, booster: { name } }`, bonbons, toast et événement
`window` `halloween:booster`. Trop tôt : `429` avec `retryAfterMs`. Le
`localStorage` ne sert qu'à l'affichage ; il n'autorise jamais une réclamation.

Pour tester hors saison :

```bash
# .env.local (et au build pour NEXT_PUBLIC_)
NEXT_PUBLIC_HALLOWEEN_FORCE=1
HALLOWEEN_FORCE=1
npm test -- tests/halloween.test.ts
```

La migration est `supabase/migrations/048_halloween.sql` ; son rollback est
commenté en fin de fichier. L'overlay respecte `prefers-reduced-motion` (la
sorcière reste dans un coin) et met toutes les animations en pause quand
l'onglet est caché.

## Animations

Les effets (déchirure des boosters, auras, cadres animés, overlay) tournent **par défaut même
quand l'appareil est en économie d'énergie** : beaucoup de téléphones passent
`prefers-reduced-motion: reduce` dès que le mode éco s'enclenche, ce qui éteignait toute
l'ouverture. Le réglage du profil (« Animations : Toujours / Suivre le système ») écrit
`localStorage["tcvg:motion"]` et l'attribut `data-motion` de `<html>` : les blocs
`@media (prefers-reduced-motion: reduce)` de `globals.css` ne s'appliquent qu'en mode
`auto`, où ils sont préfixés par `html:not([data-motion="full"])`. Le script d'amorçage
de `layout.tsx` pose l'attribut avant le premier rendu.

## Overlay Noël

L'overlay autonome vit dans `public/events/xmas-overlay.js`.
`src/components/xmas-overlay.tsx` le charge une seule fois dans le layout
racine, du **1er décembre au 5 janvier inclus** (heure de Paris). Il ajoute une
neige douce et une guirlande lumineuse, en `pointer-events: none`, avec un
`z-index` (45–46) au-dessus de l'en-tête (40) et sous les modales (50–85).

Pour tester hors saison, dans `.env.local` (et au build pour `NEXT_PUBLIC_`) :

```bash
NEXT_PUBLIC_XMAS_FORCE=1
npm test -- tests/xmas.test.ts
```
