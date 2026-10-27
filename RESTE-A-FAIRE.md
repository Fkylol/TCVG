# TCVG — état des lieux et reste à faire

_Mis à jour le 27 octobre 2026._

## Où en est le site

- Production : <https://tcvg.fun> — version déployée `7226c860` (classement au score de collection).
- Base : projet Supabase `jvmozjfibkbkzzpafoos`, migrations `002` à `030` appliquées.
- Code : `tsc` propre, `lint` propre (0 erreur), `npm test` 387/387, `npm run cf:build` OK.

### Étapes livrées

| Étape | État | Détail |
|---|---|---|
| 1 · Franchises et genres | fait | 32 franchises, 10 genres, 96 liaisons, `cards.franchise_id` NOT NULL |
| 2 · Pixels | fait | Solde dans l'en-tête, bonus quotidien de **10 Pixels / 24 h** annoncé par une barre au crédit, registre `pixel_transactions` |
| 3 · Boosters payants | fait | Mix 20 P · 5 cartes, 3 boosters de genre à 30 P, holo 2 % ; pas de pity (voir E) |
| 4 · Recyclage des doublons | fait | `recycle_card` / `recycle_all_duplicates`, boutons collection + fiche carte, 21/21 vérifications en base |
| 5 · Marché entre joueurs | fait | Annonces normales et holos, achat atomique, commission 5 %, bornes dynamiques, `/marche` + vente depuis la fiche carte |
| Connexion Discord | fait | Discord seul : plus de formulaire email, `/login` et `/signup` limités à l'OAuth |
| Pied de page | fait | Six entrées : Raretés, Règles, Infos, Nouveautés, Classement, Avis et bugs |
| Pages publiques | fait | `/regles`, `/infos`, `/nouveautes`, `/classement`, `/avis-et-bugs` |
| Visuels des boosters | fait | 11 visuels recadrés sur le sachet (520 × 760) dans `public/booster/`, Mix en pack vitrine, un visuel par thème dans la boutique |
| Ouverture carte par carte | fait | Dos de carte dessiné en SVG (`components/card-back.tsx`), aux couleurs du pack ouvert, dont la lueur change de couleur et d'intensité selon la rareté ; retournement au clic, récapitulatif ; boosters gratuits et payants |
| Avis et bugs par email | fait | Message enregistré dans `public.feedback`, puis notification Resend (`src/lib/email.ts`). Clé dans `.env` en local, secret Cloudflare en production ; destinataire à régler avec `FEEDBACK_EMAIL_TO` |
| Puissance, aura et qualité | fait | Barème central `STAT_BANDS` + coefficient 0–1 par carte dans `src/lib/stats.ts`, qualité 60/40 (Standard → Relique), affichage fiche + vignette, score de collection sur `/profil`, section dans `/regles` |
| Classement au score | fait | `leaderboard()` additionne `cards.quality`, synchronisée par `npm run db:cards` ; égalités départagées par personnages puis total ; cadres verrouillés avec jauge de progression |
| Univers MMO | fait | 24 personnages (WoW, FF XIV, Dofus, Guild Wars 2), genre `mmo`, 12ᵉ booster et ses visuels ; visuels récupérés sur Wikipédia, les wikis Fandom et l'Internet Archive pour Guild Wars 2 |
| Échanges carte contre carte | code fait, migration à appliquer | `033_echanges.sql` : `chat_offers` + séquestre (même mécanique que le marché), acceptation atomique, contre-proposition, expiration 24 h, `trades_swaps` immuable, notifications et message privé Discord (bot du jeu) ; `/agora/offres`, bouton dans le fil et annonce depuis la fiche d'une carte |
| Identité visuelle | fondation et purge du lime faites, reste la passe page par page | Bleu nuit de la vitrine des boosters (`vitrine-boosters.html`) : deux aurores en haut de page, trio cyan / violet / rose à la place du lime, Syne + DM Sans + IBM Plex Mono, logo dessiné, barre du haut en pastille de verre, boutons et onglets en pastilles, panneaux translucides à grands coins arrondis. La fondation (jetons, polices, logo, aurores, atomes, en-tête, pied) est posée, et plus une seule teinte lime ne reste dans `src/` : le jeton `acid`, la courbe de `card-price-chart`, l'éclair de `leaderboard-board` et l'emblème du dos standard sont passés au cyan (`tests/identite.test.ts` le vérifie fichier par fichier). `/boosters` est passé à la scène du mockup (voir la ligne suivante) et l'atelier aussi. Les grands titres ont été ramenés à l'échelle de la vitrine — 48 px au lieu de 72 px sur l'accueil, interlettrage resserré à -0,032em — parce que Syne, large par nature, se lisait comme étiré au-delà. Restent les détails de forme page par page : `/collection`, `/marche`, `/classement`, `/profil`, puis l'agora. Les visuels de cartes et les posters de boosters ne changent pas |
| Vitrine des boosters | fait | `/boosters` suit la maquette : en-tête centré (sur-titre, titre, phrase, trois pastilles stock / album / compte à rebours), scène d'un seul poster en grand avec une flèche de chaque côté (clic ou touches ←/→), halo aux couleurs du pack choisi qui se fond d'une sélection à l'autre, pastilles de rareté avec leur chance, lot ×1/×5/×10 et bouton dégradé, puis l'étagère des dix packs en bande horizontale (Choisi / Gratuit / Bientôt). La grille de posters et le tiroir mobile ont disparu ; le tirage, les chances, les lots plafonnés et la révélation sont inchangés. Styles dans `globals.css` (`.v-arrow`, `.v-halo`, `.v-shelf`, `.v-shelf-tile`), mouvement réduit compris |
| Durcissement sécurité | code fait, migration à appliquer | `034_durcissement_privileges.sql` : plus d'insertion directe dans `profiles`, `collection` en lecture seule pour `anon`/`authenticated`, fonctions internes du tirage retirées de l'API publique ; en-têtes de sécurité dans `next.config.ts` |
| Grille des boosters | code fait, migration à appliquer | `035_packs_toujours_disponibles.sql` : les douze packs sont ouvrables en permanence, `open_pack()` rend l'ouverture directe au tirage et les fonctions de sélection quotidienne sont supprimées. `/boosters` montre les douze posters (2/3/4 colonnes), une seule sélection, tiroir mobile ; un pack sous le seuil reste visible, grisé et non ouvrable |

### Choses à faire côté tableaux de bord (pas dans le code)

1. **Supabase → Authentication → URL Configuration** : Site URL = `https://tcvg.fkylol.workers.dev`, Redirect URLs = `https://tcvg.fkylol.workers.dev/**`. Tant que `localhost:3000` est la Site URL, la connexion renvoie sur `localhost:3000/?code=…` et la session n'est jamais créée.
2. **Discord Developer Portal** : redirect `https://jvmozjfibkbkzzpafoos.supabase.co/auth/v1/callback`, puis fournisseur activé dans Supabase (déjà fait, l'erreur `Unsupported provider` a disparu).
3. **Supabase → Authentication → Providers → Email** : fait — vérifié (« Email logins are disabled »). Seule la connexion Discord fonctionne.
4. Vérifier après reconnexion que le solde `◆ N` apparaît dans l'en-tête.

---

## Ce qui reste

### A. Étape 5 — marché entre joueurs · livrée et déployée

Migration `supabase/migrations/011_marche.sql` appliquée et testée le 23 octobre 2026 (39/39).

- `market_listings` : une ligne par copie mise en vente, statut active / sold / cancelled, traces de commission (`fee_pixels`) et du net vendeur (`seller_payout`).
- **Escrow** : une copie quitte la collection à la mise en vente et y revient à l'annulation. Une normale reste toujours au vendeur ; une holo ne part que s'il reste une autre copie.
- **Achat atomique** (`buy_listing`) : verrou de l'annonce, verrous de profils ordonnés, débit acheteur, crédit vendeur, transfert de la copie, deux lignes `pixel_transactions` (`achat_marche`, `vente_marche`). Achat de sa propre annonce interdit.
- **Commission** : 5 % arrondis au supérieur, versés à personne (puits). Exemple : 400 P → 20 de commission, 380 au vendeur.
- **Prix dynamiques** (`market_quote`) : médiane des ventes des 30 derniers jours dès 3 ventes, sinon base de la rareté. Fourchette = référence × 0,5 à × 2, encadrée par un plancher/plafond par rareté (`market_prices` : C 2–25 · R 5–75 · SR 15–250 · UR 60–1000 · L 200–3000). Holos : base et garde-fous × 3.
- Limite : 10 annonces actives par joueur (`market_max_active`), annulation réservée au vendeur.
- Interface : `/marche` (filtres rareté / genre / prix, tri, onglets « Annonces » et « Mes annonces »), formulaire de mise en vente sur `/card/[id]` avec prix conseillé, fourchette et net vendeur.
- Vérifié en base sur des comptes de test : crédit unique, achat holo, commission, annulation, double achat concurrent (une seule réussite), devis dynamique après 3 ventes, visibilité des annonces. Comptes supprimés ensuite.
- Vérifié sur le serveur de dev avec une session réelle : `/marche` affiche l'annonce et le bouton d'achat, `/card/kratos` affiche le formulaire, `/boosters` sert les 11 visuels.

### B. Suite des stats

- **Classement** : fait — `leaderboard()` classe par score de collection (somme des qualités), puis par personnages uniques et total de cartes. La migration `030` ajoute `cards.quality` ; `npm run db:cards` la remplit (une carte active sans qualité fait échouer la synchro).
- **Cadres** : la jauge de progression est affichée pour chaque cadre verrouillé. Les conditions restent les paliers actuels (10 / 25 personnages, une Légendaire, une Mythique) ; les remplacer par des conditions multiples au score reste à décider.
- **Duel** : `duelScore()` est figé dans `src/lib/stats.ts` (70 % puissance, 30 % aura), aucun mode de combat ne l'utilise encore.
- Le coefficient d'une carte se règle dans `CARD_COEFFICIENTS` ; un ajout de carte sans coefficient retombe à 0,5 et fait échouer le test de couverture.

### C. Email des avis et bugs

- **Destinataire manquant** : `FEEDBACK_EMAIL_TO` n'est pas encore défini. Sans domaine vérifié chez Resend, l'expéditeur est `onboarding@resend.dev` et le destinataire doit être l'adresse du compte Resend.
- **Production** : `npx wrangler secret put RESEND_API_KEY` puis `npx wrangler secret put FEEDBACK_EMAIL_TO`. La clé ne doit jamais figurer dans `wrangler.jsonc`.
- `FEEDBACK_EMAIL_FROM` permettra plus tard d'envoyer depuis un domaine vérifié.
- Testé : clé valide (aucun domaine vérifié), envoi Resend 200 et `sendFeedbackEmail()` à `true`.

### D. Déploiement

- Ordre : `npm run db:migrate <fichier>` puis `npm run db:cards` si le catalogue change, puis `npm run cf:build && npm run cf:deploy`.
- Vérifié en production : `/classement` en 200 avec les scores, `/nouveautes` à jour, `/profil` protégé (307 sans session).

### D bis. Bug corrigé — « duplicate key » au recadrage (27 octobre 2026)

Symptôme : un simple recadrage de visuel dans l'atelier en ligne échouait sur `duplicate key value violates unique constraint "cards_character_unique"`.

Cause : `?edit=` change sans changer de route, et React réutilise l'instance du client. Les champs d'identité du formulaire en ligne sont non contrôlés (`defaultValue`) et le cadrage vit dans un état : en passant d'une carte à l'autre par la liste, le formulaire gardait la carte précédente. L'enregistrement écrivait alors l'identité de l'ancienne carte sur la nouvelle, ce qui se brisait sur l'unicité du personnage (index `(universe, lower(btrim(name)))`). Reproduit en base : le même appel avec l'identité de la carte affichée passe ; seul un nom étranger entre en collision.

Corrigé :

- `key={current.id}` sur `OnlineCardForm` — le formulaire repart de la carte affichée (identité **et** cadrage) ;
- migration `057_enregistrement_sans_reecriture.sql` (à appliquer) : `cards` n'est réécrite que si le nom, la rareté ou l'univers changent réellement — un recadrage ne touche plus ni la fiche ni `updated_at` — et un vrai doublon est refusé avec un message en français au lieu de l'erreur PostgreSQL.

La migration a été validée sur la base réelle dans une transaction annulée : recadrage seul accepté sans toucher `updated_at`, identité étrangère refusée, changement réel appliqué.

Symptôme 2 : certaines cartes ne s'ouvraient pas dans l'atelier (page sans formulaire), par exemple « Sciel » en cherchant « Ciel ».

Cause : la liste est plafonnée et suit la recherche ; le lien vers une carte ne conservait pas le terme cherché. La page relisait donc une liste sans le terme, où la carte demandée était absente (limite 300 ou 390 : la liste s'arrête avant les noms en S), et `current` restait `undefined`. Vérifié sur la base : la recherche « Ciel » trouve bien `sciel`, la liste plafonnée ne le contient pas, et la relecture par identifiant le renvoie.

Corrigé : la carte demandée par `?edit=` est relue par son identifiant et placée en tête de liste, le lien de la liste conserve la recherche en cours, et un identifiant inconnu affiche désormais un message au lieu d'une page vide.

### E. Points mineurs laissés de côté

- **Pity retiré** : `pity_rare` / `pity_legendary` (migration 009) ne sont plus alimentés depuis la 014 — `open_pack()` tire uniquement selon les taux de rareté. L'entrée du changelog du 23 octobre qui annonçait « une garantie toutes les 10 / 50 ouvertures » a été corrigée, et `/boosters` n'affiche pas la tuile « R+ » tant que `GUARANTEE_ENABLED` (`src/lib/packs.ts`) reste à `false`. Réintroduire la garantie demande une migration qui la calcule dans `open_pack()` par joueur et par pack, expose le compteur dans `pack_stats()`, puis le passage du drapeau à `true`.
- Les prix dynamiques restent plafonnés par la rareté : une carte SR ne peut pas dépasser 250 P, même si ses ventes montent.

### F. Sécurité (audit du 24 octobre 2026)

**Vérifié, rien à corriger** : RLS active sur toutes les tables ; toute écriture de Pixels, de collection, d'annonce ou d'échange passe par une fonction `security definer` avec `search_path = ''` qui revérifie le propriétaire ; la clé `service_role` n'apparaît que côté serveur (`lookupUserEmail`, jamais dans un composant client) ; la session est validée par `auth.getUser()` ; aucun `dangerouslySetInnerHTML`, `eval` ni URL utilisateur dans un `href` ; le chat nettoie et filtre en base (300 caractères, liens refusés, 3 s entre deux messages, 20/min, anti-flood) ; le marché, les envies, les offres et les annonces ont leurs bornes en base, pas seulement dans l'interface ; `next` de `/auth/confirm` est ramené à une origine unique.

**Corrigé** :

- En-têtes `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, et `X-Powered-By` retiré (`next.config.ts`). Vérifié avec `npm run build`, `next start` puis `curl -I` sur `/`, `/login` et `/api/packs`.
- `034_durcissement_privileges.sql` (à appliquer) : `profiles` n'accepte plus d'insertion directe — la policy ne contrôlait que l'identifiant, donc un joueur dont la ligne manquait pouvait s'écrire `is_admin = true` et le solde de son choix ; `collection` repasse en lecture seule (TRUNCATE n'est pas couvert par RLS) ; `_store_cards`, `_draw_cards`, `_pick_card`, `random_unit` et `roll_rarity` ne sont plus exécutables avec la clé publique. Cause générale : Supabase accorde `EXECUTE`/`ALL` à `anon` et `authenticated` à chaque objet créé, et `revoke ... from public` ne retire pas ces attributions nominatives.

**Reste ouvert** :

- **Limitation de débit absente sur `/avis-et-bugs`** : `sendFeedback` est une Server Action ouverte aux visiteurs, sans compte ; chaque envoi déclenche un e-mail Resend. L'insertion directe dans `feedback` reste possible avec la clé anon. La limite doit être au bord (règle Cloudflare Rate limiting sur les POST, ou Turnstile).
- **Pas de `Content-Security-Policy`** : les cinq autres en-têtes sont en place. Une CSP doit être testée dans un navigateur (Realtime Supabase, images Wikipédia/Fandom, styles inline de React) avant d'être activée.
- **`redirectTo` OAuth déduit de l'en-tête `Host`** (`signInWithDiscord`) : Supabase compare l'URL à son allow-list, donc pas d'exploitation directe, mais l'origine devrait venir de `NEXT_PUBLIC_SITE_URL`. À changer en même temps que la vérification de l'allow-list Supabase, sinon la connexion casse.
- `market_listings` rend les annonces vendues lisibles à tous les joueurs connectés (prix, `seller_id`, `buyer_id`) ; `trades` est déjà limité aux deux parties. Les identifiants sont des UUID, aucune adresse n'est exposée.
- `chat_report` n'a pas de limite de débit (mais un seul rapport par joueur et par message).
- Migrations 031 à 033 non appliquées en base : l'Agora et les échanges ne sont pas exposés aujourd'hui. Le drapeau `is_admin` vit en base (jamais dans les métadonnées Discord), mais aucune 2FA n'est exigée pour les comptes de modération.

### G. Visuels

- Aucune carte du catalogue n'est sans visuel : Wikipédia puis Fandom, sinon la carte est retirée (Violet Sinclair, Bach, Russell Northrop).
- `public/cards/` est vide : tous les portraits sont hotlinkés. Héberger les fichiers localement retirerait la dépendance aux CDN, au prix des copies et des licences.
- L'audit signale 13 visuels de moins de 200 px de large (Derby, Gary, Jill, Chell, etc.) et 6 visuels limités en 429 lors du dernier passage : à revoir avec `npm run portraits:audit`.

---

## Commandes utiles

```bash
npm run dev                                   # site local
npm run db:migrate supabase/migrations/XXX.sql # appliquer une migration
npm run db:cards                              # resynchroniser le catalogue en base
npx tsc --noEmit && npm run lint && npm test  # vérifications
npm run cf:build && npm run cf:deploy         # mise en ligne
```

**Ordre à respecter** : migration d'abord, déploiement ensuite. Le code lit des colonnes ajoutées par les migrations ; l'inverse casse `/collection` et `/boosters`.

## Fichiers de référence

- Migrations : `supabase/migrations/` (`005` franchises, `007` pixels, `009` boosters, `010` recyclage, `011` marché).
- Catalogue des cartes : `src/lib/cards.ts` (seule source de vérité du contenu).
- Raretés et poids : `src/lib/game.ts`.
- Accès base côté serveur : `src/lib/data.ts` ; actions : `src/app/actions.ts`.
- Textes des pages publiques : `src/app/(pages)/`.
